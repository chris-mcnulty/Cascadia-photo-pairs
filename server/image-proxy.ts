/**
 * Image proxy handler for /api/photos/:id/image
 *
 * Serves photos from SPE (SharePoint Embedded), Wix redirects, or base64 decode.
 * Falls back gracefully when SPE is slow or unreachable:
 *   – base64 imageUrl → inline response with X-Image-Source: spe-fallback
 *   – http imageUrl   → 302 redirect with X-Image-Source: spe-fallback
 *   – self-proxy URL  → 503 (avoids infinite redirect loops)
 */

import type { Request, Response } from "express";

export interface PhotoRecord {
  id: string;
  imageUrl: string;
  storageProvider?: string | null;
  spContainerId?: string | null;
  spFolderPath?: string | null;
}

export interface SpeClient {
  downloadFile(containerId: string, filePath: string): Promise<Buffer>;
}

export interface ImageProxyDeps {
  getPhoto(id: string): Promise<PhotoRecord | undefined>;
  getSpeClient(): SpeClient;
}

export function makeImageProxyHandler(deps: ImageProxyDeps) {
  return async function imageProxyHandler(req: Request, res: Response) {
    try {
      const photo = await deps.getPhoto(req.params.id);
      if (!photo) return res.status(404).json({ message: "Photo not found" });

      const size = (req.query.size as string) || "mid";
      if (!["thumb", "mid", "full"].includes(size)) {
        return res.status(400).json({ message: "Invalid size. Use thumb, mid, or full." });
      }

      const provider =
        photo.storageProvider ||
        (photo.imageUrl.startsWith("data:") ? "base64" : "wix");

      if (provider === "sharepoint_embedded" && photo.spContainerId && photo.spFolderPath) {
        // Serve from SPE — fall back to imageUrl only if it is a non-proxy external URL
        try {
          const client = deps.getSpeClient();
          const filePath = `${photo.spFolderPath}/${size}.jpg`;
          const buffer = await client.downloadFile(photo.spContainerId, filePath);
          res.setHeader("Content-Type", "image/jpeg");
          res.setHeader("Cache-Control", "public, max-age=86400");
          return res.send(buffer);
        } catch (speErr) {
          console.error(`SPE download failed for photo ${photo.id}:`, speErr);

          // Attempt graceful fallback: use imageUrl if it is a real external URL
          const fallbackUrl = photo.imageUrl;
          const isSelfProxy = !fallbackUrl || fallbackUrl.startsWith("/api/photos/");

          if (!isSelfProxy && fallbackUrl.startsWith("data:")) {
            // base64 fallback
            const match = fallbackUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              const [, mime, data] = match;
              const buf = Buffer.from(data, "base64");
              res.setHeader("Content-Type", mime);
              res.setHeader("Cache-Control", "private, max-age=300");
              res.setHeader("X-Image-Source", "spe-fallback");
              return res.send(buf);
            }
          }

          if (!isSelfProxy && fallbackUrl.startsWith("http")) {
            // Wix or other external URL fallback
            let redirectUrl = fallbackUrl;
            if (redirectUrl.includes("wix.com") || redirectUrl.includes("wixstatic.com")) {
              const widthMap: Record<string, number> = { thumb: 400, mid: 1200, full: 3000 };
              const w = widthMap[size] || 1200;
              const sep = redirectUrl.includes("?") ? "&" : "?";
              redirectUrl = `${redirectUrl}${sep}w=${w}`;
            }
            res.setHeader("X-Image-Source", "spe-fallback");
            return res.redirect(302, redirectUrl);
          }

          // No usable fallback — return 503 instead of 500 or looping
          res.setHeader("X-Image-Source", "spe-fallback");
          return res
            .status(503)
            .json({ message: "Image temporarily unavailable — SPE storage unreachable" });
        }
      }

      if (provider === "base64" || photo.imageUrl.startsWith("data:")) {
        // Decode base64 from DB
        const match = photo.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return res.status(422).json({ message: "Invalid base64 image" });
        const [, mime, data] = match;
        const buffer = Buffer.from(data, "base64");
        res.setHeader("Content-Type", mime);
        res.setHeader("Cache-Control", "private, max-age=3600");
        return res.send(buffer);
      }

      // Wix or any external URL — guard against self-referential proxy URLs
      const redirectUrl_raw = photo.imageUrl;
      if (redirectUrl_raw.startsWith("/api/photos/") || redirectUrl_raw === "") {
        return res.status(422).json({ message: "Photo has no valid external image URL" });
      }
      let redirectUrl = redirectUrl_raw;
      // Cap Wix images by appending size hint
      if (redirectUrl.includes("wix.com") || redirectUrl.includes("wixstatic.com")) {
        const widthMap: Record<string, number> = { thumb: 400, mid: 1200, full: 3000 };
        const w = widthMap[size] || 1200;
        const sep = redirectUrl.includes("?") ? "&" : "?";
        redirectUrl = `${redirectUrl}${sep}w=${w}`;
      }
      return res.redirect(302, redirectUrl);
    } catch (error) {
      console.error("Error in image proxy:", error);
      res.status(500).json({ message: "Failed to serve image" });
    }
  };
}
