import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";
import { Link } from "wouter";
import { BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const WORKS = [
  {
    title: "SharePoint 2013 Consultant's Handbook",
    description:
      "A comprehensive guide for IT professionals and consultants implementing SharePoint 2013 in enterprise environments. Covers architecture, governance, and best practices.",
    type: "Book",
  },
  {
    title: "Technical Articles & Blog Posts",
    description:
      "Years of writing on Microsoft 365, SharePoint, AI, and business transformation — published across Microsoft, AIIM, and the broader tech community.",
    type: "Articles",
  },
  {
    title: "Fiction",
    description: "Fiction coming soon.",
    type: "Coming Soon",
  },
];

export default function BooksPage() {
  useSEO({
    title: "Books & Writing",
    description:
      "Books, articles, and writing by Chris McNulty — from technical SharePoint guides to broader technology and business topics.",
  });

  return (
    <PublicLayout heroTitle="Books & Writing">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="prose prose-lg max-w-none text-gray-700 mb-12">
          <p>
            It starts with blogs and expands into books. Starting with my technical works, this
            is the place to discover me in print. I hold several patents, have authored technical
            books, and have written extensively for the Microsoft and AIIM communities over the
            years. Fiction coming soon.
          </p>
        </div>

        <div className="space-y-6">
          {WORKS.map((w) => (
            <div
              key={w.title}
              className="border border-gray-200 rounded-xl p-6 bg-white flex gap-5"
            >
              <div className="flex-shrink-0 mt-1">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-amber-700" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900">{w.title}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {w.type}
                  </span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{w.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* LinkedIn link for full bibliography */}
        <div className="mt-10 p-5 bg-cascadia-light rounded-xl border border-gray-200">
          <p className="text-gray-700 text-sm mb-3">
            Find the full list of publications, articles, and patents on LinkedIn.
          </p>
          <a
            href="https://www.linkedin.com/in/chrismcnulty"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="bg-cascadia-green hover:bg-green-800 flex items-center gap-2">
              View on LinkedIn <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-100 flex flex-wrap gap-3">
          <Link href="/biography">
            <Button variant="outline" className="border-cascadia-green text-cascadia-green hover:bg-cascadia-green hover:text-white">
              Read Biography
            </Button>
          </Link>
          <Link href="/home">
            <Button variant="ghost">← Back to Home</Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
