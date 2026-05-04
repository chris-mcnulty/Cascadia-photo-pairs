import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";
import cascadiaLogoPath from "@assets/Cascadia-TP_1754453673312.png";

interface PublicCollection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  heroImageUrl: string | null;
  badge: string | null;
  basePriceCents: number | null;
  collectionSlug: string | null;
  aspectRatio: string | null;
}

type SortKey = "newest" | "name" | "price-asc" | "price-desc";
type AspectKey = "all" | "16x9" | "4x3" | "3x2";
type ProductTypeKey = "all" | "print" | "gift";
type SizeKey = "all" | "small" | "medium" | "large";

export default function Store() {
  const [, params] = useRoute("/store/category/:slug");
  const activeCategory = params?.slug || "all-products";
  const [sort, setSort] = useState<SortKey>("newest");
  const [aspect, setAspect] = useState<AspectKey>("all");
  const [productType, setProductType] = useState<ProductTypeKey>("all");
  const [size, setSize] = useState<SizeKey>("all");
  const [maxPriceDollars, setMaxPriceDollars] = useState<number>(500);

  const { data: collections = [] } = useQuery<PublicCollection[]>({
    queryKey: ["/api/public/collections"],
  });
  const { data: products = [], isLoading } = useQuery<PublicProduct[]>({
    queryKey: ["/api/public/products", { category: activeCategory }],
    queryFn: async () => {
      const url =
        activeCategory === "all-products"
          ? "/api/public/products"
          : `/api/public/products?category=${encodeURIComponent(activeCategory)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const activeCollection = collections.find((c) => c.slug === activeCategory);

  useSEO({
    title: activeCollection ? `${activeCollection.name} - Store` : "Store",
    description:
      activeCollection?.description ||
      "Original photography prints by Chris McNulty - ChromaLuxe metal prints, archival paper, and gift magnets.",
  });

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (aspect !== "all" && p.aspectRatio !== aspect) return false;
      if (p.basePriceCents != null && p.basePriceCents > maxPriceDollars * 100) return false;
      if (productType === "gift" && p.collectionSlug !== "gifts") return false;
      if (productType === "print" && p.collectionSlug === "gifts") return false;
      if (size !== "all" && p.basePriceCents != null) {
        const cents = p.basePriceCents;
        if (size === "small" && cents > 12000) return false;
        if (size === "medium" && (cents <= 12000 || cents > 25000)) return false;
        if (size === "large" && cents <= 25000) return false;
      }
      return true;
    });
  }, [products, aspect, maxPriceDollars, productType, size]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort === "name") list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "price-asc")
      list.sort((a, b) => (a.basePriceCents ?? 0) - (b.basePriceCents ?? 0));
    else if (sort === "price-desc")
      list.sort((a, b) => (b.basePriceCents ?? 0) - (a.basePriceCents ?? 0));
    return list;
  }, [filtered, sort]);

  return (
    <PublicLayout heroTitle="Cascadia Oceanic · Store">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-2">
        <div className="flex items-center gap-3 mb-1">
          <img src={cascadiaLogoPath} alt="Cascadia Oceanic" className="w-10 h-10 rounded-lg object-cover" />
          <div>
            <h2 className="text-2xl font-semibold text-cascadia-green tracking-wide leading-tight">Cascadia Oceanic</h2>
            <p className="text-sm text-gray-500">ChromaLuxe metal prints &amp; fine-art archival paper by Chris McNulty</p>
          </div>
        </div>
      </div>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        <aside className="space-y-8">
          <div>
            <h3 className="text-sm uppercase tracking-wider text-cascadia-green font-semibold mb-3">
              Browse By
            </h3>
            <ul className="space-y-2 text-sm">
              {collections.map((c) => (
                <li key={c.id}>
                  <Link
                    href={c.slug === "all-products" ? "/store" : `/store/category/${c.slug}`}
                    data-testid={`link-category-${c.slug}`}
                  >
                    <span
                      className={`block px-2 py-1 rounded cursor-pointer ${
                        activeCategory === c.slug
                          ? "bg-cascadia-green text-white"
                          : "text-gray-700 hover:text-cascadia-green hover:bg-gray-50"
                      }`}
                    >
                      {c.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm uppercase tracking-wider text-cascadia-green font-semibold mb-3">
              Product Type
            </h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {([
                { v: "all", label: "All" },
                { v: "print", label: "Prints" },
                { v: "gift", label: "Gifts" },
              ] as const).map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setProductType(t.v)}
                  className={`px-2 py-1 rounded border ${
                    productType === t.v
                      ? "border-cascadia-green text-cascadia-green bg-cascadia-light"
                      : "border-gray-300 text-gray-600 hover:border-gray-500"
                  }`}
                  data-testid={`filter-type-${t.v}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm uppercase tracking-wider text-cascadia-green font-semibold mb-3">
              Size
            </h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {([
                { v: "all", label: "All" },
                { v: "small", label: "Small" },
                { v: "medium", label: "Medium" },
                { v: "large", label: "Large" },
              ] as const).map((s) => (
                <button
                  key={s.v}
                  type="button"
                  onClick={() => setSize(s.v)}
                  className={`px-2 py-1 rounded border ${
                    size === s.v
                      ? "border-cascadia-green text-cascadia-green bg-cascadia-light"
                      : "border-gray-300 text-gray-600 hover:border-gray-500"
                  }`}
                  data-testid={`filter-size-${s.v}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm uppercase tracking-wider text-cascadia-green font-semibold mb-3">
              Aspect
            </h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {(["all", "16x9", "4x3", "3x2"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAspect(a)}
                  className={`px-2 py-1 rounded border ${
                    aspect === a
                      ? "border-cascadia-green text-cascadia-green bg-cascadia-light"
                      : "border-gray-300 text-gray-600 hover:border-gray-500"
                  }`}
                  data-testid={`filter-aspect-${a}`}
                >
                  {a === "all" ? "All" : a.replace("x", ":")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm uppercase tracking-wider text-cascadia-green font-semibold mb-3">
              Max Price
            </h3>
            <input
              type="range"
              min={50}
              max={500}
              step={25}
              value={maxPriceDollars}
              onChange={(e) => setMaxPriceDollars(parseInt(e.target.value, 10))}
              className="w-full"
              data-testid="filter-max-price"
            />
            <p className="text-xs text-gray-600 mt-1">
              Up to ${maxPriceDollars}
            </p>
          </div>
        </aside>

        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-600" data-testid="text-product-count">
              {isLoading ? "Loading…" : `${sorted.length} ${sorted.length === 1 ? "print" : "prints"}`}
            </p>
            <select
              value={sort}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "newest" || v === "name" || v === "price-asc" || v === "price-desc") {
                  setSort(v);
                }
              }}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
              data-testid="select-sort"
            >
              <option value="newest">Newest</option>
              <option value="name">Name (A–Z)</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
          {isLoading ? (
            <div className="text-center text-gray-500 py-12">Loading store…</div>
          ) : sorted.length === 0 ? (
            <div className="text-center text-gray-500 py-12">No prints match your filters.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sorted.map((p) => (
                <Link
                  key={p.id}
                  href={`/store/${p.slug}`}
                  data-testid={`card-store-product-${p.slug}`}
                >
                  <div className="group cursor-pointer">
                    <div className="aspect-square overflow-hidden bg-gray-100 rounded relative">
                      {p.heroImageUrl ? (
                        <img
                          src={p.heroImageUrl}
                          alt={p.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                      {p.badge && (
                        <span
                          className="absolute top-3 left-3 bg-cascadia-green text-white text-xs uppercase tracking-wider px-2 py-1 rounded"
                          data-testid={`badge-${p.slug}`}
                        >
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <h3 className="text-base font-medium text-gray-900">{p.title}</h3>
                      {p.basePriceCents != null && (
                        <p className="text-sm text-cascadia-green font-medium mt-1">
                          From ${(p.basePriceCents / 100).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
