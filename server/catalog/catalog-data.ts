import { sql } from "drizzle-orm";
import { db } from "../db";

export interface CatalogSize {
  sizeLabel: string;
  mediaType: string;
  priceCents: number;
}

export interface CatalogEntry {
  productId: string;
  photoId: string;
  slug: string;
  title: string;
  displayTitle: string;
  year: number | null;
  description: string | null;
  collectionId: string | null;
  collectionName: string | null;
  collectionSlug: string | null;
  imageUrl: string | null;
  customPurchaseUrl: string | null;
  sizes: CatalogSize[];
  featuredOverride?: CatalogSize | null;
}

export interface CatalogCollection {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogFacets {
  years: number[];
  collections: CatalogCollection[];
}

export type CatalogSort = "title" | "year";

export interface CatalogFilters {
  collection?: string; // collection slug, or "all"
  year?: number | "all";
  sort?: CatalogSort;
  sortOrder?: "asc" | "desc";
  inStockOnly?: boolean; // legacy — maps to inventoryStatuses: ["in_stock"]
  inventoryStatuses?: string[]; // e.g. ["in_stock", "on_exhibit", "ordered"]; empty/undefined = all
}

// The artwork year is encoded in the product slug (e.g. "trulocks-2020").
// Fall back to a trailing year in the title, then originalDate / createdAt.
function extractYear(
  slug: string | null,
  title: string | null,
  originalDate: Date | string | null,
  createdAt: string | null,
): number | null {
  const fromSlug = slug?.match(/(\d{4})(?!.*\d{4})/);
  if (fromSlug) {
    const y = parseInt(fromSlug[1], 10);
    if (y >= 1900 && y <= 2100) return y;
  }
  const fromTitle = title?.match(/\b(19|20)\d{2}\b/);
  if (fromTitle) return parseInt(fromTitle[0], 10);
  if (originalDate) {
    const y = new Date(originalDate).getFullYear();
    if (!Number.isNaN(y)) return y;
  }
  if (createdAt) {
    const y = new Date(createdAt).getFullYear();
    if (!Number.isNaN(y)) return y;
  }
  return null;
}

// Builds "Title Year" while avoiding duplication when the title already ends
// with the year (e.g. "Modern 2025").
function buildDisplayTitle(title: string, year: number | null): string {
  const clean = title.trim();
  if (year === null) return clean;
  if (new RegExp(`\\b${year}\\b`).test(clean)) return clean;
  return `${clean} ${year}`;
}

async function loadSizesByAspectRatio(): Promise<Map<string, CatalogSize[]>> {
  const rows = await db.execute(sql`
    SELECT ps.aspect_ratio AS "aspectRatio",
           ps.size_label AS "sizeLabel",
           rp.media_type AS "mediaType",
           rp.retail_price AS "priceCents"
    FROM retail_prices rp
    JOIN product_sizes ps ON ps.id = rp.product_size_id
    WHERE rp.is_current = true AND rp.retail_price > 0
    ORDER BY rp.media_type, rp.retail_price ASC
  `);
  const map = new Map<string, CatalogSize[]>();
  for (const r of rows.rows as any[]) {
    const ratio = String(r.aspectRatio || "");
    if (!map.has(ratio)) map.set(ratio, []);
    map.get(ratio)!.push({
      sizeLabel: String(r.sizeLabel),
      mediaType: String(r.mediaType),
      priceCents: Number(r.priceCents),
    });
  }
  return map;
}

export async function getCatalogEntries(
  filters: CatalogFilters = {},
): Promise<{ entries: CatalogEntry[]; facets: CatalogFacets }> {
  const productRows = await db.execute(sql`
    SELECT DISTINCT ON (p.photo_id)
           p.id AS "productId",
           p.photo_id AS "photoId",
           p.slug,
           COALESCE(p.title, ph.title) AS "title",
           COALESCE(p.description, ph.description) AS "description",
           p.aspect_ratio AS "aspectRatio",
           COALESCE(p.hero_image_url, ph.image_url) AS "imageUrl",
           ph.custom_purchase_url AS "customPurchaseUrl",
           ph.original_date AS "originalDate",
           ph.created_at AS "createdAt",
           c.id AS "collectionId",
           c.name AS "collectionName",
           c.slug AS "collectionSlug"
    FROM products p
    JOIN photos ph ON ph.id = p.photo_id
    LEFT JOIN collections c ON c.id = ph.collection_id
    WHERE p.is_active = true
      AND p.show_on_store = true
      AND p.slug IS NOT NULL
      AND ph.archived = false
    ORDER BY p.photo_id, p.created_at ASC
  `);

  const sizesByRatio = await loadSizesByAspectRatio();

  let entries: CatalogEntry[] = (productRows.rows as any[]).map((r) => {
    // Support comma-separated aspect ratios (e.g. "16x9,3x2" for dual-ratio products).
    const ratios = String(r.aspectRatio || "")
      .split(",")
      .map((s) => s.trim().replace(/x/g, ":"))
      .filter(Boolean);
    const allSizes: CatalogSize[] = [];
    const seen = new Set<string>();
    for (const ratio of ratios) {
      for (const s of sizesByRatio.get(ratio) || []) {
        const key = `${s.sizeLabel}|${s.mediaType}`;
        if (!seen.has(key)) { seen.add(key); allSizes.push(s); }
      }
    }
    const year = extractYear(r.slug, r.title, r.originalDate, r.createdAt);
    return {
      productId: String(r.productId),
      photoId: String(r.photoId),
      slug: String(r.slug),
      title: String(r.title || "Untitled"),
      displayTitle: buildDisplayTitle(String(r.title || "Untitled"), year),
      year,
      description: r.description ? String(r.description) : null,
      collectionId: r.collectionId ? String(r.collectionId) : null,
      collectionName: r.collectionName ? String(r.collectionName) : null,
      collectionSlug: r.collectionSlug ? String(r.collectionSlug) : null,
      imageUrl: r.imageUrl ? String(r.imageUrl) : null,
      customPurchaseUrl: r.customPurchaseUrl ? String(r.customPurchaseUrl) : null,
      sizes: allSizes,
    };
  });

  // Facets: unique collections and years across the full unfiltered set.
  const collectionMap = new Map<string, CatalogCollection>();
  for (const e of entries) {
    if (e.collectionId && e.collectionName && e.collectionSlug) {
      collectionMap.set(e.collectionId, {
        id: e.collectionId,
        name: e.collectionName,
        slug: e.collectionSlug,
      });
    }
  }
  const facets: CatalogFacets = {
    years: Array.from(new Set(entries.map((e) => e.year).filter((y): y is number => y !== null))).sort(
      (a, b) => b - a,
    ),
    collections: Array.from(collectionMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };

  // Inventory status filter: restrict to products that have at least one physical
  // item with one of the specified statuses.  Legacy inStockOnly maps to ["in_stock"].
  const statuses: string[] =
    filters.inventoryStatuses && filters.inventoryStatuses.length > 0
      ? filters.inventoryStatuses
      : filters.inStockOnly
        ? ["in_stock"]
        : [];
  if (statuses.length > 0) {
    const statusList = statuses.map((s) => `'${s.replace(/'/g, "''")}'`).join(", ");
    const stockRows = await db.execute(
      sql.raw(
        `SELECT DISTINCT product_id AS "productId" FROM inventory_items WHERE status IN (${statusList})`,
      ),
    );
    const matchIds = new Set((stockRows.rows as any[]).map((r) => String(r.productId)));
    entries = entries.filter((e) => matchIds.has(e.productId));
  }

  // Collection filter
  if (filters.collection && filters.collection !== "all") {
    entries = entries.filter((e) => e.collectionSlug === filters.collection);
  }

  // Year filter
  if (filters.year && filters.year !== "all") {
    entries = entries.filter((e) => e.year === filters.year);
  }

  // Sort
  const order = filters.sortOrder === "desc" ? -1 : 1;
  const sortBy = filters.sort || "title";
  entries.sort((a, b) => {
    if (sortBy === "year") {
      const ay = a.year ?? 0;
      const by = b.year ?? 0;
      if (ay !== by) return (ay - by) * order;
      return a.title.localeCompare(b.title) * order;
    }
    return a.title.localeCompare(b.title) * order;
  });

  return { entries, facets };
}
