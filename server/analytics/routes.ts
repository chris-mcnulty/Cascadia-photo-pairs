/**
 * Traffic analytics: public ingestion + admin reporting.
 *
 * Public:
 *   POST /api/analytics/page   { path, referrer, utm }
 *   POST /api/analytics/event  { eventType, path, metadata }
 *   GET  /api/analytics/health
 *
 * Admin (isAuthenticated):
 *   GET /api/admin/analytics/overview?days=30
 *   GET /api/admin/analytics/timeline?days=30&granularity=day|hour
 *   GET /api/admin/analytics/top-pages?days=30
 *   GET /api/admin/analytics/referrers?days=30
 *   GET /api/admin/analytics/funnel?days=30
 *   GET /api/admin/analytics/voting?days=30
 */
import type { Express, Request, Response } from "express";
import { db } from "../db";
import {
  pageViews,
  trafficEvents,
  trafficSessions,
  socialClicks,
  socialPosts,
  emailCampaignEvents,
  votes,
  pairVotes,
} from "@shared/schema";
import { and, desc, eq, gte, sql, inArray } from "drizzle-orm";
import {
  classifyDevice,
  isBotUA,
  newSessionId,
  readSessionCookie,
  setSessionCookie,
  visitorHashFor,
  SESSION_TTL_MS,
} from "./middleware";

function clampDays(raw: unknown, def = 30, max = 365): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

function safePath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  const s = p.trim().slice(0, 512);
  if (!s.startsWith("/")) return null;
  return s;
}

function safeStr(v: unknown, max = 512): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

/**
 * Reduce a referrer URL to scheme+host only. Strips paths and query strings
 * (which are a common source of leaked PII / OAuth tokens / session ids).
 */
