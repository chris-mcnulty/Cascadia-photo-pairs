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
  webVisitors: number;
  socialClicks: number;
  emailOpens: number;
  emailClicks: number;
};

type TopPage = { path: string; views: number; sessions: number; visitors: number; avgViewsPerSession: number };
type SourceRow = { source: string; sessions: number };
type WebRefRow = { host: string; sessions: number };
type SocialRefRow = { platform: string; clicks: number };
type RefBlock = { sources: SourceRow[]; web: WebRefRow[]; social: SocialRefRow[] };
type FunnelStep = { name: string; value: number };
type Voting = {
  pairsViews: number;
  pairsSessions: number;
  votesCast: number;
  pairVotesCast: number;
  votingSessions: number;
  totalSessions: number;
  votingSessionShare: number;
  distinctVoters: number;
  returningVoters: number;
  returningVoterRate: number;
};

function fmt(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function shortDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return s;
  }
}

export default function TrafficDashboard() {
  const [days, setDays] = useState<number>(30);
  const [granularity, setGranularity] = useState<"day" | "hour">("day");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const rangeQs = from ? `from=${encodeURIComponent(from)}${to ? `&to=${encodeURIComponent(to)}` : ""}` : `days=${days}`;
  const rangeKey = from ? `${from}..${to || "now"}` : `${days}d`;

  const headers: Record<string, string> = (() => {
    const sid = localStorage.getItem("admin-session-id");
    const tok = localStorage.getItem("auth-token");
    const h: Record<string, string> = {};
    if (sid) h["x-session-id"] = sid;
    if (tok) h["Authorization"] = `Bearer ${tok}`;
    return h;
  })();

  const refetchInterval = 30_000;
  const fetcher = async <T,>(url: string): Promise<T> => {
    const r = await fetch(url, { headers });
    return (await r.json()) as T;
  };

  const { data: overview } = useQuery<Overview>({
    queryKey: ["/api/admin/analytics/overview", rangeKey],
    queryFn: () => fetcher<Overview>(`/api/admin/analytics/overview?${rangeQs}`),
    refetchInterval,
  });
  const { data: timeline } = useQuery<{ series: TimelinePoint[] }>({
    queryKey: ["/api/admin/analytics/timeline", rangeKey, granularity],
    queryFn: () => fetcher(`/api/admin/analytics/timeline?${rangeQs}&granularity=${granularity}`),
    refetchInterval,
  });
  const { data: topPages } = useQuery<{ rows: TopPage[] }>({
    queryKey: ["/api/admin/analytics/top-pages", rangeKey],
    queryFn: () => fetcher(`/api/admin/analytics/top-pages?${rangeQs}`),
    refetchInterval,
  });
  const { data: referrers } = useQuery<RefBlock>({
    queryKey: ["/api/admin/analytics/referrers", rangeKey],
    queryFn: () => fetcher(`/api/admin/analytics/referrers?${rangeQs}`),
    refetchInterval,
  });
  const { data: funnel } = useQuery<{ steps: FunnelStep[] }>({
    queryKey: ["/api/admin/analytics/funnel", rangeKey],
    queryFn: () => fetcher(`/api/admin/analytics/funnel?${rangeQs}`),
    refetchInterval,
  });
  const { data: voting } = useQuery<Voting>({
    queryKey: ["/api/admin/analytics/voting", rangeKey],
    queryFn: () => fetcher(`/api/admin/analytics/voting?${rangeQs}`),
    refetchInterval,
  });

  function downloadCsv(filename: string, headerRow: string[], rows: Array<Array<string | number>>): void {
    const esc = (v: string | number): string => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headerRow.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const funnelWithDrop = useMemo(() => {
    const steps = funnel?.steps || [];
    const top = steps[0]?.value || 0;
    return steps.map((s, i) => ({
      ...s,
      pctOfTop: top > 0 ? (s.value / top) * 100 : 0,
      dropFromPrev: i > 0 && steps[i - 1].value > 0 ? ((steps[i - 1].value - s.value) / steps[i - 1].value) * 100 : 0,
    }));
  }, [funnel]);

  const series = useMemo(
    () => (timeline?.series || []).map((p) => ({ ...p, label: shortDate(p.bucket) })),
    [timeline],
  );

  const votesPerSession = (() => {
    const total = (voting?.votesCast || 0) + (voting?.pairVotesCast || 0);
    const s = voting?.votingSessions || 0;
    return s > 0 ? total / s : 0;
  })();
  const votingShare = (voting?.votingSessionShare ?? 0) * 100;
  const returningRate = (voting?.returningVoterRate ?? 0) * 100;

  return (
    <div className="space-y-6" data-testid="traffic-dashboard">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-medium text-gray-900 mr-auto">Traffic</h2>
        <Select
          value={from ? "custom" : String(days)}
          onValueChange={(v) => {
            if (v !== "custom") {
              setFrom("");
              setTo("");
              setDays(Number(v));
            }
          }}
        >
          <SelectTrigger className="w-36" data-testid="select-days">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24h</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="date"
          aria-label="From date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border rounded h-9 px-2 text-sm"
          data-testid="input-from-date"
        />
        <input
          type="date"
          aria-label="To date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border rounded h-9 px-2 text-sm"
          data-testid="input-to-date"
        />
        <Select value={granularity} onValueChange={(v) => setGranularity(v as "day" | "hour")}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="hour">Hourly</SelectItem>
          </SelectContent>
        </Select>
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
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Unified timeline</CardTitle>
          <Button
            variant="outline"
            size="sm"
            data-testid="button-export-timeline-csv"
            onClick={() =>
              downloadCsv(
                `timeline-${rangeKey}-${granularity}.csv`,
                ["bucket", "webViews", "webSessions", "webVisitors", "socialClicks", "emailOpens", "emailClicks"],
                (timeline?.series || []).map((p) => [
                  p.bucket,
                  p.webViews,
                  p.webSessions,
                  p.webVisitors,
                  p.socialClicks,
                  p.emailOpens,
                  p.emailClicks,
                ]),
              )
            }
          >
            Export CSV
          </Button>
        </CardHeader>
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

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Sessions &amp; unique visitors (daily)</CardTitle>
          <Button
            variant="outline"
            size="sm"
            data-testid="button-export-sessions-csv"
            onClick={() =>
              downloadCsv(
                `sessions-${rangeKey}.csv`,
                ["bucket", "webSessions", "webVisitors"],
                (timeline?.series || []).map((p) => [p.bucket, p.webSessions, p.webVisitors]),
              )
            }
          >
            Export CSV
          </Button>
        </CardHeader>
        <CardContent style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={20} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="webSessions" name="Sessions" fill="#2a5434" />
              <Bar dataKey="webVisitors" name="Unique visitors" fill="#7a9a82" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Conversion funnel</CardTitle>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-funnel-csv"
              onClick={() =>
                downloadCsv(
                  `funnel-${rangeKey}.csv`,
                  ["step", "sessions", "pctOfTop", "dropFromPrev"],
                  funnelWithDrop.map((s) => [s.name, s.value, s.pctOfTop.toFixed(2), s.dropFromPrev.toFixed(2)]),
                )
              }
            >
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={funnelWithDrop} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2a5434" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-xs mt-3">
              <thead className="text-left text-gray-500">
                <tr>
                  <th>Step</th>
                  <th className="text-right">Sessions</th>
                  <th className="text-right">% of top</th>
                  <th className="text-right">Drop vs prev</th>
                </tr>
              </thead>
              <tbody>
                {funnelWithDrop.map((s, i) => (
                  <tr key={s.name} className="border-t">
                    <td className="py-1">{s.name}</td>
                    <td className="py-1 text-right">{fmt(s.value)}</td>
                    <td className="py-1 text-right">{s.pctOfTop.toFixed(1)}%</td>
                    <td className="py-1 text-right">{i === 0 ? "—" : `${s.dropFromPrev.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Voting engagement</CardTitle>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-voting-csv"
              onClick={() =>
                downloadCsv(
                  `voting-${rangeKey}.csv`,
                  ["metric", "value"],
                  [
                    ["pairs_views", voting?.pairsViews ?? 0],
                    ["pairs_sessions", voting?.pairsSessions ?? 0],
                    ["votes_cast", voting?.votesCast ?? 0],
                    ["pair_votes_cast", voting?.pairVotesCast ?? 0],
                    ["voting_sessions", voting?.votingSessions ?? 0],
                    ["distinct_voters", voting?.distinctVoters ?? 0],
                    ["returning_voters", voting?.returningVoters ?? 0],
                    ["votes_per_voting_session", votesPerSession.toFixed(3)],
                    ["voting_session_share_pct", votingShare.toFixed(2)],
                    ["returning_voter_rate_pct", returningRate.toFixed(2)],
                  ],
                )
              }
            >
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Mini label="/photo-pairs views" value={voting?.pairsViews ?? 0} />
              <Mini label="Voting sessions" value={voting?.votingSessions ?? 0} />
              <Mini label="Votes cast" value={voting?.votesCast ?? 0} />
              <Mini label="Pair votes cast" value={voting?.pairVotesCast ?? 0} />
              <Mini label="Votes / voting session" value={Number(votesPerSession.toFixed(2))} />
              <Mini label="Voting session share" value={Number(votingShare.toFixed(1))} suffix="%" />
              <Mini label="Distinct voters" value={voting?.distinctVoters ?? 0} />
              <Mini label="Returning voter rate" value={Number(returningRate.toFixed(1))} suffix="%" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Top pages</CardTitle>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-pages-csv"
              onClick={() =>
                downloadCsv(
                  `top-pages-${rangeKey}.csv`,
                  ["path", "views", "sessions", "visitors", "avgViewsPerSession"],
                  (topPages?.rows || []).map((r) => [
                    r.path,
                    r.views,
                    r.sessions,
                    r.visitors,
                    r.avgViewsPerSession ?? 0,
                  ]),
                )
              }
            >
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-1">Path</th>
                  <th className="py-1 text-right">Views</th>
                  <th className="py-1 text-right">Sessions</th>
                  <th className="py-1 text-right">Visitors</th>
                  <th className="py-1 text-right">Views/session</th>
                </tr>
              </thead>
              <tbody>
                {(topPages?.rows || []).map((r) => (
                  <tr key={r.path} className="border-t">
                    <td className="py-1 truncate max-w-[280px]">{r.path}</td>
                    <td className="py-1 text-right">{fmt(r.views)}</td>
                    <td className="py-1 text-right">{fmt(r.sessions)}</td>
                    <td className="py-1 text-right">{fmt(r.visitors)}</td>
                    <td className="py-1 text-right">{(r.avgViewsPerSession ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
                {!topPages?.rows?.length && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-gray-400">
                      No views yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Referrers &amp; /go redirects</CardTitle>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-referrers-csv"
              onClick={() => {
                const rows: Array<Array<string | number>> = [];
                for (const s of referrers?.sources || []) rows.push(["source-class", s.source, s.sessions]);
                for (const w of referrers?.web || []) rows.push(["web-host", w.host, w.sessions]);
                for (const g of referrers?.social || []) rows.push(["social-platform", g.platform, g.clicks]);
                downloadCsv(`referrers-${rangeKey}.csv`, ["bucket", "key", "value"], rows);
              }}
            >
              Export CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="font-semibold text-gray-700 mb-1">Source classification</div>
              <table className="w-full text-sm">
                <tbody>
                  {(referrers?.sources || []).map((r) => (
                    <tr key={r.source} className="border-t">
                      <td className="py-1 capitalize">{r.source}</td>
                      <td className="py-1 text-right">{fmt(r.sessions)}</td>
                    </tr>
                  ))}
                  {!referrers?.sources?.length && (
                    <tr>
                      <td className="py-2 text-center text-gray-400">No data yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <div className="font-semibold text-gray-700 mb-1">Web referrers (host)</div>
              <table className="w-full text-sm">
                <tbody>
                  {(referrers?.web || []).slice(0, 15).map((r) => (
                    <tr key={r.host} className="border-t">
                      <td className="py-1">{r.host}</td>
                      <td className="py-1 text-right">{fmt(r.sessions)}</td>
                    </tr>
                  ))}
                  {!referrers?.web?.length && (
                    <tr>
                      <td className="py-2 text-center text-gray-400">No referrers yet</td>
                    </tr>
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
                    <tr>
                      <td className="py-2 text-center text-gray-400">No /go clicks yet</td>
                    </tr>
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
        <div
          className="text-2xl font-bold text-cascadia-green"
          data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {rendered ?? fmt(value)}
        </div>
        <div className="text-sm text-gray-600">{label}</div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div className="text-xl font-bold text-gray-900">
        {fmt(value)}
        {suffix || ""}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
