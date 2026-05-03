import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

type Overview = {
  days: number;
  pageViews: number;
  sessions: number;
  uniqueVisitors: number;
  funnelEvents: number;
  socialClicks: number;
  emailOpens: number;
  emailClicks: number;
  ga4Configured: boolean;
};

type TimelinePoint = {
  bucket: string;
  webViews: number;
  webSessions: number;
  socialClicks: number;
  emailOpens: number;
  emailClicks: number;
};

type TopPage = { path: string; views: number; sessions: number; visitors: number };
type RefBlock = { web: Array<{ host: string; sessions: number }>; social: Array<{ platform: string; clicks: number }> };
type FunnelStep = { name: string; value: number };
type Voting = { pairsViews: number; pairsSessions: number; votesCast: number; pairVotesCast: number };

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

function shortDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return s;
  }
}

export default function TrafficDashboard() {
  const [days, setDays] = useState<number>(30);
  const [granularity, setGranularity] = useState<"day" | "hour">("day");

  const headers = (() => {
    const sid = localStorage.getItem("admin-session-id");
    const tok = localStorage.getItem("auth-token");
    const h: Record<string, string> = {};
    if (sid) h["x-session-id"] = sid;
    if (tok) h["Authorization"] = `Bearer ${tok}`;
    return h;
  })();

  const { data: overview } = useQuery<Overview>({
    queryKey: ["/api/admin/analytics/overview", days],
    queryFn: () => fetch(`/api/admin/analytics/overview?days=${days}`, { headers }).then((r) => r.json()),
  });
  const { data: timeline } = useQuery<{ series: TimelinePoint[] }>({
    queryKey: ["/api/admin/analytics/timeline", days, granularity],
    queryFn: () =>
      fetch(`/api/admin/analytics/timeline?days=${days}&granularity=${granularity}`, { headers }).then((r) => r.json()),
  });
  const { data: topPages } = useQuery<{ rows: TopPage[] }>({
    queryKey: ["/api/admin/analytics/top-pages", days],
    queryFn: () => fetch(`/api/admin/analytics/top-pages?days=${days}`, { headers }).then((r) => r.json()),
  });
  const { data: referrers } = useQuery<RefBlock>({
    queryKey: ["/api/admin/analytics/referrers", days],
    queryFn: () => fetch(`/api/admin/analytics/referrers?days=${days}`, { headers }).then((r) => r.json()),
  });
  const { data: funnel } = useQuery<{ steps: FunnelStep[] }>({
    queryKey: ["/api/admin/analytics/funnel", days],
    queryFn: () => fetch(`/api/admin/analytics/funnel?days=${days}`, { headers }).then((r) => r.json()),
  });
  const { data: voting } = useQuery<Voting>({
    queryKey: ["/api/admin/analytics/voting", days],
    queryFn: () => fetch(`/api/admin/analytics/voting?days=${days}`, { headers }).then((r) => r.json()),
  });

  const series = useMemo(
    () => (timeline?.series || []).map((p) => ({ ...p, label: shortDate(p.bucket) })),
    [timeline],
  );

  return (
    <div className="space-y-6" data-testid="traffic-dashboard">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-medium text-gray-900 mr-auto">Traffic</h2>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-32" data-testid="select-days"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24h</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
        <Select value={granularity} onValueChange={(v) => setGranularity(v as "day" | "hour")}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="hour">Hourly</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/admin/analytics/timeline?days=${days}&granularity=${granularity}`} target="_blank" rel="noopener noreferrer">
            JSON
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Page views" value={overview?.pageViews ?? 0} />
        <StatCard label="Sessions" value={overview?.sessions ?? 0} />
        <StatCard label="Unique visitors" value={overview?.uniqueVisitors ?? 0} />
        <StatCard label="Social /go clicks" value={overview?.socialClicks ?? 0} />
        <StatCard label="Email opens" value={overview?.emailOpens ?? 0} />
        <StatCard label="Email clicks" value={overview?.emailClicks ?? 0} />
        <StatCard label="Funnel events" value={overview?.funnelEvents ?? 0} />
        <StatCard
          label="GA4"
          value={overview?.ga4Configured ? 1 : 0}
          rendered={overview?.ga4Configured ? "Configured" : "Not set"}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Unified timeline</CardTitle></CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={20} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="webSessions" name="Web sessions" stroke="#2a5434" dot={false} />
              <Line type="monotone" dataKey="webViews" name="Web views" stroke="#7a9a82" dot={false} />
              <Line type="monotone" dataKey="socialClicks" name="Social clicks" stroke="#d97706" dot={false} />
              <Line type="monotone" dataKey="emailOpens" name="Email opens" stroke="#2563eb" dot={false} />
              <Line type="monotone" dataKey="emailClicks" name="Email clicks" stroke="#9333ea" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Conversion funnel</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={funnel?.steps || []} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} />
                <Tooltip />
                <Bar dataKey="value" fill="#2a5434" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Voting engagement</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Mini label="/photo-pairs views" value={voting?.pairsViews ?? 0} />
              <Mini label="/photo-pairs sessions" value={voting?.pairsSessions ?? 0} />
              <Mini label="Votes cast" value={voting?.votesCast ?? 0} />
              <Mini label="Pair votes cast" value={voting?.pairVotesCast ?? 0} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Top pages</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-1">Path</th>
                  <th className="py-1 text-right">Views</th>
                  <th className="py-1 text-right">Sessions</th>
                  <th className="py-1 text-right">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {(topPages?.rows || []).map((r) => (
                  <tr key={r.path} className="border-t">
                    <td className="py-1 truncate max-w-[280px]">{r.path}</td>
                    <td className="py-1 text-right">{fmt(r.views)}</td>
                    <td className="py-1 text-right">{fmt(r.sessions)}</td>
                    <td className="py-1 text-right">{fmt(r.visitors)}</td>
                  </tr>
                ))}
                {!topPages?.rows?.length && (
                  <tr><td colSpan={4} className="py-3 text-center text-gray-400">No views yet</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Referrers & /go redirects</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="font-semibold text-gray-700 mb-1">Web referrers</div>
              <table className="w-full text-sm">
                <tbody>
                  {(referrers?.web || []).slice(0, 15).map((r) => (
                    <tr key={r.host} className="border-t">
                      <td className="py-1">{r.host}</td>
                      <td className="py-1 text-right">{fmt(r.sessions)}</td>
                    </tr>
                  ))}
                  {!referrers?.web?.length && (
                    <tr><td className="py-2 text-center text-gray-400">No referrers yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <div className="font-semibold text-gray-700 mb-1">Social /go clicks by platform</div>
              <table className="w-full text-sm">
                <tbody>
                  {(referrers?.social || []).map((r) => (
                    <tr key={r.platform} className="border-t">
                      <td className="py-1 capitalize">{r.platform}</td>
                      <td className="py-1 text-right">{fmt(r.clicks)}</td>
                    </tr>
                  ))}
                  {!referrers?.social?.length && (
                    <tr><td className="py-2 text-center text-gray-400">No /go clicks yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, rendered }: { label: string; value: number; rendered?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold text-cascadia-green" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
          {rendered ?? fmt(value)}
        </div>
        <div className="text-sm text-gray-600">{label}</div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xl font-bold text-gray-900">{fmt(value)}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
