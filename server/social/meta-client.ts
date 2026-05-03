/**
 * Thin Meta Graph API wrapper for publishing to Facebook Pages and
 * Instagram Business accounts. The caller passes a decrypted access token
 * (resolved via loadAccountToken from token-crypto.ts); this module never
 * touches the DB, never reads process.env for tokens, and never logs the
 * token value.
 */

const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type Platform = "instagram" | "facebook";

export interface PublishResult {
  ok: true;
  externalPostId: string;
  permalink?: string;
}

export interface PublishError {
  ok: false;
  message: string;       // human-readable, safe for UI
  retryable: boolean;    // transient network/rate limit vs hard format error
}

export type PublishResponse = PublishResult | PublishError;

function redactToken(input: string, token?: string): string {
  if (!token) return input;
  return input.split(token).join("<redacted>");
}

// Token is now passed in directly (decrypted by the caller); no env lookup.

interface FetchOpts {
  method?: "GET" | "POST";
  body?: Record<string, any>;
  token: string;
}

async function metaFetch(path: string, opts: FetchOpts): Promise<any> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const init: RequestInit = { method: opts.method || "GET" };
  if (opts.method === "POST" && opts.body) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.body)) {
      if (v === undefined || v === null) continue;
      params.append(k, String(v));
    }
    params.append("access_token", opts.token);
    init.body = params;
  } else {
    url.searchParams.set("access_token", opts.token);
  }

  const safeUrl = url.toString().replace(opts.token, "<redacted>");
  const res = await fetch(url.toString(), init);
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || (json && json.error)) {
    const errObj = json?.error || {};
    const message =
      errObj.error_user_msg ||
      errObj.message ||
      `Meta API error (${res.status})`;
    const code = errObj.code;
    // Retryable: transient (1, 2), rate limit (4, 17, 32, 613), or 5xx
    const retryable =
      [1, 2, 4, 17, 32, 613].includes(code) || res.status >= 500;
    const safeMsg = redactToken(message, opts.token);
    console.warn(
      `[meta] ${safeUrl} -> ${res.status} code=${code} retryable=${retryable} msg=${safeMsg}`
    );
    const err: any = new Error(safeMsg);
    err.retryable = retryable;
    err.metaCode = code;
    throw err;
  }

  return json;
}

/* ---------------- Facebook Page feed ---------------- */

export async function publishFacebookPagePost(args: {
  pageId: string;
  accessToken: string;
  caption: string;
  imageUrl: string;
  link?: string;
}): Promise<PublishResponse> {
  try {
    const token = args.accessToken;
    // Page feed photo publish: Meta's documented endpoint for an image
    // post on a Page is /{page-id}/photos. We pass `link` as a separate
    // field AND append the tracked URL to the caption to guarantee the
    // tracked link is visible/tappable in the feed even on clients that
    // don't render the structured `link` attachment for photo posts.
    const captionWithLink = args.link
      ? `${args.caption}\n\n${args.link}`
      : args.caption;
    const result = await metaFetch(`/${args.pageId}/photos`, {
      method: "POST",
      token,
      body: {
        url: args.imageUrl,
        caption: captionWithLink,
        link: args.link,
        published: "true",
      },
    });
    const externalPostId = result.post_id || result.id;
    return {
      ok: true,
      externalPostId,
      permalink: `https://www.facebook.com/${externalPostId}`,
    };
  } catch (e: any) {
    return {
      ok: false,
      message: e.message || "Facebook publish failed",
      retryable: !!e.retryable,
    };
  }
}

/* ---------------- Instagram (single + carousel) ---------------- */

async function igCreateContainer(
  igUserId: string,
  token: string,
  body: Record<string, any>
): Promise<string> {
  const r = await metaFetch(`/${igUserId}/media`, {
    method: "POST",
    token,
    body,
  });
  if (!r.id) throw new Error("Instagram did not return container id");
  return r.id;
}

