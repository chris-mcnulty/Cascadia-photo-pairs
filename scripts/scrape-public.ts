// Scrapes chrismcnulty.net (sitemap + product OG metadata + RSS posts) and
// writes scripts/scraped-content.json plus images under attached_assets/scraped/.
// Run: npx tsx scripts/scrape-public.ts

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const BASE = "https://www.chrismcnulty.net";
const OUT_DIR = "attached_assets/scraped";
const MANIFEST = "scripts/scraped-content.json";

interface ScrapedProduct {
  slug: string;
  url: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  localImage: string | null;
}

interface ScrapedPost {
  slug: string;
  url: string;
  title: string;
  description: string;
  bodyHtml: string;
  pubDate: string;
  author: string | null;
  category: string | null;
  imageUrl: string | null;
}

interface Manifest {
  scrapedAt: string;
  baseUrl: string;
  products: ScrapedProduct[];
  posts: ScrapedPost[];
  events: { title: string; startDate: string; endDate: string | null; venue: string }[];
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "ChrisMcNultyMigrator/1.0" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

function extractMatches(xml: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function slugFromUrl(url: string): string {
  const parts = url.replace(/\/$/, "").split("/");
  return parts[parts.length - 1].toLowerCase();
}

async function downloadImage(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(join(OUT_DIR, "products"), { recursive: true });
    const fs = await import("fs");
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

async function scrapeProductPage(url: string): Promise<ScrapedProduct> {
  const slug = slugFromUrl(url);
  try {
    const html = await fetchText(url);
    const ogImage = /property=["']og:image["']\s+content=["']([^"']+)["']/.exec(html)?.[1] || null;
    const ogTitle = /property=["']og:title["']\s+content=["']([^"']+)["']/.exec(html)?.[1] || null;
    const ogDesc =
      /property=["']og:description["']\s+content=["']([^"']+)["']/.exec(html)?.[1] || null;

    let localImage: string | null = null;
    if (ogImage) {
      const dest = join(OUT_DIR, "products", `${slug}.jpg`);
      if (await downloadImage(ogImage, dest)) localImage = dest;
    }
    return { slug, url, title: ogTitle, description: ogDesc, ogImage, localImage };
  } catch (err) {
    console.warn(`scrape product failed for ${url}:`, err);
    return { slug, url, title: null, description: null, ogImage: null, localImage: null };
  }
}

function parseRssItems(xml: string): ScrapedPost[] {
  const items: ScrapedPost[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag: string) =>
      new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`).exec(block)?.[1]?.trim() || "";
    const title = get("title");
    const link = get("link");
    const description = get("description");
    const bodyHtml = get("content:encoded") || description;
    const pubDate = get("pubDate");
    const author = get("dc:creator") || null;
    const category = get("category") || null;
    const slug = slugFromUrl(link);
    const imageUrl = /<img[^>]+src=["']([^"']+)["']/.exec(bodyHtml)?.[1] || null;
    if (slug && title) {
      items.push({ slug, url: link, title, description, bodyHtml, pubDate, author, category, imageUrl });
    }
  }
  return items;
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log("[1/4] Fetching sitemap…");
  const sitemap = await fetchText(`${BASE}/sitemap.xml`);
  const allUrls = extractMatches(sitemap, /<loc>([^<]+)<\/loc>/g);
  const productUrls = allUrls.filter((u) => u.includes("/product-page/"));
  console.log(`  found ${productUrls.length} product URLs`);

  console.log("[2/4] Scraping product OpenGraph metadata + images…");
  const products: ScrapedProduct[] = [];
  for (const url of productUrls) {
    products.push(await scrapeProductPage(url));
  }

  console.log("[3/4] Fetching RSS for blog post bodies…");
  let posts: ScrapedPost[] = [];
  try {
    const rss = await fetchText(`${BASE}/blog-feed.xml`);
    posts = parseRssItems(rss);
    console.log(`  parsed ${posts.length} posts`);
  } catch (err) {
    console.warn("  RSS fetch failed:", err);
  }

  // Hard-coded events (calendar isn't exposed in sitemap or RSS; pulled
  // from the live site's Calendar page screenshots).
  const events = [
    {
      title: "Best of the Northwest 2025 Fall Show",
      startDate: "2025-11-07",
      endDate: "2025-11-09",
      venue: "Magnuson Park Hangar 30, Seattle WA",
    },
    {
      title: "Woodinville May Art Walk",
      startDate: "2026-05-09",
      endDate: null,
      venue: "Downtown Woodinville WA",
    },
    {
      title: "Bellevue Arts Fair 2026",
      startDate: "2026-07-24",
      endDate: "2026-07-26",
      venue: "Bellevue Downtown Park, Bellevue WA",
    },
  ];

  const manifest: Manifest = {
    scrapedAt: new Date().toISOString(),
    baseUrl: BASE,
    products,
    posts,
    events,
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`[4/4] Wrote manifest -> ${MANIFEST}`);
  console.log(
    `Done. ${products.length} products, ${posts.length} posts, ${events.length} events.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