function normalizeReferrer(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`.slice(0, 256);
  } catch {
    return null;
  }
}

/**
 * Tight allow-list for event metadata: object only, max 8 scalar fields,
 * each value capped at 200 chars. Anything else gets dropped silently.
 */
function safeMetadata(raw: unknown): Record<string, string | number | boolean> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= 8) break;
    if (typeof k !== "string" || k.length > 64) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 200);
    else continue;
    count++;
  }
  return count > 0 ? out : null;
}

async function ensureSession(req: Request, res: Response, opts: {
  path?: string | null;
  referrer?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
}): Promise<{ sid: string; visitorHash: string; isBot: boolean; device: string }> {
  const ua = (req.headers["user-agent"] as string) || "";
  const isBot = isBotUA(ua);
  const device = classifyDevice(ua);
  const visitorHash = await visitorHashFor(req);

  let sid = readSessionCookie(req);
  if (sid) {
    const [existing] = await db.select().from(trafficSessions).where(eq(trafficSessions.id, sid));
    const stale = !existing || (Date.now() - new Date(existing.lastSeenAt).getTime() > SESSION_TTL_MS);
    if (existing && !stale) {
      await db.update(trafficSessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(trafficSessions.id, sid));
      setSessionCookie(res, sid);
      return { sid, visitorHash, isBot: existing.isBot, device: existing.device || device };
    }
    sid = undefined;
  }

  sid = newSessionId();
  await db.insert(trafficSessions).values({
    id: sid,
    visitorHash,
    entryPath: opts.path || null,
    referrer: opts.referrer || null,
    utmSource: opts.utm?.source || null,
    utmMedium: opts.utm?.medium || null,
    utmCampaign: opts.utm?.campaign || null,
    device,
    isBot,
  });
  setSessionCookie(res, sid);
  return { sid, visitorHash, isBot, device };
}

export function registerAnalyticsRoutes(
  app: Express,
  isAuthenticated: (req: any, res: any, next: any) => any,
) {
  app.get("/api/analytics/health", (_req, res) => {
    res.json({
      ok: true,
      ga4MeasurementId: process.env.VITE_GA4_MEASUREMENT_ID || null,
      ga4Configured: !!process.env.VITE_GA4_MEASUREMENT_ID,
    });
  });

  // ---------------- Ingestion ----------------
  app.post("/api/analytics/page", async (req, res) => {
    try {
      const path = safePath(req.body?.path);
      if (!path) return res.status(400).json({ error: "Invalid path" });
      const ua = (req.headers["user-agent"] as string) || "";
      // Always record but flag bot views so admins can filter.
      const referrer = normalizeReferrer(req.body?.referrer);
      const utm = {
        source: safeStr(req.body?.utmSource, 128),
        medium: safeStr(req.body?.utmMedium, 128),
        campaign: safeStr(req.body?.utmCampaign, 128),
      };
      const { sid, visitorHash, isBot, device } = await ensureSession(req, res, { path, referrer, utm });

      await db.insert(pageViews).values({
        sessionId: sid,
        visitorHash,
        path,
        referrer,
        utmSource: utm.source,
        utmMedium: utm.medium,
        utmCampaign: utm.campaign,
        device,
        isBot,
        userId: null,
      });
      await db.update(trafficSessions)
        .set({
          pageViewCount: sql`${trafficSessions.pageViewCount} + 1`,
          lastSeenAt: new Date(),
        })
        .where(eq(trafficSessions.id, sid));
      // Avoid leaking the truncated UA-derived data; the client only needs the sid.
      res.json({ ok: true });
    } catch (e: any) {
      console.warn("[analytics] /page error:", e?.message);
      res.status(200).json({ ok: false }); // never fail the page over analytics
    }
  });

  app.post("/api/analytics/event", async (req, res) => {
    try {
      const eventType = safeStr(req.body?.eventType, 64);
      if (!eventType) return res.status(400).json({ error: "eventType required" });
      const allowed = new Set(["cart_started", "checkout_started", "order_completed", "vote_cast", "other"]);
      const type = allowed.has(eventType) ? eventType : "other";
      const path = safePath(req.body?.path) || null;
      const metadata = safeMetadata(req.body?.metadata);
      const { sid } = await ensureSession(req, res, { path });
      await db.insert(trafficEvents).values({
        sessionId: sid,
        eventType: type,
        path,
        metadata,
        userId: null,
      });
      res.json({ ok: true });
    } catch (e: any) {
      console.warn("[analytics] /event error:", e?.message);
      res.status(200).json({ ok: false });
    }
  });

  // ---------------- Admin reports ----------------
  function sinceDate(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  app.get("/api/admin/analytics/overview", isAuthenticated, async (req, res) => {
    try {
      const days = clampDays(req.query.days, 30);
      const since = sinceDate(days);
      const includeBots = req.query.includeBots === "1";
      const botFilter = includeBots ? sql`true` : sql`${pageViews.isBot} = false`;

      const [pv] = await db.select({
        n: sql<number>`count(*)::int`,
        sessions: sql<number>`count(distinct ${pageViews.sessionId})::int`,
        visitors: sql<number>`count(distinct ${pageViews.visitorHash})::int`,
      }).from(pageViews).where(and(gte(pageViews.createdAt, since), botFilter));

      const [evt] = await db.select({ n: sql<number>`count(*)::int` })
        .from(trafficEvents).where(gte(trafficEvents.createdAt, since));

      const [sc] = await db.select({ n: sql<number>`count(*)::int` })
        .from(socialClicks).where(gte(socialClicks.createdAt, since));

      const [emailOpens] = await db.select({ n: sql<number>`count(*)::int` })
        .from(emailCampaignEvents)
        .where(and(gte(emailCampaignEvents.occurredAt, since), eq(emailCampaignEvents.eventType, "open")));
      const [emailClicks] = await db.select({ n: sql<number>`count(*)::int` })
        .from(emailCampaignEvents)
        .where(and(gte(emailCampaignEvents.occurredAt, since), eq(emailCampaignEvents.eventType, "click")));

      res.json({
        days,
        pageViews: pv?.n || 0,
        sessions: pv?.sessions || 0,
        uniqueVisitors: pv?.visitors || 0,
        funnelEvents: evt?.n || 0,
        socialClicks: sc?.n || 0,
        emailOpens: emailOpens?.n || 0,
        emailClicks: emailClicks?.n || 0,
        ga4Configured: !!process.env.VITE_GA4_MEASUREMENT_ID,
      });
    } catch (e: any) {
      console.error("[analytics] overview error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/analytics/timeline", isAuthenticated, async (req, res) => {
    try {
      const days = clampDays(req.query.days, 30);
      const since = sinceDate(days);
      const granularity = req.query.granularity === "hour" ? "hour" : "day";
      const trunc = granularity === "hour" ? sql`date_trunc('hour', x.t)` : sql`date_trunc('day', x.t)`;

      const includeBots = req.query.includeBots === "1";

      const pvRows = await db.execute(sql`
        SELECT ${trunc} AS bucket, count(*)::int AS web_views,
               count(distinct x.session_id)::int AS web_sessions
          FROM (
            SELECT created_at AS t, session_id FROM page_views
             WHERE created_at >= ${since}
               ${includeBots ? sql`` : sql`AND is_bot = false`}
          ) x
         GROUP BY bucket ORDER BY bucket
      `);
      const scRows = await db.execute(sql`
        SELECT ${granularity === "hour" ? sql`date_trunc('hour', created_at)` : sql`date_trunc('day', created_at)`} AS bucket,
               count(*)::int AS social_clicks
          FROM social_clicks
         WHERE created_at >= ${since}
         GROUP BY bucket ORDER BY bucket
      `);
      const emRows = await db.execute(sql`
        SELECT ${granularity === "hour" ? sql`date_trunc('hour', occurred_at)` : sql`date_trunc('day', occurred_at)`} AS bucket,
               sum(case when event_type = 'open' then 1 else 0 end)::int AS email_opens,
               sum(case when event_type = 'click' then 1 else 0 end)::int AS email_clicks
          FROM email_campaign_events
         WHERE occurred_at >= ${since}
         GROUP BY bucket ORDER BY bucket
      `);

      type Row = { bucket: string; web_views?: number; web_sessions?: number; social_clicks?: number; email_opens?: number; email_clicks?: number };
      const merged = new Map<string, Row>();
      const upsert = (b: any, patch: Partial<Row>) => {
        const key = (b instanceof Date ? b.toISOString() : String(b));
        const cur = merged.get(key) || { bucket: key };
        merged.set(key, { ...cur, ...patch });
      };
      for (const r of (pvRows as any).rows as any[]) upsert(r.bucket, { web_views: r.web_views, web_sessions: r.web_sessions });
      for (const r of (scRows as any).rows as any[]) upsert(r.bucket, { social_clicks: r.social_clicks });
      for (const r of (emRows as any).rows as any[]) upsert(r.bucket, { email_opens: r.email_opens, email_clicks: r.email_clicks });

      const series = Array.from(merged.values()).sort((a, b) => a.bucket.localeCompare(b.bucket)).map((r) => ({
        bucket: r.bucket,
        webViews: r.web_views || 0,
        webSessions: r.web_sessions || 0,
        socialClicks: r.social_clicks || 0,
        emailOpens: r.email_opens || 0,
        emailClicks: r.email_clicks || 0,
      }));
      res.json({ days, granularity, series });
    } catch (e: any) {
      console.error("[analytics] timeline error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/analytics/top-pages", isAuthenticated, async (req, res) => {
    try {
      const days = clampDays(req.query.days, 30);
      const since = sinceDate(days);
      const limit = clampDays(req.query.limit, 25, 200);
      const rows = await db.select({
        path: pageViews.path,
        views: sql<number>`count(*)::int`,
        sessions: sql<number>`count(distinct ${pageViews.sessionId})::int`,
        visitors: sql<number>`count(distinct ${pageViews.visitorHash})::int`,
      })
        .from(pageViews)
        .where(and(gte(pageViews.createdAt, since), eq(pageViews.isBot, false)))
        .groupBy(pageViews.path)
        .orderBy(sql`count(*) desc`)
        .limit(limit);
      res.json({ days, rows });
    } catch (e: any) {
      console.error("[analytics] top-pages error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/analytics/referrers", isAuthenticated, async (req, res) => {
    try {
      const days = clampDays(req.query.days, 30);
      const since = sinceDate(days);
      // Web referrers (group by host)
      const webRows = await db.execute(sql`
        SELECT
          coalesce(nullif(regexp_replace(referrer, '^https?://([^/]+).*$', '\\1'), ''), '(direct)') AS host,
          count(*)::int AS sessions
        FROM traffic_sessions
        WHERE first_seen_at >= ${since} AND is_bot = false
        GROUP BY host
        ORDER BY sessions DESC
        LIMIT 50
      `);
      // /go redirects per platform/post
      const goRows = await db.select({
        platform: socialPosts.platform,
        clicks: sql<number>`count(${socialClicks.id})::int`,
      })
        .from(socialClicks)
        .innerJoin(socialPosts, eq(socialPosts.id, socialClicks.postId))
        .where(gte(socialClicks.createdAt, since))
        .groupBy(socialPosts.platform)
        .orderBy(sql`count(${socialClicks.id}) desc`);

      res.json({
        days,
        web: (webRows as any).rows,
        social: goRows,
      });
    } catch (e: any) {
      console.error("[analytics] referrers error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/analytics/funnel", isAuthenticated, async (req, res) => {
    try {
      const days = clampDays(req.query.days, 30);
      const since = sinceDate(days);

      // Step 1: any view
      const [step1] = await db.select({ n: sql<number>`count(distinct ${pageViews.sessionId})::int` })
        .from(pageViews)
        .where(and(gte(pageViews.createdAt, since), eq(pageViews.isBot, false)));

      // Step 2: any view of /store or /store/* or /portfolio
      const [step2] = await db.select({ n: sql<number>`count(distinct ${pageViews.sessionId})::int` })
        .from(pageViews)
        .where(and(
          gte(pageViews.createdAt, since),
          eq(pageViews.isBot, false),
          sql`(${pageViews.path} = '/store' OR ${pageViews.path} LIKE '/store/%')`,
        ));

      // Step 3: cart_started events
      const [step3] = await db.select({ n: sql<number>`count(distinct ${trafficEvents.sessionId})::int` })
        .from(trafficEvents)
        .where(and(gte(trafficEvents.createdAt, since), eq(trafficEvents.eventType, "cart_started")));

      // Step 4: checkout_started events
      const [step4] = await db.select({ n: sql<number>`count(distinct ${trafficEvents.sessionId})::int` })
        .from(trafficEvents)
        .where(and(gte(trafficEvents.createdAt, since), eq(trafficEvents.eventType, "checkout_started")));

      // Step 5: order_completed events
      const [step5] = await db.select({ n: sql<number>`count(distinct ${trafficEvents.sessionId})::int` })
        .from(trafficEvents)
        .where(and(gte(trafficEvents.createdAt, since), eq(trafficEvents.eventType, "order_completed")));

      res.json({
        days,
        steps: [
          { name: "Visits", value: step1?.n || 0 },
          { name: "Store views", value: step2?.n || 0 },
          { name: "Cart started", value: step3?.n || 0 },
          { name: "Checkout started", value: step4?.n || 0 },
          { name: "Order completed", value: step5?.n || 0 },
        ],
      });
    } catch (e: any) {
      console.error("[analytics] funnel error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/analytics/voting", isAuthenticated, async (req, res) => {
    try {
      const days = clampDays(req.query.days, 30);
      const since = sinceDate(days);
      const [pv] = await db.select({
        n: sql<number>`count(*)::int`,
        sessions: sql<number>`count(distinct ${pageViews.sessionId})::int`,
      }).from(pageViews)
        .where(and(
          gte(pageViews.createdAt, since),
          eq(pageViews.isBot, false),
          eq(pageViews.path, "/photo-pairs"),
        ));
      // votes.timestamp is text → cast for comparison
      const vrows = (await db.execute(sql`SELECT count(*)::int AS n FROM votes WHERE timestamp::timestamp >= ${since}`)).rows as any[];
      const prows = (await db.execute(sql`SELECT count(*)::int AS n FROM pair_votes WHERE timestamp >= ${since}`)).rows as any[];

      res.json({
        days,
        pairsViews: pv?.n || 0,
        pairsSessions: pv?.sessions || 0,
        votesCast: vrows[0]?.n || 0,
        pairVotesCast: prows[0]?.n || 0,
      });
    } catch (e: any) {
      console.error("[analytics] voting error:", e);
      res.status(500).json({ error: e.message });
    }
  });
}
