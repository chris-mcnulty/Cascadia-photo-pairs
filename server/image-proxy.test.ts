/**
 * Tests for the image proxy handler (server/image-proxy.ts).
 *
 * Scenarios covered:
 *   1. SPE slow / hanging → proxy responds within 6 s with fallback (Wix redirect)
 *   2. SPE 503 (thrown error) → X-Image-Source: spe-fallback, returns 302 not 500
 *   3. SPE-only photo (self-referential imageUrl) → 503, no infinite redirect loop
 *   4. SPE 503 with base64 fallback imageUrl → 200 with X-Image-Source: spe-fallback
 *   5. SPE success → 200 image/jpeg, no fallback header
 *   6. Non-SPE Wix photo → 302 redirect
 *   7. Non-SPE base64 photo → 200 decoded image
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { makeImageProxyHandler, type ImageProxyDeps, type PhotoRecord } from "./image-proxy";

// ─── helpers ────────────────────────────────────────────────────────────────

function buildApp(deps: ImageProxyDeps) {
  const app = express();
  app.get("/api/photos/:id/image", makeImageProxyHandler(deps));
  return app;
}

const SPE_PHOTO: PhotoRecord = {
  id: "photo-1",
  imageUrl: "https://static.wixstatic.com/media/sample.jpg",
  storageProvider: "sharepoint_embedded",
  spContainerId: "cid-123",
  spFolderPath: "photos/photo-1",
};

const SMALL_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // minimal JPEG header

// ─── tests ──────────────────────────────────────────────────────────────────

describe("image proxy — SPE fallback", () => {
  // 1. Slow/hanging SPE — should fall back within timeout, not hang forever
  it("falls back to Wix redirect when SPE hangs (simulated via AbortError)", async () => {
    const abortError = Object.assign(new Error("SPE fetch aborted"), { name: "AbortError" });
    const deps: ImageProxyDeps = {
      getPhoto: async () => SPE_PHOTO,
      getSpeClient: () => ({
        downloadFile: () => Promise.reject(abortError),
      }),
    };

    const app = buildApp(deps);
    const start = Date.now();
    const res = await request(app).get("/api/photos/photo-1/image");
    const elapsed = Date.now() - start;

    // Response must arrive within 6 s (generous budget above the 5 s SPE timeout)
    expect(elapsed).toBeLessThan(6000);

    // Must be a redirect (302) to the Wix fallback URL, not a 500
    expect(res.status).toBe(302);
    expect(res.headers["x-image-source"]).toBe("spe-fallback");
    expect(res.headers["location"]).toContain("wixstatic.com");
  });

  // 2. Graph API 503 — should carry spe-fallback header, return 302 not 500
  it("returns 302 with X-Image-Source: spe-fallback on Graph API 503", async () => {
    const graphError = new Error("Download failed (503): Service Unavailable");
    const deps: ImageProxyDeps = {
      getPhoto: async () => SPE_PHOTO,
      getSpeClient: () => ({
        downloadFile: () => Promise.reject(graphError),
      }),
    };

    const app = buildApp(deps);
    const res = await request(app).get("/api/photos/photo-1/image");

    expect([200, 302]).toContain(res.status);
    expect(res.headers["x-image-source"]).toBe("spe-fallback");
    // Must not be a server error
    expect(res.status).not.toBe(500);
    expect(res.status).not.toBe(503);
  });

  // 3. SPE-only photo (self-referential imageUrl) → 503, no looping
  it("returns 503 when SPE fails and imageUrl is a self-referential proxy path", async () => {
    const speOnlyPhoto: PhotoRecord = {
      id: "photo-2",
      imageUrl: "/api/photos/photo-2/image", // self-referential — would loop
      storageProvider: "sharepoint_embedded",
      spContainerId: "cid-123",
      spFolderPath: "photos/photo-2",
    };

    const deps: ImageProxyDeps = {
      getPhoto: async () => speOnlyPhoto,
      getSpeClient: () => ({
        downloadFile: () => Promise.reject(new Error("SPE unreachable")),
      }),
    };

    const app = buildApp(deps);
    const res = await request(app).get("/api/photos/photo-2/image");

    expect(res.status).toBe(503);
    expect(res.headers["x-image-source"]).toBe("spe-fallback");
    // Must not redirect to itself
    expect(res.headers["location"] ?? "").not.toContain("/api/photos/");
  });

  // 4. SPE fails, base64 fallback imageUrl → 200 with spe-fallback header
  it("serves inline base64 fallback with X-Image-Source: spe-fallback when SPE fails", async () => {
    const pngData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const b64Photo: PhotoRecord = {
      id: "photo-3",
      imageUrl: `data:image/png;base64,${pngData}`,
      storageProvider: "sharepoint_embedded",
      spContainerId: "cid-123",
      spFolderPath: "photos/photo-3",
    };

    const deps: ImageProxyDeps = {
      getPhoto: async () => b64Photo,
      getSpeClient: () => ({
        downloadFile: () => Promise.reject(new Error("SPE down")),
      }),
    };

    const app = buildApp(deps);
    const res = await request(app).get("/api/photos/photo-3/image");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.headers["x-image-source"]).toBe("spe-fallback");
  });
});

describe("image proxy — SPE success path", () => {
  it("serves JPEG buffer directly from SPE with no fallback header", async () => {
    const deps: ImageProxyDeps = {
      getPhoto: async () => SPE_PHOTO,
      getSpeClient: () => ({
        downloadFile: async () => SMALL_JPEG,
      }),
    };

    const app = buildApp(deps);
    const res = await request(app).get("/api/photos/photo-1/image");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/jpeg");
    expect(res.headers["x-image-source"]).toBeUndefined();
  });
});

describe("image proxy — non-SPE providers", () => {
  it("redirects Wix photos via 302", async () => {
    const wixPhoto: PhotoRecord = {
      id: "photo-4",
      imageUrl: "https://static.wixstatic.com/media/photo.jpg",
      storageProvider: "wix",
    };

    const deps: ImageProxyDeps = {
      getPhoto: async () => wixPhoto,
      getSpeClient: () => ({ downloadFile: vi.fn() as any }),
    };

    const app = buildApp(deps);
    const res = await request(app).get("/api/photos/photo-4/image?size=thumb");

    expect(res.status).toBe(302);
    expect(res.headers["location"]).toContain("wixstatic.com");
    expect(res.headers["location"]).toContain("w=400");
  });

  it("decodes base64 photos inline", async () => {
    const pngData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const b64Photo: PhotoRecord = {
      id: "photo-5",
      imageUrl: `data:image/png;base64,${pngData}`,
    };

    const deps: ImageProxyDeps = {
      getPhoto: async () => b64Photo,
      getSpeClient: () => ({ downloadFile: vi.fn() as any }),
    };

    const app = buildApp(deps);
    const res = await request(app).get("/api/photos/photo-5/image");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.headers["x-image-source"]).toBeUndefined();
  });

  it("returns 404 when photo does not exist", async () => {
    const deps: ImageProxyDeps = {
      getPhoto: async () => undefined,
      getSpeClient: () => ({ downloadFile: vi.fn() as any }),
    };

    const app = buildApp(deps);
    const res = await request(app).get("/api/photos/missing/image");

    expect(res.status).toBe(404);
  });
});
