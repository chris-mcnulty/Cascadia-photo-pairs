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
  rawCategory: string | null;
  categoryGroup: string;
  imageUrl: string | null;
  customPurchaseUrl: string | null;
  sizes: CatalogSize[];
}

export interface CatalogFacets {
  years: number[];
  categories: string[];
}

export type CatalogCategory = "all" | "seascapes" | "landscapes" | "cityscapes" | "other";
export type CatalogSort = "title" | "year";

export interface CatalogFilters {
  category?: CatalogCategory;
  year?: number | "all";
  sort?: CatalogSort;
  sortOrder?: "asc" | "desc";
}

// Maps raw photo category strings into the public-facing groups used by the
// portfolio. Mirrors the mapping in the public /api/public/photos route.
const CATEGORY_GROUPS: Record<string, string[]> = {
  seascapes: ["Seascapes", "Seascape", "Ocean", "Oceans"],
  landscapes: ["Landscapes", "Landscape", "Mountain", "Mountain ", "Trees", "SunriseSunset"],
  cityscapes: ["Cityscapes", "City", "Neon", "Sign", "Night", "Highway", "Transit", "Houses"],
};

const GROUP_LABELS: Record<string, string> = {
  seascapes: "Seascapes",
  landscapes: "Landscapes",
  cityscapes: "Cityscapes",
  other: "Other",
};

function categoryToGroup(rawCategory: string | null): string {
  if (!rawCategory) return "other";
  for (const [group, values] of Object.entries(CATEGORY_GROUPS)) {
    if (values.some((v) => v.toLowerCase() === rawCategory.trim().toLowerCase())) {
      return group;
    }
  }
  return "other";
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
           ph.category AS "rawCategory",
           ph.original_date AS "originalDate",
           ph.created_at AS "createdAt"
    FROM products p
    JOIN photos ph ON ph.id = p.photo_id
    WHERE p.is_active = true
      AND p.show_on_store = true
      AND p.slug IS NOT NULL
      AND ph.never_for_sale = false
      AND ph.archived = false
    ORDER BY p.photo_id, p.created_at ASC
  `);

  const sizesByRatio = await loadSizesByAspectRatio();

  let entries: CatalogEntry[] = (productRows.rows as any[]).map((r) => {
    const ratioColon = String(r.aspectRatio || "").replace(/x/g, ":");
    const year = extractYear(r.slug, r.title, r.originalDate, r.createdAt);
    const group = categoryToGroup(r.rawCategory);
    return {
      productId: String(r.productId),
      photoId: String(r.photoId),
      slug: String(r.slug),
      title: String(r.title || "Untitled"),
      displayTitle: buildDisplayTitle(String(r.title || "Untitled"), year),
      year,
      description: r.description ? String(r.description) : null,
      rawCategory: r.rawCategory ? String(r.rawCategory) : null,
      categoryGroup: group,
      imageUrl: r.imageUrl ? String(r.imageUrl) : null,
      customPurchaseUrl: r.customPurchaseUrl ? String(r.customPurchaseUrl) : null,
      sizes: sizesByRatio.get(ratioColon) || [],
    };
  });

  // Facets are derived from the full unfiltered set so the UI can offer every
  // available year/category regardless of the current filter.
  const facets: CatalogFacets = {
    years: Array.from(new Set(entries.map((e) => e.year).filter((y): y is number => y !== null))).sort(
      (a, b) => b - a,
    ),
    categories: Array.from(new Set(entries.map((e) => e.categoryGroup))).sort(),
  };

  // Apply filters
  if (filters.category && filters.category !== "all") {
    entries = entries.filter((e) => e.categoryGroup === filters.category);
  }
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

export function categoryGroupLabel(group: string): string {
  return GROUP_LABELS[group] || group;
}
