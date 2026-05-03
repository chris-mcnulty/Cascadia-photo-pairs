import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/use-seo";
import { ArrowRight } from "lucide-react";

interface PublicCollection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  heroImageUrl: string | null;
}

interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  heroImageUrl: string | null;
  badge: string | null;
  basePriceCents: number | null;
}

export default function PublicHome() {
  useSEO({
    title: "Home",
    description:
      "Landscape and seascape photography by Chris McNulty. Original prints from the Pacific Northwest, Iceland, and beyond.",
  });

  const { data: collections = [] } = useQuery<PublicCollection[]>({
    queryKey: ["/api/public/collections"],
  });
  const { data: products = [] } = useQuery<PublicProduct[]>({
    queryKey: ["/api/public/products"],
  });

  const featured = products
    .filter((p) => p.badge === "New!")
    .slice(0, 3);
  const portfolioCols = collections.filter(
    (c) => c.slug !== "all-products" && c.slug !== "gifts",
  );

  return (
    <PublicLayout heroTitle="Photography by Chris McNulty">
      {/* Intro / Hello greeting */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-8 items-center">
          <div className="mx-auto md:mx-0 w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden bg-cascadia-light flex items-center justify-center text-cascadia-green text-5xl font-light">
            CM
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-4xl sm:text-5xl font-light text-cascadia-green mb-4">
              Hello.
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              I'm Chris McNulty — a landscape and seascape photographer based in the Pacific
              Northwest. My work captures coastal mornings, alpine evenings, and the small
              moments where weather and place hold their breath together. Browse the portfolio,
              take home an original print, or help curate the next show through Photo Pairs.
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-3">
          <Link href="/portfolio">
            <Button
              size="lg"
              className="bg-cascadia-green hover:bg-green-800"
              data-testid="button-view-portfolio"
            >
              View Portfolio
            </Button>
          </Link>
          <Link href="/store">
            <Button
              size="lg"
              variant="outline"
              className="border-cascadia-green text-cascadia-green hover:bg-cascadia-green hover:text-white"
              data-testid="button-shop-prints"
            >
              Shop Prints
            </Button>
          </Link>
        </div>
      </section>

      {/* Portfolio collections */}
      <section className="bg-cascadia-light py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-light text-center text-gray-900 mb-12 uppercase tracking-wider">
            Browse by Collection
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {portfolioCols.map((c) => (
              <Link
                key={c.id}
                href={`/portfolio/${c.slug}`}
                data-testid={`card-collection-${c.slug}`}
              >
                <div className="group cursor-pointer">
                  <div className="aspect-[4/3] overflow-hidden bg-gray-100 rounded-lg">
                    {c.heroImageUrl ? (
                      <img
                        src={c.heroImageUrl}
                        alt={c.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200" />
                    )}
                  </div>
                  <div className="mt-4 text-center">
                    <h3 className="text-xl font-medium text-cascadia-green">{c.name}</h3>
                    {c.description && (
                      <p className="mt-1 text-sm text-gray-600 max-w-xs mx-auto">{c.description}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* New arrivals */}
      {featured.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl sm:text-3xl font-light text-gray-900 uppercase tracking-wider">
                New Arrivals
              </h2>
              <Link
                href="/store"
                className="text-cascadia-green hover:text-green-800 text-sm font-medium flex items-center gap-1"
                data-testid="link-shop-all"
              >
                Shop All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {featured.map((p) => (
                <Link
                  key={p.id}
                  href={`/store/${p.slug}`}
                  data-testid={`card-product-${p.slug}`}
                >
                  <div className="group cursor-pointer">
                    <div className="aspect-[4/3] overflow-hidden bg-gray-100 rounded-lg relative">
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
                        <span className="absolute top-3 left-3 bg-cascadia-green text-white text-xs px-2 py-1 rounded">
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <h3 className="text-lg font-medium text-gray-900">{p.title}</h3>
                      {p.basePriceCents != null && (
                        <p className="text-cascadia-green font-medium mt-1">
                          From ${(p.basePriceCents / 100).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
