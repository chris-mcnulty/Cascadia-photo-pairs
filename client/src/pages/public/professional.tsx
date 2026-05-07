import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";
import { Link } from "wouter";
import { Briefcase, ExternalLink, Award, Users, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

const HIGHLIGHTS = [
  {
    icon: Briefcase,
    title: "Synozur — Strategic Markets",
    description:
      "I lead Strategic Markets at Synozur, advising clients around the world on business, product, and market strategies.",
  },
  {
    icon: Users,
    title: "Microsoft — Senior Director, Product Marketing",
    description:
      "For almost ten years, I was Senior Director of Product Marketing for Microsoft 365, SharePoint Premium, Viva, Syntex, OneDrive, SharePoint, and Stream at Microsoft.",
  },
  {
    icon: Briefcase,
    title: "CTO — Dell & Quest Software",
    description:
      "My experience as CTO includes companies such as Dell and Quest Software, where I drove technical strategy and product direction.",
  },
  {
    icon: Award,
    title: "AIIM Board Member & Treasurer",
    description:
      "I'm Treasurer and a Board member at AIIM, the Association for Intelligent Information Management.",
  },
  {
    icon: Award,
    title: "Microsoft MVP",
    description:
      "First recognized as a SharePoint MVP in 2013 and a Copilot MVP in 2025. Author of the \u201cSharePoint 2013 Consultant\u2019s Handbook\u201d and holder of several patents.",
  },
  {
    icon: Mic,
    title: "Speaker & Author",
    description:
      "I've spoken frequently at events around the globe. Conference sessions available on Sessionize. MBA from Boston College in Finance and Investment Management.",
  },
];

export default function ProfessionalPage() {
  useSEO({
    title: "Professional",
    description:
      "Chris McNulty — senior executive, product visionary, and marketing strategist. Strategic Markets lead at Synozur, former Microsoft Sr. Director, AIIM Board member.",
  });

  return (
    <PublicLayout heroTitle="Professional">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        {/* Lead statement */}
        <div className="bg-cascadia-light rounded-2xl p-8 mb-12 border border-gray-200">
          <h2 className="text-2xl font-semibold text-cascadia-green mb-3">
            I create innovative products and build markets.
          </h2>
          <p className="text-gray-700 leading-relaxed">
            I'm a senior executive, product visionary, and marketing strategist with a proven
            track record of success in leading highly visible global brands at the forefront of
            AI and technology. My passion lies in creating and launching innovative products in
            competitive markets, and building and elevating go-to-market teams across marketing,
            sales, channel, and AR/PR to exceed revenue targets. I'm also an award-winning
            speaker and author for my products.
          </p>
        </div>

        {/* Highlights grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {HIGHLIGHTS.map((h) => {
            const Icon = h.icon;
            return (
              <div
                key={h.title}
                className="border border-gray-200 rounded-xl p-5 bg-white flex gap-4"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-9 h-9 bg-cascadia-light rounded-lg flex items-center justify-center">
                    <Icon className="w-4 h-4 text-cascadia-green" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{h.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{h.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bio paragraph */}
        <div className="prose prose-lg max-w-none text-gray-700 mb-10">
          <p>
            I received my MBA from Boston College in Finance and Investment Management and have
            over twenty years' experience with John Hancock, State Street, GMO and Santander.
            You can get the full story on my LinkedIn page.
          </p>
        </div>

        {/* External links */}
        <div className="flex flex-wrap gap-3 mb-12">
          <a
            href="https://www.linkedin.com/in/chrismcnulty"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="bg-cascadia-green hover:bg-green-800 flex items-center gap-2">
              LinkedIn Profile <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
          <a
            href="https://sessionize.com/chrismcnulty"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="border-cascadia-green text-cascadia-green hover:bg-cascadia-green hover:text-white flex items-center gap-2">
              Conference Sessions <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
          <a
            href="https://www.synozur.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="border-gray-300 text-gray-700 flex items-center gap-2">
              Synozur <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
        </div>

        <div className="pt-8 border-t border-gray-100 flex flex-wrap gap-3">
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
