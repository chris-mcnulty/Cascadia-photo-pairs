import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";
import { Link } from "wouter";
import { Mic, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const SHOWS = [
  {
    title: "The Intrazone",
    role: "Co-host (guest)",
    description:
      "Mark Kashman started this with me back in 2018 — it's the official podcast that covers all things Microsoft 365. Mark does the work, his partner Lisa does the production, and I just show up from time to time.",
    href: "https://aka.ms/intrazone",
    color: "bg-[#0078d4]",
  },
  {
    title: "Polaris Pathways",
    role: "Host & Producer",
    description:
      "Sponsored by Synozur, and I produce new episodes monthly. Synozur is named for the ancient Greek reference to the North Star, Polaris. Our mission is to illuminate the pathway for business transformation with coverage of business, technology, and even pop culture.",
    href: "https://www.synozur.com/polaris",
    color: "bg-violet-700",
  },
];

export default function PodcastsPage() {
  useSEO({
    title: "Podcasts",
    description:
      "Podcasts by Chris McNulty — The Intrazone (Microsoft 365) and Polaris Pathways (business transformation). Available on Spotify, Apple, and Amazon.",
  });

  return (
    <PublicLayout heroTitle="Podcasts">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="prose prose-lg max-w-none text-gray-700 mb-12">
          <p>
            After years of songwriting, music production, and conference speaking, I'm not afraid
            of a microphone or some audio engineering. I'm particularly proud of these two:
          </p>
        </div>

        <div className="space-y-8">
          {SHOWS.map((show) => (
            <div
              key={show.title}
              className="border border-gray-200 rounded-xl overflow-hidden bg-white"
            >
              <div className={`${show.color} h-2 w-full`} />
              <div className="p-6 flex gap-5">
                <div className="flex-shrink-0 mt-1">
                  <div className={`${show.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                    <Mic className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-xl font-semibold text-gray-900">{show.title}</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {show.role}
                    </span>
                  </div>
                  <p className="text-gray-600 leading-relaxed mb-4">{show.description}</p>
                  <a href={show.href} target="_blank" rel="noopener noreferrer">
                    <Button
                      size="sm"
                      className={`${show.color} text-white hover:opacity-90 flex items-center gap-2`}
                    >
                      Listen <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Where to listen */}
        <div className="mt-10 p-5 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600 font-medium mb-1">Available everywhere you listen:</p>
          <p className="text-sm text-gray-500">Spotify · Apple Podcasts · Amazon Music · Google Podcasts</p>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-100 flex flex-wrap gap-3">
          <Link href="/professional">
            <Button variant="outline" className="border-cascadia-green text-cascadia-green hover:bg-cascadia-green hover:text-white">
              View Professional
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
