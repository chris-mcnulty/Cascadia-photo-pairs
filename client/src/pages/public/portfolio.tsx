import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";
import cascadiaLogoPath from "@assets/Cascadia-TP_1754453673312.png";

interface PublicCollection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  heroImageUrl: string | null;
}

export default function Portfolio() {
  useSEO({
    title: "Portfolio",
    description:
      "Browse landscape and seascape photography portfolios by Chris McNulty, organized by collection.",
  });

  const { data: collections = [], isLoading } = useQuery<PublicCollection[]>({
    queryKey: ["/api/public/collections"],
  });

  const portfolioCols = collections.filter(
    (c) => c.slug !== "all-products" && c.slug !== "gifts",
  );

  return (
    <PublicLayout heroTitle="Cascadia Oceanic · Portfolio">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex items-center justify-center gap-3 mb-5">
          <img src={cascadiaLogoPath} alt="Cascadia Oceanic" className="w-10 h-10 rounded-lg object-cover" />
          <h2 className="text-2xl font-semibold text-cascadia-green tracking-wide">Cascadia Oceanic</h2>
        </div>
        <p className="text-center text-gray-700 max-w-3xl mx-auto mb-12">
          A selection of work organized by subject. Each collection grows with the seasons —
          coastal weather, alpine evenings, and quiet urban detail.
        </p>
        {isLoading ? (
          <div className="text-center text-gray-500">Loading collections…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {portfolioCols.map((c) => (
              <Link
                key={c.id}
                href={`/portfolio/${c.slug}`}
                data-testid={`card-portfolio-${c.slug}`}
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
                  <div className="mt-4">
                    <h3 className="text-xl font-medium text-cascadia-green">{c.name}</h3>
                    {c.description && (
                      <p className="text-sm text-gray-600 mt-1">{c.description}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