async function igWaitForContainer(
  containerId: string,
  token: string,
  timeoutMs = 60_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await metaFetch(`/${containerId}`, {
      token,
      // status_code: EXPIRED | ERROR | FINISHED | IN_PROGRESS | PUBLISHED
      method: "GET",
    });
    const url = new URL(`${GRAPH_BASE}/${containerId}`);
    url.searchParams.set("fields", "status_code");
    url.searchParams.set("access_token", token);
    const res = await fetch(url.toString());
    const json = await res.json().catch(() => ({}));
    const status = json.status_code || r.status_code;
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      const err: any = new Error(`Instagram container ${status}`);
      err.retryable = false;
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  const err: any = new Error("Instagram container timed out before ready");
  err.retryable = true;
  throw err;
}

export async function publishInstagramPost(args: {
  igUserId: string;
  accessToken: string;
  caption: string;
  mediaUrls: string[]; // 1 = single image, 2-10 = carousel
}): Promise<PublishResponse> {
  try {
    if (!args.mediaUrls.length)
      return { ok: false, message: "No media URLs provided", retryable: false };
    if (args.mediaUrls.length > 10)
      return {
        ok: false,
        message: "Instagram allows max 10 carousel images",
        retryable: false,
      };

    const token = args.accessToken;

    let creationId: string;

    if (args.mediaUrls.length === 1) {
      creationId = await igCreateContainer(args.igUserId, token, {
        image_url: args.mediaUrls[0],
        caption: args.caption,
      });
      await igWaitForContainer(creationId, token);
    } else {
      // Carousel: create child containers, then a parent container
      const childIds: string[] = [];
      for (const url of args.mediaUrls) {
        const id = await igCreateContainer(args.igUserId, token, {
          image_url: url,
          is_carousel_item: "true",
        });
        await igWaitForContainer(id, token);
        childIds.push(id);
      }
      creationId = await igCreateContainer(args.igUserId, token, {
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption: args.caption,
      });
      await igWaitForContainer(creationId, token);
    }

    const publishRes = await metaFetch(`/${args.igUserId}/media_publish`, {
      method: "POST",
      token,
      body: { creation_id: creationId },
    });
    const externalPostId = publishRes.id;
    if (!externalPostId)
      return {
        ok: false,
        message: "Instagram publish returned no id",
        retryable: true,
      };

    // Optionally fetch permalink
    let permalink: string | undefined;
    try {
      const url = new URL(`${GRAPH_BASE}/${externalPostId}`);
      url.searchParams.set("fields", "permalink");
      url.searchParams.set("access_token", token);
      const res = await fetch(url.toString());
      const json = await res.json();
      permalink = json.permalink;
    } catch {
      /* non-fatal */
    }
    return { ok: true, externalPostId, permalink };
  } catch (e: any) {
    return {
      ok: false,
      message: e.message || "Instagram publish failed",
      retryable: !!e.retryable,
    };
  }
}

/* ---------------- Token validation (used by Connect modal) ---------------- */

export interface ValidateResult {
  ok: boolean;
  displayName?: string;
  externalId?: string;
  expiresAt?: Date | null;
  error?: string;
}

export async function validateFacebookPageToken(
  pageId: string,
  token: string
): Promise<ValidateResult> {
  try {
    const url = new URL(`${GRAPH_BASE}/${pageId}`);
    url.searchParams.set("fields", "id,name");
    url.searchParams.set("access_token", token);
    const res = await fetch(url.toString());
    const json = await res.json();
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message || `HTTP ${res.status}` };
    }
    // Inspect token for expiry
    let expiresAt: Date | null = null;
    try {
      const dbg = new URL(`${GRAPH_BASE}/debug_token`);
      dbg.searchParams.set("input_token", token);
      dbg.searchParams.set("access_token", token);
      const dr = await fetch(dbg.toString());
      const dj = await dr.json();
      const exp = dj?.data?.expires_at;
      if (exp && exp > 0) expiresAt = new Date(exp * 1000);
    } catch {
      /* optional */
    }
    return { ok: true, displayName: json.name, externalId: json.id, expiresAt };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function validateInstagramAccount(
  igUserId: string,
  token: string
): Promise<ValidateResult> {
  try {
    const url = new URL(`${GRAPH_BASE}/${igUserId}`);
    url.searchParams.set("fields", "id,username");
    url.searchParams.set("access_token", token);
    const res = await fetch(url.toString());
    const json = await res.json();
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      displayName: json.username || `IG ${igUserId}`,
      externalId: json.id,
      expiresAt: null,
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
