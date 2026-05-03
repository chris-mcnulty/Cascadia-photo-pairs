import { useQuery } from "@tanstack/react-query";
import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";
import { Calendar as CalendarIcon, MapPin } from "lucide-react";

interface PublicEvent {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  location: string | null;
  venueAddress: string | null;
  startDate: string;
  endDate: string | null;
  imageUrl: string | null;
  ctaUrl: string | null;
}

function fmtRange(start: string, end: string | null) {
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const monthOpts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  if (!e) return s.toLocaleDateString(undefined, monthOpts);
  if (s.toDateString() === e.toDateString())
    return s.toLocaleDateString(undefined, monthOpts);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString(undefined, { month: "long", day: "numeric" })}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString(undefined, monthOpts)} – ${e.toLocaleDateString(undefined, monthOpts)}`;
}

export default function CalendarPage() {
  useSEO({
    title: "Calendar",
    description:
      "Upcoming art shows, exhibitions, and events featuring photography by Chris McNulty.",
  });

  const { data: events = [], isLoading } = useQuery<PublicEvent[]>({
    queryKey: ["/api/public/events"],
  });

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.startDate).getTime() >= now - 24 * 3600 * 1000);
  const past = events.filter((e) => new Date(e.startDate).getTime() < now - 24 * 3600 * 1000);

  return (
    <PublicLayout heroTitle="Calendar">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {isLoading ? (
          <p className="text-center text-gray-500">Loading events…</p>
        ) : (
          <>
            <h2 className="text-2xl font-light text-cascadia-green mb-6 uppercase tracking-wider">
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-gray-600 mb-12">No upcoming events scheduled — check back soon.</p>
            ) : (
              <div className="space-y-6 mb-16">
                {upcoming.map((e) => (
                  <article
                    key={e.id}
                    className="border border-gray-200 rounded-lg p-6 bg-white"
                    data-testid={`event-${e.slug}`}
                  >
                    <div className="flex items-start gap-2 text-cascadia-green mb-1">
                      <CalendarIcon className="w-4 h-4 mt-0.5" />
                      <time className="text-sm font-medium">{fmtRange(e.startDate, e.endDate)}</time>
                    </div>
                    <h3 className="text-xl font-medium text-gray-900">{e.title}</h3>
                    {e.location && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <MapPin className="w-4 h-4" /> {e.location}
                      </p>
                    )}
                    {e.description && (
                      <p className="mt-3 text-gray-700 leading-relaxed">{e.description}</p>
                    )}
                    {e.venueAddress && (
                      <p className="mt-2 text-sm text-gray-500">{e.venueAddress}</p>
                    )}
                    {e.ctaUrl && (
                      <a
                        href={e.ctaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-3 text-sm text-cascadia-green hover:underline"
                      >
                        Event details →
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}

            {past.length > 0 && (
              <>
                <h2 className="text-2xl font-light text-gray-700 mb-6 uppercase tracking-wider">
                  Past Events
                </h2>
                <div className="space-y-3">
                  {past.map((e) => (
                    <div key={e.id} className="border-b border-gray-100 pb-3">
                      <p className="text-sm text-gray-500">{fmtRange(e.startDate, e.endDate)}</p>
                      <p className="text-gray-800">
                        {e.title}
                        {e.location ? ` — ${e.location}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </PublicLayout>
  );
}
