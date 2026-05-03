// Idempotent seeder: reads scripts/scraped-content.json (produced by
// scrape-public.ts) and upserts collections, news_items, and events into
// the database. Safe to re-run.
//
// Run: npx tsx scripts/seed-from-scrape.ts

import { readFileSync } from "fs";
import { join } from "path";
import { db } from "../server/db";
import { collections, newsItems, events } from "../shared/schema";
import { sql } from "drizzle-orm";

interface Manifest {
  scrapedAt: string;
  baseUrl: string;
  products: Array<{
    slug: string;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    badge?: string | null;
    basePriceCents?: number | null;
    aspectRatio?: string | null;
    collectionSlug?: string | null;
  }>;
  posts: Array<{
    slug: string;
    title: string;
    description?: string | null;
    bodyHtml?: string | null;
    pubDate?: string | null;
    author?: string | null;
    category?: string | null;
    imageUrl?: string | null;
    url?: string | null;
  }>;
  events?: Array<{
    slug: string;
    title: string;
    description?: string | null;
    location?: string | null;
    venueAddress?: string | null;
    startDate: string;
    endDate?: string | null;
    imageUrl?: string | null;
    ctaUrl?: string | null;
  }>;
}

const COLLECTIONS = [
  { slug: "all-products", name: "All Products" },
  { slug: "seascapes", name: "Seascapes" },
  { slug: "landscapes", name: "Landscapes" },
  { slug: "cityscapes", name: "Cityscapes" },
  { slug: "gifts", name: "Gifts" },
];

async function seedCollections() {
  let added = 0;
  for (const c of COLLECTIONS) {
    const r = await db.execute(sql`
      INSERT INTO collections (slug, name, display_order, show_on_portfolio, show_on_store)
      VALUES (${c.slug}, ${c.name}, 0, true, true)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    if ((r.rowCount ?? 0) > 0) added++;
  }
  console.log(`✓ collections: ${added} upserted`);
}

async function seedNews(manifest: Manifest) {
  let added = 0, skipped = 0;
  for (const p of manifest.posts) {
    if (!p.slug || !p.title) { skipped++; continue; }
    const publishDate = p.pubDate ? new Date(p.pubDate) : null;
    if (publishDate && isNaN(publishDate.getTime())) { skipped++; continue; }
    await db.execute(sql`
      INSERT INTO news_items (
        slug, title, description, body, category, author,
        image_url, publish_date, link, is_active
      ) VALUES (
        ${p.slug}, ${p.title}, ${p.description ?? null}, ${p.bodyHtml ?? null},
        ${p.category ?? null}, ${p.author ?? null},
        ${p.imageUrl ?? null}, ${publishDate}, ${p.url ?? null}, true
      )
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        body = EXCLUDED.body,
        category = EXCLUDED.category,
        author = EXCLUDED.author,
        image_url = EXCLUDED.image_url,
        publish_date = EXCLUDED.publish_date,
        link = EXCLUDED.link
    `);
    added++;
  }
  console.log(`✓ news_items: ${added} upserted, ${skipped} skipped`);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

async function seedEvents(manifest: Manifest) {
  if (!manifest.events?.length) {
    console.log("✓ events: none in manifest");
    return;
  }
  let added = 0;
  for (const e of manifest.events) {
    if (!e.title || !e.startDate) continue;
    e.slug = e.slug || slugify(e.title);
    const startDate = new Date(e.startDate);
    const endDate = e.endDate ? new Date(e.endDate) : null;
    if (isNaN(startDate.getTime())) continue;
    await db.execute(sql`
      INSERT INTO events (
        slug, title, description, location, venue_address,
        start_date, end_date, image_url, cta_url, is_active
      ) VALUES (
        ${e.slug}, ${e.title}, ${e.description ?? null}, ${e.location ?? null},
        ${e.venueAddress ?? null}, ${startDate}, ${endDate},
        ${e.imageUrl ?? null}, ${e.ctaUrl ?? null}, true
      )
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        location = EXCLUDED.location,
        venue_address = EXCLUDED.venue_address,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        image_url = EXCLUDED.image_url,
        cta_url = EXCLUDED.cta_url
    `);
    added++;
  }
  console.log(`✓ events: ${added} upserted`);
}

async function seedProducts(manifest: Manifest) {
  if (!manifest.products?.length) {
    console.log("✓ products: none in manifest");
    return;
  }
  // Build a slug→id map for collections so we can FK products to them.
  const cols = await db.execute<{ id: string; slug: string }>(sql`
    SELECT id, slug FROM collections WHERE slug IS NOT NULL
  `);
  const collIdBySlug = new Map<string, string>();
  for (const r of cols.rows) collIdBySlug.set(r.slug, r.id);

  let inserted = 0, updated = 0;
  for (const p of manifest.products) {
    if (!p.slug || !p.title) continue;
    const collectionId = p.collectionSlug ? collIdBySlug.get(p.collectionSlug) ?? null : null;
    const aspect = p.aspectRatio || "3x2";
    const r = await db.execute(sql`
      INSERT INTO products (
        slug, title, description, aspect_ratio, badge, hero_image_url,
        collection_id, base_price_cents, show_on_store, is_active,
        aspect_ratios, created_at, updated_at
      ) VALUES (
        ${p.slug}, ${p.title}, ${p.description ?? null}, ${aspect},
        ${p.badge ?? null}, ${p.imageUrl ?? null},
        ${collectionId}, ${p.basePriceCents ?? null}, true, true,
        ARRAY[${aspect}]::text[], now(), now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = COALESCE(EXCLUDED.description, products.description),
        aspect_ratio = EXCLUDED.aspect_ratio,
        badge = EXCLUDED.badge,
        hero_image_url = COALESCE(EXCLUDED.hero_image_url, products.hero_image_url),
        collection_id = COALESCE(EXCLUDED.collection_id, products.collection_id),
        base_price_cents = COALESCE(EXCLUDED.base_price_cents, products.base_price_cents),
        updated_at = now()
      RETURNING (xmax = 0) AS inserted
    `);
    const wasInsert = (r.rows[0] as { inserted?: boolean })?.inserted;
    if (wasInsert) inserted++; else updated++;
  }
  console.log(`✓ products: ${inserted} inserted, ${updated} updated from manifest`);
}

async function main() {
  const path = join(process.cwd(), "scripts", "scraped-content.json");
  const manifest: Manifest = JSON.parse(readFileSync(path, "utf-8"));
  console.log(`Seeding from manifest dated ${manifest.scrapedAt}`);

  await seedCollections();
  await seedProducts(manifest);
  await seedNews(manifest);
  await seedEvents(manifest);

  console.log("✓ seed-from-scrape complete");
  process.exit(0);
}

main().catch((err) => {
  console.error("seed-from-scrape failed:", err);
  process.exit(1);
});
