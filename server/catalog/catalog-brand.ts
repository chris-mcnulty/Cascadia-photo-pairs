import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import type { CatalogEntry, CatalogSize } from "./catalog-data";

// Brand Kit colors (Cascadia Oceanic). Hex without leading '#'.
export const BRAND = {
  evergreen: "174A2E", // headers / headings (Evergreen Core)
  midtone: "3F8F5A", // accent / secondary (Mountain Midtone)
  granite: "717478", // neutral meta text (Granite Neutral)
  mistLight: "92D1A9",
  skyHighlight: "A8EBD8",
  textDark: "262626", // body text for print legibility
  white: "FFFFFF",
};

export const STORE_BASE_URL = "https://www.chrismcnulty.net";

// Resolve a server asset path that works both in dev (tsx, cwd=repo root) and
// in the esbuild production bundle (import.meta.dirname=dist).
function resolveAssetPath(...parts: string[]): string {
  const candidates = [
    path.resolve(import.meta.dirname, "assets", ...parts),
    path.resolve(process.cwd(), "server", "assets", ...parts),
    path.resolve(process.cwd(), "assets", ...parts),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

export const FONT_FILES = {
  black: () => resolveAssetPath("fonts", "MetroNova-Black.ttf"),
  bold: () => resolveAssetPath("fonts", "MetroNova-Bold.ttf"),
  medium: () => resolveAssetPath("fonts", "MetroNova-Medium.ttf"),
  regular: () => resolveAssetPath("fonts", "MetroNova-Regular.ttf"),
  light: () => resolveAssetPath("fonts", "MetroNova-Light.ttf"),
  italic: () => resolveAssetPath("fonts", "MetroNova-Italic.ttf"),
  lightItalic: () => resolveAssetPath("fonts", "MetroNova-LightItalic.ttf"),
};

export function defaultBrandLogoPath(): string {
  return resolveAssetPath("cascadia-logo.png");
}

export function readBrandLogoBuffer(): Buffer | null {
  try {
    const p = defaultBrandLogoPath();
    if (fs.existsSync(p)) return fs.readFileSync(p);
  } catch {
    /* ignore */
  }
  return null;
}

// Format cents as "$880" (whole) or "$880.50".
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  if (Number.isInteger(dollars)) return `$${dollars.toLocaleString("en-US")}`;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// "45 X 30" / "12 x 18" -> '45″ X 30″'
export function formatSizeLabel(label: string): string {
  return label
    .trim()
    .replace(/\s*[xX]\s*/g, "\u2033 X ")
    .concat("\u2033");
}

// Pick the featured ChromaLuxe size for a signage card (largest or smallest by
// price). Falls back to any media type if no ChromaLuxe sizes exist.
export function pickFeaturedSize(
  entry: CatalogEntry,
  which: "largest" | "smallest" = "largest",
): CatalogSize | null {
  const chroma = entry.sizes.filter((s) => /chromaluxe/i.test(s.mediaType));
  const pool = chroma.length ? chroma : entry.sizes;
  if (!pool.length) return null;
  const sorted = [...pool].sort((a, b) => a.priceCents - b.priceCents);
  return which === "largest" ? sorted[sorted.length - 1] : sorted[0];
}

export function productUrl(slug: string, baseUrl: string = STORE_BASE_URL): string {
  return `${baseUrl.replace(/\/$/, "")}/store/${slug}`;
}

export async function generateQrBuffer(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 600,
    color: { dark: `#${BRAND.evergreen}`, light: "#FFFFFF" },
  });
}

// Run an async mapper over items with a bounded concurrency so we never hold
// every full-resolution image in flight at once (avoids memory spikes on large
// catalogs). Order of results matches input order.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await mapper(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB safety cap per image

// Guard against SSRF: only allow http(s) to public hosts. Reject private,
// loopback, link-local, and unique-local addresses.
function isDisallowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0") return true;
  // IPv6 loopback / unique-local / link-local
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  // IPv4 literals
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata 169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

// Rewrite a Wix media URL to request a smaller rendition. Full-resolution
// originals (6000px JPEGs, multi-MB PNGs) blow up memory and generation time —
// catalog/signage pages only need ~1600px. Non-Wix URLs are returned unchanged.
export function resizedImageUrl(url: string, maxDim: number = 1600, quality: number = 82): string {
  if (!url || !url.includes("static.wixstatic.com")) return url;
  const base = url.split("?")[0];
  // Already has a transform segment (…/v1/fit|fill|crop/…/file.ext) → replace it.
  const transform = base.match(/\/v1\/(fit|fill|crop)\/[^/]*\/file\.(\w+)$/i);
  if (transform) {
    return base.replace(
      /\/v1\/(fit|fill|crop)\/[^/]*\/file\.(\w+)$/i,
      (_m, _mode, ext) => `/v1/fit/w_${maxDim},h_${maxDim},al_c,q_${quality},enc_auto/file.${ext}`,
    );
  }
  // Raw media URL ending in ~mv2.<ext> → append a fit transform.
  const raw = base.match(/~mv2\.(jpg|jpeg|png|webp|gif)$/i);
  if (raw) {
    return `${base}/v1/fit/w_${maxDim},h_${maxDim},al_c,q_${quality},enc_auto/file.${raw[1]}`;
  }
  return url;
}

// Fetch a remote image (Wix CDN) as a buffer. Returns null on failure so the
// document can still render without the image. When maxDim is set, Wix URLs are
// downscaled to that bound to keep memory and generation time in check.
export async function fetchImageBuffer(url: string, maxDim?: number): Promise<Buffer | null> {
  if (!url) return null;
  try {
    if (url.startsWith("data:")) {
      const b64 = url.split(",")[1] || "";
      const buf = Buffer.from(b64, "base64");
      return buf.length > MAX_IMAGE_BYTES ? null : buf;
    }
    if (maxDim) url = resizedImageUrl(url, maxDim);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (isDisallowedHost(parsed.hostname)) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") || 0);
    if (len && len > MAX_IMAGE_BYTES) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_IMAGE_BYTES) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

// Read PNG/JPEG intrinsic dimensions from a buffer (for aspect-correct layout).
export function imageDimensions(buf: Buffer): { width: number; height: number } | null {
  try {
    // PNG
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    // JPEG
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let offset = 2;
      while (offset < buf.length) {
        if (buf[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buf[offset + 1];
        if (marker >= 0xc0 && marker <= 0xc3) {
          const height = buf.readUInt16BE(offset + 5);
          const width = buf.readUInt16BE(offset + 7);
          return { width, height };
        }
        const len = buf.readUInt16BE(offset + 2);
        offset += 2 + len;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}
