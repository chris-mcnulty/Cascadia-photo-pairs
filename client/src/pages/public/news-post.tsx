import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "isomorphic-dompurify";
import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";
import { ArrowLeft, ExternalLink } from "lucide-react";

interface PublicPost {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  body: string | null;
  category: string | null;
  author: string | null;
  imageUrl: string | null;
  publishDate: string;
  link: string;
}

export default function NewsPost() {
  const [, params] = useRoute("/news/:slug");
  const slug = params?.slug || "";

  const { data: post, isLoading } = useQuery<PublicPost>({
    queryKey: ["/api/public/news", slug],
    enabled: !!slug,
  });

  useSEO({
    title: post?.title,
    description: post?.description,
    imageUrl: post?.imageUrl || undefined,
  });

  return (
    <PublicLayout heroTitle="News & Updates">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/news"
          className="inline-flex items-center gap-1 text-cascadia-green text-sm mb-6 hover:underline"
          data-testid="link-back-news"
        >
          <ArrowLeft className="w-4 h-4" /> All news
        </Link>
        {isLoading ? (
          <p className="text-gray-500 text-center">Loading…</p>
        ) : !post ? (
          <p className="text-gray-500 text-center">Post not found.</p>
        ) : (
          <article>
            <div className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-2">
              {post.category && <span>{post.category}</span>}
              {post.category && <span>·</span>}
              <time>
                {new Date(post.publishDate).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            </div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-light text-gray-900" data-testid="text-post-title">
              {post.title}
            </h1>
            {post.author && <p className="mt-2 text-sm text-gray-500">By {post.author}</p>}

            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt={post.title}
                className="w-full mt-8 rounded"
                data-testid="img-post-hero"
              />
            )}

            {post.body && /<\w+[^>]*>/.test(post.body) ? (
              <div
                className="prose prose-lg max-w-none mt-8 text-gray-800 leading-relaxed prose-img:rounded prose-a:text-cascadia-green"
                data-testid="post-body-html"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(post.body, {
                    ALLOWED_TAGS: [
                      "p", "br", "strong", "em", "u", "i", "b",
                      "h1", "h2", "h3", "h4", "h5", "h6",
                      "ul", "ol", "li", "blockquote",
                      "a", "img", "figure", "figcaption",
                      "code", "pre", "hr", "span", "div",
                    ],
                    ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "target", "rel"],
                    ALLOW_DATA_ATTR: false,
                  }),
                }}
              />
            ) : (
              <div
                className="prose prose-lg max-w-none mt-8 whitespace-pre-line text-gray-800 leading-relaxed"
                data-testid="post-body-text"
              >
                {post.body || post.description}
              </div>
            )}

            {post.link && (
              <p className="mt-10 text-sm">
                <a
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-cascadia-green hover:underline"
                  data-testid="link-original-post"
                >
                  Read the full post on chrismcnulty.net <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            )}
          </article>
        )}
      </section>
    </PublicLayout>
  );
}
