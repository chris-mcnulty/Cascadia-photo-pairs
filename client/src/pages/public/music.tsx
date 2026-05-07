import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";
import { Link } from "wouter";
import { Music, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const STREAMING = [
  {
    name: "Spotify",
    href: "https://open.spotify.com/artist/chrismnulty",
    color: "bg-[#1DB954]",
  },
  {
    name: "Apple Music",
    href: "https://music.apple.com/us/artist/chris-mcnulty",
    color: "bg-[#FC3C44]",
  },
  {
    name: "Amazon Music",
    href: "https://music.amazon.com/artists/chris-mcnulty",
    color: "bg-[#00A8E1]",
  },
];

export default function MusicPage() {
  useSEO({
    title: "Music",
    description:
      "Chris McNulty's music — from classical piano to Boston rock bands to solo singer-songwriter. Available on Spotify, Apple Music, and Amazon Music.",
  });

  return (
    <PublicLayout heroTitle="Music">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        {/* Pull-quote */}
        <blockquote className="text-2xl italic font-light text-cascadia-green border-l-4 border-cascadia-green pl-6 mb-12">
          "Subway trains driving east at dawn."
        </blockquote>

        <div className="prose prose-lg max-w-none text-gray-700">
          <p>
            I began my music career as a classical pianist in New York, recognized with the{" "}
            <strong>NYSSMA Allstate award</strong>. After several years in the classical and
            theatre scene, I emerged with Boston rock bands{" "}
            <strong>Famous People</strong> and <strong>The Five</strong>, before embarking on my
            solo singer/songwriter career. I've also sat in on rare occasion with Tom Ashton and
            the Plague.
          </p>
          <p>
            I've played throughout North America for the past several years. I originally hail
            from New York, spent years in and around Boston, Massachusetts, and now make my home
            in the Pacific Northwest near Seattle.
          </p>
          <p>
            Some of my singles are available now, with more coming soon.
          </p>
        </div>

        {/* Streaming links */}
        <div className="mt-10">
          <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4 font-semibold">
            Listen on
          </h2>
          <div className="flex flex-wrap gap-3">
            {STREAMING.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  className={`${s.color} text-white hover:opacity-90 flex items-center gap-2`}
                >
                  <Music className="w-4 h-4" />
                  {s.name}
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </Button>
              </a>
            ))}
          </div>
        </div>

        {/* Cross-links */}
        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-wrap gap-3">
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
