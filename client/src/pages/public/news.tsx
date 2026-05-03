import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";

interface PublicPost {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  category: string | null;
  author: string | null;
  imageUrl: string | null;
  publishDate: string;
  link: string;
}

export default function News() {
  useSEO({
    title: "News & Updates",
    description: "Recent news, blog posts, and announcements from Chris McNulty.",
  });

  const [activeTab, setActiveTab] = useState<string>("All");

  const { data: posts = [], isLoading } = useQuery<PublicPost[]>({
    queryKey: ["/api/public/news"],
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.category && set.add(p.category));
    return ["All", ...Array.from(set).sort()];
  }, [posts]);

  const filtered = useMemo(
    () => (activeTab === "All" ? posts : posts.filter((p) => p.category === activeTab)),
    [posts, activeTab],
  );

  return (
    <PublicLayout heroTitle="News & Updates">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {!isLoading && categories.length > 1 && (
          <div
            className="flex flex-wrap gap-2 justify-center mb-10 border-b border-gray-200 pb-4"
            role="tablist"
            data-testid="news-category-tabs"
          >
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeTab === cat}
                onClick={() => setActiveTab(cat)}
                className={`px-4 py-1.5 text-sm uppercase tracking-wider rounded transition-colors ${
                  activeTab === cat
                    ? "bg-cascadia-green text-white"
                    : "text-gray-600 hover:text-cascadia-green"
                }`}
                data-testid={`news-tab-${cat.toLowerCase()}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
        {isLoading ? (
          <p className="text-center text-gray-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500">No posts in this category yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((p) => {
              const date = new Date(p.publishDate).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              });
              const href = p.slug ? `/news/${p.slug}` : p.link;
              const isExternal = !p.slug;
              return (
                <article
                  key={p.id}
                  className="group flex flex-col"
                  data-testid={`news-card-${p.slug || p.id}`}
                >
                  {isExternal ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
                      <div className="aspect-[4/3] bg-gray-100 rounded overflow-hidden">
                        {p.imageUrl && (
                          <img
                            src={p.imageUrl}
                            alt={p.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        )}
                      </div>
                    </a>
                  ) : (
                    <Link href={href}>
                      <div className="aspect-[4/3] bg-gray-100 rounded overflow-hidden cursor-pointer">
                        {p.imageUrl && (
                          <img
                            src={p.imageUrl}
                            alt={p.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        )}
                      </div>
                    </Link>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider">
                    {p.category && <span>{p.category}</span>}
                    {p.category && <span>·</span>}
                    <time>{date}</time>
                  </div>
                  <h3 className="mt-1 text-xl font-medium text-gray-900 group-hover:text-cascadia-green">
                    {isExternal ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {p.title}
                      </a>
                    ) : (
                      <Link href={href}>{p.title}</Link>
                    )}
                  </h3>
                  <p className="mt-2 text-gray-700 text-sm line-clamp-3 leading-relaxed">
                    {p.description}
                  </p>
                  {p.author && (
                    <p className="mt-2 text-xs text-gray-500">By {p.author}</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
