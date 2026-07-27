/**
 * SharePoint Embedded GraphClient
 * 
 * Provides MSAL client-credential authentication (app-only) and file operations
 * against a SharePoint Embedded container using the Microsoft Graph API.
 * 
 * Architecture notes (from Orbit/synozur-scdp):
 * - SPE containers do NOT support path-chaining off the container ID.
 *   Correct flow: GET container/drive → get driveId, then use /drives/{driveId}/root:/{path}
 * - driveId is cached per containerId with a 5-minute TTL.
 * - Upload split: ≤4 MB simple PUT, >4 MB resumable session.
 */

import * as msal from "@azure/msal-node";

const FORBIDDEN_CHARS_RE = /[<>:"/\\|?*\x00-\x1f~#%&{}]/g;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Strip forbidden chars and reject Windows reserved names */
export function sanitizeFileName(name: string): string {
  const clean = name.replace(FORBIDDEN_CHARS_RE, "_").trim();
  if (WINDOWS_RESERVED.test(clean)) {
    return `_${clean}`;
  }
  return clean || "file";
}

interface DriveCache {
  driveId: string;
  expiresAt: number;
}

export class SpeGraphClient {
  private readonly clientApp: msal.ConfidentialClientApplication;
  private readonly tenantId: string;
  private readonly driveCache = new Map<string, DriveCache>();
  private readonly DRIVE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor() {
    const clientId = process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.ENTRA_CLIENT_SECRET;
    const tenantId = process.env.ENTRA_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      throw new Error(
        "Missing required env vars: ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, ENTRA_TENANT_ID"
      );
    }

    this.tenantId = tenantId;
    this.clientApp = new msal.ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
      system: {
        loggerOptions: {
          loggerCallback: () => {},
          piiLoggingEnabled: false,
        },
      },
    });
  }

  /** Acquire a Graph API access token (cached until near expiry) */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.token;
    }

    const tokenPromise = this.clientApp.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`MSAL token acquisition timed out after ${SPE_FETCH_TIMEOUT_MS}ms`)),
        SPE_FETCH_TIMEOUT_MS
      )
    );

    const result = await Promise.race([tokenPromise, timeoutPromise]);

    if (!result?.accessToken) {
      throw new Error("Failed to acquire access token from MSAL");
    }

    this.tokenCache = {
      token: result.accessToken,
      expiresAt: result.expiresOn ? result.expiresOn.getTime() : now + 3600_000,
    };

    return result.accessToken;
  }

  /** Make an authenticated Graph API request */
  private async graphRequest(
    method: string,
    url: string,
    body?: Buffer | string | object,
    contentType?: string
  ): Promise<Response> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    if (contentType) {
      headers["Content-Type"] = contentType;
    } else if (body && !(body instanceof Buffer)) {
      headers["Content-Type"] = "application/json";
    }

    const fetchBody =
      body instanceof Buffer
        ? body
        : body
        ? JSON.stringify(body)
        : undefined;

    return fetch(url, {
      method,
      headers,
      body: fetchBody,
      signal: AbortSignal.timeout(SPE_FETCH_TIMEOUT_MS),
    });
  }

  /** 
   * Resolve the driveId for a container, cached for 5 minutes.
   * SPE requires: GET /storage/fileStorage/containers/{containerId}/drive → driveId
   */
  async getDriveId(containerId: string): Promise<string> {
    const cached = this.driveCache.get(containerId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.driveId;
    }

    const url = `https://graph.microsoft.com/v1.0/storage/fileStorage/containers/${containerId}/drive`;
    const response = await this.graphRequest("GET", url);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to get driveId for container ${containerId}: ${response.status} ${text}`
      );
    }

    const data = (await response.json()) as { id: string };
    if (!data.id) {
      throw new Error(`No driveId in container drive response`);
    }

    this.driveCache.set(containerId, {
      driveId: data.id,
      expiresAt: Date.now() + this.DRIVE_CACHE_TTL,
    });

    return data.id;
  }

  /**
   * Upload a file to the container.
   * ≤4 MB: simple PUT; >4 MB: resumable upload session.
   */
  async uploadFile(
    containerId: string,
    filePath: string,
    buffer: Buffer,
    mimeType = "application/octet-stream"
  ): Promise<string> {
    const driveId = await this.getDriveId(containerId);
    const safePath = filePath
      .split("/")
      .map(sanitizeFileName)
      .join("/");

    const FOUR_MB = 4 * 1024 * 1024;

    if (buffer.length <= FOUR_MB) {
      return this.simpleUpload(driveId, safePath, buffer, mimeType);
    } else {
      return this.resumableUpload(driveId, safePath, buffer, mimeType);
    }
  }

  private async simpleUpload(
    driveId: string,
    filePath: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${filePath}:/content`;
    const response = await this.graphRequest("PUT", url, buffer, mimeType);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Simple upload failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as { id: string; webUrl?: string };
    return data.id;
  }

  private async resumableUpload(
    driveId: string,
    filePath: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    // Create upload session
    const sessionUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${filePath}:/createUploadSession`;
    const sessionResp = await this.graphRequest("POST", sessionUrl, {
      item: { "@microsoft.graph.conflictBehavior": "replace" },
    });

    if (!sessionResp.ok) {
      const text = await sessionResp.text();
      throw new Error(`Failed to create upload session (${sessionResp.status}): ${text}`);
    }

    const session = (await sessionResp.json()) as { uploadUrl: string };

    // Microsoft Graph requires non-final fragment sizes to be multiples of 320 KiB.
    // We use 5 * 320 KiB = 1,638,400 bytes per chunk.
    const CHUNK_SIZE = 5 * 320 * 1024; // 1,638,400 bytes — valid Graph fragment size
    const totalSize = buffer.length;
    let uploadedItemId = "";

    for (let start = 0; start < totalSize; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
      const chunk = buffer.slice(start, end + 1);
      const isFinal = end === totalSize - 1;

      // Upload session URLs are pre-authenticated; Authorization header is not required
      // but we include it anyway for compatibility with some tenants.
      const token = await this.getAccessToken();
      const chunkResp = await fetch(session.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": chunk.length.toString(),
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Content-Type": mimeType,
          Authorization: `Bearer ${token}`,
        },
        body: chunk,
      });

      // 202 Accepted = more chunks needed; 200/201 = upload complete
      if (chunkResp.status === 202) {
        // Intermediate chunk accepted — continue
        continue;
      }

      if (chunkResp.status === 200 || chunkResp.status === 201) {
        const data = (await chunkResp.json()) as { id: string };
        uploadedItemId = data.id;
        if (isFinal) break;
        continue;
      }

      // Any other status is an error
      const text = await chunkResp.text();
      throw new Error(`Chunk upload failed at byte ${start} (HTTP ${chunkResp.status}): ${text}`);
    }

    return uploadedItemId;
  }

  /**
   * Create a resumable upload session for direct browser-to-SPE uploads.
   * Returns the pre-authenticated uploadUrl the client can PUT chunks to.
   * The URL is valid for ~15 minutes and does not require an Authorization header.
   */
  async createUploadSession(
    containerId: string,
    filePath: string
  ): Promise<string> {
    const driveId = await this.getDriveId(containerId);
    const safePath = filePath
      .split("/")
      .map(sanitizeFileName)
      .join("/");

    const sessionUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${safePath}:/createUploadSession`;
    const sessionResp = await this.graphRequest("POST", sessionUrl, {
      item: { "@microsoft.graph.conflictBehavior": "replace" },
    });

    if (!sessionResp.ok) {
      const text = await sessionResp.text();
      throw new Error(
        `Failed to create upload session (${sessionResp.status}): ${text}`
      );
    }

    const session = (await sessionResp.json()) as { uploadUrl: string };
    if (!session.uploadUrl) {
      throw new Error("No uploadUrl in upload session response");
    }
    return session.uploadUrl;
  }

  /**
   * Download a file from the container, returns a Buffer.
   * @param timeoutMs - optional override for the fetch timeout (default: SPE_FETCH_TIMEOUT_MS).
   *                    Use a larger value when downloading originals for variant generation.
   */
  async downloadFile(
    containerId: string,
    filePath: string,
    timeoutMs?: number
  ): Promise<Buffer> {
    const driveId = await this.getDriveId(containerId);
    const safePath = filePath
      .split("/")
      .map(sanitizeFileName)
      .join("/");

    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${safePath}:/content`;

    if (timeoutMs !== undefined) {
      // Use a custom timeout for large downloads
      const token = await this.getAccessToken();
      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Download failed (${response.status}): ${text}`);
      }
      return Buffer.from(await response.arrayBuffer());
    }

    const response = await this.graphRequest("GET", url);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Download failed (${response.status}): ${text}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Delete a file from the container.
   */
  async deleteFile(containerId: string, filePath: string): Promise<void> {
    const driveId = await this.getDriveId(containerId);
    const safePath = filePath
      .split("/")
      .map(sanitizeFileName)
      .join("/");

    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${safePath}`;
    const response = await this.graphRequest("DELETE", url);

    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      throw new Error(`Delete failed (${response.status}): ${text}`);
    }
  }

  /**
   * Test the connection: verify we can resolve the container's driveId.
   */
  async testConnection(containerId: string): Promise<{ ok: boolean; message: string; driveId?: string }> {
    try {
      const driveId = await this.getDriveId(containerId);
      return { ok: true, message: `Connected. Drive ID: ${driveId}`, driveId };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/** Timeout (ms) applied to every SPE fetch call. Override via SPE_TIMEOUT_MS env var. */
export const SPE_FETCH_TIMEOUT_MS = parseInt(process.env.SPE_TIMEOUT_MS || "5000", 10);

// Singleton instance — lazily initialised so missing env vars only throw at call time
let _client: SpeGraphClient | null = null;

export function getSpeGraphClient(): SpeGraphClient {
  if (!_client) {
    _client = new SpeGraphClient();
  }
  return _client;
}
