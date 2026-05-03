import { useState, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";
import { ArrowLeft, X, ChevronLeft, ChevronRight } from "lucide-react";

interface PublicCollection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  heroImageUrl: string | null;
}

interface PublicPhoto {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  category: string | null;
  customPurchaseUrl: string | null;
}

export default function PortfolioCollection() {
  const [, params] = useRoute("/portfolio/:slug");
  const slug = params?.slug || "";
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: collection } = useQuery<PublicCollection>({
    queryKey: ["/api/public/collections", slug],
    enabled: !!slug,
  });
  const { data: photos = [], isLoading } = useQuery<PublicPhoto[]>({
    queryKey: ["/api/public/photos", { collection: slug }],
    queryFn: async () => {
      const res = await fetch(`/api/public/photos?collection=${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error("Failed to fetch photos");
      return res.json();
    },
    enabled: !!slug,
  });

  useSEO({
    title: collection ? `${collection.name} Portfolio` : "Portfolio",
    description: collection?.description || undefined,
    imageUrl: collection?.heroImageUrl || undefined,
  });

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight")
        setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
      if (e.key === "ArrowLeft")
        setLightboxIndex((i) =>
          i === null ? null : (i - 1 + photos.length) % photos.length,
        );
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, photos.length]);

  const activePhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <PublicLayout heroTitle={collection?.name || "Portfolio"}>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-1 text-cascadia-green text-sm mb-6 hover:underline"
          data-testid="link-back-portfolio"
        >
          <ArrowLeft className="w-4 h-4" /> All Collections
        </Link>
        {collection?.description && (
          <p className="text-gray-700 max-w-3xl mb-10">{collection.description}</p>
        )}
        {isLoading ? (
          <div className="text-center text-gray-500 py-12">Loading…</div>
        ) : photos.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No photos in this collection yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setLightboxIndex(idx)}
                className="group cursor-zoom-in text-left"
                data-testid={`photo-thumb-${p.id}`}
              >
                <div className="aspect-[4/3] overflow-hidden bg-gray-100 rounded relative">
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium text-gray-900">{p.title}</h3>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
          data-testid="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={activePhoto.title}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
            aria-label="Close"
            data-testid="lightbox-close"
          >
            <X className="w-6 h-6" />
          </button>
          <button
            type="button"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) =>
                i === null ? null : (i - 1 + photos.length) % photos.length,
              );
            }}
            aria-label="Previous"
            data-testid="lightbox-prev"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
            }}
            aria-label="Next"
            data-testid="lightbox-next"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
          <div
            className="max-w-6xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activePhoto.imageUrl}
              alt={activePhoto.title}
              className="max-h-[80vh] w-auto object-contain"
              data-testid="lightbox-image"
            />
            <div className="text-center text-white mt-4">
              <p className="text-lg" data-testid="lightbox-title">{activePhoto.title}</p>
              {activePhoto.description && (
                <p className="text-sm text-white/70 mt-1 max-w-2xl">{activePhoto.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}
