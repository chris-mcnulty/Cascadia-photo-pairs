import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Biography() {
  useSEO({
    title: "Biography",
    description:
      "About Chris McNulty, a landscape and seascape photographer based in the Pacific Northwest.",
  });

  return (
    <PublicLayout heroTitle="Biography">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-gray-800 leading-relaxed">
        <div className="prose prose-lg max-w-none">
          <p>
            I'm Chris McNulty, a landscape and seascape photographer based in the Pacific
            Northwest. I work under the studio name <em>Cascadia Oceanic</em>. My pictures begin
            in the same places — long quiet edges where the land meets the water, where weather
            slows down, and where light arrives in single, careful bursts.
          </p>
          <p>
            I grew up moving between coastlines and small towns. That mix of place and motion
            shaped how I see — I watch for the moments where a scene almost holds still, then I
            try to be patient enough to let it settle. I make most of my images with mid-format
            and full-frame digital cameras, with the occasional aerial vantage when a subject
            asks for it.
          </p>
          <p>
            When I'm not behind a camera, I'm a software engineer and product leader. The site
            you're on is one I built by hand to support my work — including the{" "}
            <Link href="/photo-pairs" className="text-cascadia-green underline">
              Photo Pairs
            </Link>{" "}
            tool that invites you to help curate which images make it into upcoming shows. It's a
            small experiment in using software the way photographers use light: to highlight what
            matters, gently, and only when needed.
          </p>
          <p>
            My work has appeared at the Best of the Northwest art shows in Seattle, the
            Woodinville May Art Walk at Prohibition Cellars, and — beginning in summer 2026 — the
            Bellevue Arts Fair. Prints are produced as ChromaLuxe metal panels for archival
            longevity and in archival paper editions for collectors who prefer traditional
            framing.
          </p>
          <p>
            If you'd like to follow along, you can check the{" "}
            <Link href="/calendar" className="text-cascadia-green underline">
              calendar
            </Link>{" "}
            for upcoming shows, or read the{" "}
            <Link href="/news" className="text-cascadia-green underline">
              news &amp; updates
            </Link>{" "}
            for short notes on what's been happening in the studio.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/portfolio">
            <Button className="bg-cascadia-green hover:bg-green-800">View Portfolio</Button>
          </Link>
          <a href="mailto:hello@chrismcnulty.net">
            <Button variant="outline" className="border-cascadia-green text-cascadia-green">
              Get in Touch
            </Button>
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}
