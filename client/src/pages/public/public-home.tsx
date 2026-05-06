import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/use-seo";
import { ArrowRight, Camera, ShoppingBag, Music, BookOpen, Mic, Briefcase } from "lucide-react";
import cascadiaLogoPath from "@assets/Cascadia-TP_1754453673312.png";

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

const SECTIONS = [
  {
    key: "photography",
    title: "Photography",
    icon: Camera,
    description:
      "I think I bring a different perspective to my work. Whether I'm photographing the exceptional landscapes of the Pacific Northwest, the Atlantic coast, or places in between, I always strive to put the story first.",
    label: "View Portfolio",
    href: "/portfolio",
    external: false,
    accent: "bg-cascadia-green",
  },
  {
    key: "store",
    title: "Store",
    icon: ShoppingBag,
    description:
      "I'm taking my first steps to making my photos more available commercially as Cascadia Oceanic. I love the way metal prints highlight outdoor photography. You can also find me on Etsy.",
    label: "Shop Prints",
    href: "/store",
    external: false,
    accent: "bg-emerald-700",
  },
  {
    key: "music",
    title: "Music",
    icon: Music,
    description:
      "I've written and performed lots of songs. Some are OK, and I've started rediscovering and republishing a few of my favorites. Discover some here, and news about any upcoming performances.",
    label: "Discover Music",
    href: "https://www.chrismcnulty.net/music",
    external: true,
    accent: "bg-slate-700",
  },
  {
    key: "books",
    title: "Books & Writing",
    icon: BookOpen,
    description:
      "It starts with blogs and expands into books. Starting with my technical works, this is the place to discover me in print. Fiction coming soon.",
    label: "Read More",
    href: "https://www.chrismcnulty.net/books-and-writing",
    external: true,
    accent: "bg-amber-800",
  },
  {
    key: "podcasts",
    title: "Podcasts",
    icon: Mic,
    description:
      "Eventually, you get to hear me without PowerPoint and without music. (Maybe an improvement, or a relief, for many!) Check out the Intrazone and Polaris.",
    label: "Listen",
    href: "https://www.chrismcnulty.net/podcasts",
    external: true,
    accent: "bg-violet-700",
  },
  {
    key: "professional",
    title: "Professional",
    icon: Briefcase,
    description:
      "I lead product, technology and marketing teams, and consult with many companies on strategy. I also present at global conferences.",
    label: "Learn More",
    href: "https://www.chrismcnulty.net/professional",
    external: true,
    accent: "bg-gray-700",
  },
];

export default function PublicHome() {
  useSEO({
    title: "Home",
    description:
      "Welcome to chrismcnulty.net — home of Cascadia Oceanic, a landscape and seascape photography gallery and print store by Chris McNulty.",
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

      {/* ── Hello / Intro ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          {/* Text */}
          <div>
            <h2 className="text-5xl font-light text-cascadia-green mb-6">Hello</h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Welcome to my website. It's a chance to get to know me and my work. It's also the
                home of <strong>Cascadia Oceanic</strong> — my online photo gallery and store.
              </p>
              <p>
                It's 2026 — so I'm looking forward to the{" "}
                <strong>Bellevue Arts Fair</strong>, the{" "}
                <strong>Woodinville Art Walk</strong>, and more events coming soon.
              </p>
              <p>
                I'm running an experiment to help you curate my photography. Visit{" "}
                <Link href="/photo-pairs" className="text-cascadia-green underline underline-offset-2 hover:text-green-800">
                  Photo Pairs
                </Link>{" "}
                and select images you prefer. You can vote as often as you like.
              </p>
              <p>
                My life has been a whirlwind of experiences and adventures. From my early days as a
                classical pianist in New York to my roles in technology marketing and consulting,
                I've worn many hats. I've lived in vibrant cities like Boston and now Seattle, each
                place adding its own flavor to my story. That energy has taken me around the world
                to places like Microsoft, John Hancock, Iceland, Singapore, South Africa, and
                London.
              </p>
              <p>
                My love for music, hiking, history and travel creates cherished memories with
                family and friends, especially my partner Michelle, our kids Devin, Nate, Rachel
                and Brenden, our dogs, and my siblings (Tom, Liz, Mark, &amp; Meg). I'm grateful
                for every moment and eagerly look forward to what's next.
              </p>
              <p>
                You can read more in{" "}
                <Link href="/biography" className="text-cascadia-green underline underline-offset-2 hover:text-green-800">
                  my full personal biography
                </Link>
                .
              </p>
            </div>
          </div>

          {/* Portrait / brand card */}
          <div className="flex flex-col items-center gap-6">
            <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-cascadia-light to-gray-100 flex flex-col items-center justify-center py-16 px-8 text-center border border-gray-200">
              <img
                src={cascadiaLogoPath}
                alt="Cascadia Oceanic"
                className="w-24 h-24 rounded-xl object-cover mb-5 shadow-md"
              />
              <h3 className="text-2xl font-semibold text-cascadia-green mb-2">Cascadia Oceanic</h3>
              <p className="text-gray-600 text-sm leading-relaxed max-w-xs">
                Pacific Northwest landscape &amp; seascape photography by Chris McNulty
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
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
          </div>
        </div>
      </section>

      {/* ── Six Sections ── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-light text-center text-gray-900 mb-12 uppercase tracking-wider">
            Explore
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const card = (
                <div className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-300 h-full flex flex-col">
                  <div className={`${sec.accent} h-2 w-full`} />
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`${sec.accent} rounded-lg p-2 text-white`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900">{sec.title}</h3>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed flex-1">{sec.description}</p>
                    <div className="mt-5 flex items-center gap-1 text-sm font-medium text-cascadia-green group-hover:text-green-800 transition-colors">
                      {sec.label} <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );

              return sec.external ? (
                <a
                  key={sec.key}
                  href={sec.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`section-card-${sec.key}`}
                  className="block"
                >
                  {card}
                </a>
              ) : (
                <Link
                  key={sec.key}
                  href={sec.href}
                  data-testid={`section-card-${sec.key}`}
                  className="block"
                >
                  {card}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Portfolio Collections ── */}
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
          <div className="text-center mt-10">
            <Link href="/portfolio">
              <Button className="bg-cascadia-green hover:bg-green-800">
                View Full Portfolio
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── New Arrivals ── */}
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
