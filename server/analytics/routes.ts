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
import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
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
import { and, desc, eq, gte, lte, sql, inArray } from "drizzle-orm";
import {
  classifyBrowser,
  classifyDevice,
  countryFromHeaders,
  isBotUA,
  isOptedOut,
  newSessionId,
  readSessionCookie,
  setSessionCookie,
  shouldCollectPath,
  visitorHashFor,
  SESSION_TTL_MS,
} from "./middleware";

function clampDays(raw: unknown, def = 30, max = 365): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

function rangeFromQuery(query: Record<string, unknown>): { since: Date; until: Date; days: number } {
  const now = new Date();
  const from = typeof query.from === "string" ? new Date(query.from) : null;
  const to = typeof query.to === "string" ? new Date(query.to) : null;
  if (from && !isNaN(from.getTime())) {
    // For YYYY-MM-DD inputs, extend `to` to end-of-day so the range is inclusive.
    let end: Date = now;
    if (to && !isNaN(to.getTime())) {
      end = /^\d{4}-\d{2}-\d{2}$/.test(String(query.to))
        ? new Date(to.getTime() + 24 * 3600 * 1000 - 1)
        : to;
    }
    const days = Math.max(1, Math.ceil((end.getTime() - from.getTime()) / (24 * 3600 * 1000)));
    return { since: from, until: end, days };
  }
  const days = clampDays(query.days, 30);
  return { since: new Date(now.getTime() - days * 24 * 3600 * 1000), until: now, days };
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
}): Promise<{ sid: string; visitorHash: string; isBot: boolean; device: string; browser: string; country: string | null }> {
  const ua = (req.headers["user-agent"] as string) || "";
  const isBot = isBotUA(ua);
  const device = classifyDevice(ua);
  const browser = classifyBrowser(ua);
  const country = countryFromHeaders(req);
  const visitorHash = await visitorHashFor(req);

  let sid = readSessionCookie(req);
  if (sid) {
    const [existing] = await db.select().from(trafficSessions).where(eq(trafficSessions.id, sid));
    const stale = !existing || (Date.now() - new Date(existing.lastSeenAt).getTime() > SESSION_TTL_MS);
    if (existing && !stale) {
      // Backfill browser/country/device on existing sessions if they were
      // captured before those columns existed (or on a header-less request).
      const patch: Record<string, unknown> = { lastSeenAt: new Date() };
      if (!existing.browser && browser) patch.browser = browser;
      if (!existing.country && country) patch.country = country;
      if (!existing.device && device) patch.device = device;
      await db.update(trafficSessions).set(patch).where(eq(trafficSessions.id, sid));
      setSessionCookie(res, sid);
      return {
        sid,
        visitorHash,
        isBot: existing.isBot,
        device: existing.device || device,
        browser: existing.browser || browser,
        country: existing.country || country,
      };
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
    browser,
    country,
    isBot,
  });
  setSessionCookie(res, sid);
  return { sid, visitorHash, isBot, device, browser, country };
}

/**
 * Express middleware that logs HTML document GETs server-side. This catches
 * non-JS clients, failed hydration, and direct deep-links that the SPA
 * RouteTracker would miss. Filters out admin/api/asset/file paths and bots.
 */
export async function htmlCollectorMiddleware(req: Request, res: Response, next: (err?: unknown) => void): Promise<void> {
  try {
    if (req.method !== "GET") return next();
    const accept = (req.headers["accept"] as string) || "";
    if (!accept.includes("text/html")) return next();
    const path = req.path || "/";
    if (!shouldCollectPath(path)) return next();
    const ua = (req.headers["user-agent"] as string) || "";
    if (isBotUA(ua)) return next();
    if (isOptedOut(req)) return next();
    const referrer = normalizeReferrer(req.headers["referer"]);
    const utm = {
      source: safeStr((req.query as Record<string, unknown>).utm_source, 128),
      medium: safeStr((req.query as Record<string, unknown>).utm_medium, 128),
      campaign: safeStr((req.query as Record<string, unknown>).utm_campaign, 128),
    };
    const { sid, visitorHash, isBot, device, browser, country } =
      await ensureSession(req, res, { path, referrer, utm });
    await db.insert(pageViews).values({
      sessionId: sid,
      visitorHash,
      path,
      referrer,
      utmSource: utm.source,
      utmMedium: utm.medium,
      utmCampaign: utm.campaign,
      device,
      browser,
      country,
      isBot,
      userId: null,
    });
    await db.update(trafficSessions)
      .set({ pageViewCount: sql`${trafficSessions.pageViewCount} + 1`, lastSeenAt: new Date() })
      .where(eq(trafficSessions.id, sid));
  } catch (e) {
    // Never fail the page render over analytics; surface only at warn level.
    console.warn("[analytics] html collector error:", (e as Error).message);
  }
  next();
}

export function registerAnalyticsRoutes(
  app: Express,
  isAuthenticated: RequestHandler,
) {
  app.get("/api/analytics/health", (_req, res) => {
    res.json({
      ok: true,
      ga4MeasurementId: process.env.VITE_GA4_MEASUREMENT_ID || null,
      ga4Configured: !!process.env.VITE_GA4_MEASUREMENT_ID,
    });
  });

  app.get("/api/admin/analytics/health", isAuthenticated, async (_req, res) => {
    try {
      const [pv] = await db.select({ n: sql<number>`count(*)::int` }).from(pageViews);
      const [ev] = await db.select({ n: sql<number>`count(*)::int` }).from(trafficEvents);
      const [se] = await db.select({ n: sql<number>`count(*)::int` }).from(trafficSessions);
      res.json({
        ok: true,
        ga4Configured: !!process.env.VITE_GA4_MEASUREMENT_ID,
        ga4MeasurementId: process.env.VITE_GA4_MEASUREMENT_ID || null,
        totals: { pageViews: pv?.n || 0, trafficEvents: ev?.n || 0, trafficSessions: se?.n || 0 },
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  // ---------------- Ingestion ----------------
  app.post("/api/analytics/page", async (req, res) => {
    try {
      const path = safePath(req.body?.path);
      if (!path) return res.status(400).json({ error: "Invalid path" });
      const ua = (req.headers["user-agent"] as string) || "";
      // Skip bot writes entirely so analytics tables don't bloat with crawler noise.
      if (isBotUA(ua)) return res.json({ ok: true, skipped: "bot" });
      if (isOptedOut(req)) return res.json({ ok: true, skipped: "opt-out" });
      const referrer = normalizeReferrer(req.body?.referrer);
      const utm = {
        source: safeStr(req.body?.utmSource, 128),
        medium: safeStr(req.body?.utmMedium, 128),
        campaign: safeStr(req.body?.utmCampaign, 128),
      };
      const { sid, visitorHash, isBot, device, browser, country } = await ensureSession(req, res, { path, referrer, utm });

      await db.insert(pageViews).values({
        sessionId: sid,
        visitorHash,
        path,
        referrer,
        utmSource: utm.source,
        utmMedium: utm.medium,
        utmCampaign: utm.campaign,
        device,
        browser,
        country,
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
    } catch (e) {
      console.warn("[analytics] /page error:", (e as Error)?.message);
      res.status(200).json({ ok: false }); // never fail the page over analytics
    }
  });

  app.post("/api/analytics/event", async (req, res) => {
    try {
      const ua = (req.headers["user-agent"] as string) || "";
      if (isBotUA(ua)) return res.json({ ok: true, skipped: "bot" });
      if (isOptedOut(req)) return res.json({ ok: true, skipped: "opt-out" });
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
    } catch (e) {
      console.warn("[analytics] /event error:", (e as Error)?.message);
      res.status(200).json({ ok: false });
    }
  });

  // ---------------- Admin reports ----------------
  function sinceDate(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  app.get("/api/admin/analytics/overview", isAuthenticated, async (req, res) => {
    try {
      const { since, until, days } = rangeFromQuery(req.query);
      const includeBots = req.query.includeBots === "1";
      const botFilter = includeBots ? sql`true` : sql`${pageViews.isBot} = false`;

      const [pv] = await db.select({
        n: sql<number>`count(*)::int`,
        sessions: sql<number>`count(distinct ${pageViews.sessionId})::int`,
        visitors: sql<number>`count(distinct ${pageViews.visitorHash})::int`,
      }).from(pageViews).where(and(gte(pageViews.createdAt, since), lte(pageViews.createdAt, until), botFilter));

      const [evt] = await db.select({ n: sql<number>`count(*)::int` })
        .from(trafficEvents).where(and(gte(trafficEvents.createdAt, since), lte(trafficEvents.createdAt, until)));

      // Bot UA filter — symmetric with page_views via ?includeBots=1 toggle.
      const includeBotsOverview = req.query.includeBots === "1";
      const notBotUaSocial = includeBotsOverview ? sql`true` : sql`coalesce(${socialClicks.userAgent}, '') !~* 'bot|crawl|spider|preview|slurp|monitor|fetch|curl|wget|headless|axios|postman|node-fetch'`;
      const notBotUaEmail = includeBotsOverview ? sql`true` : sql`coalesce(${emailCampaignEvents.userAgent}, '') !~* 'bot|crawl|spider|preview|slurp|monitor|fetch|curl|wget|headless|axios|postman|node-fetch'`;

      const [sc] = await db.select({ n: sql<number>`count(*)::int` })
        .from(socialClicks).where(and(gte(socialClicks.clickedAt, since), lte(socialClicks.clickedAt, until), notBotUaSocial));

      const [emailOpens] = await db.select({ n: sql<number>`count(*)::int` })
        .from(emailCampaignEvents)
        .where(and(gte(emailCampaignEvents.occurredAt, since), lte(emailCampaignEvents.occurredAt, until), eq(emailCampaignEvents.eventType, "open"), notBotUaEmail));
      const [emailClicks] = await db.select({ n: sql<number>`count(*)::int` })
        .from(emailCampaignEvents)
        .where(and(gte(emailCampaignEvents.occurredAt, since), lte(emailCampaignEvents.occurredAt, until), eq(emailCampaignEvents.eventType, "click"), notBotUaEmail));

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
    } catch (e) {
      console.error("[analytics] overview error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/admin/analytics/timeline", isAuthenticated, async (req, res) => {
    try {
      const { since, until, days } = rangeFromQuery(req.query);
      const granularity = req.query.granularity === "hour" ? "hour" : "day";
      const trunc = granularity === "hour" ? sql`date_trunc('hour', x.t)` : sql`date_trunc('day', x.t)`;

      const includeBots = req.query.includeBots === "1";

      const pvRows = await db.execute(sql`
        SELECT ${trunc} AS bucket, count(*)::int AS web_views,
               count(distinct x.session_id)::int AS web_sessions,
               count(distinct x.visitor_hash)::int AS web_visitors
          FROM (
            SELECT created_at AS t, session_id, visitor_hash FROM page_views
             WHERE created_at >= ${since} AND created_at <= ${until}
               ${includeBots ? sql`` : sql`AND is_bot = false`}
          ) x
         GROUP BY bucket ORDER BY bucket
      `);
      const botUaPattern = `bot|crawl|spider|preview|slurp|monitor|fetch|curl|wget|headless|axios|postman|node-fetch`;
      const scRows = await db.execute(sql`
        SELECT ${granularity === "hour" ? sql`date_trunc('hour', clicked_at)` : sql`date_trunc('day', clicked_at)`} AS bucket,
               count(*)::int AS social_clicks
          FROM social_clicks
         WHERE clicked_at >= ${since} AND clicked_at <= ${until}
           ${includeBots ? sql`` : sql`AND coalesce(user_agent, '') !~* ${botUaPattern}`}
         GROUP BY bucket ORDER BY bucket
      `);
      const emRows = await db.execute(sql`
        SELECT ${granularity === "hour" ? sql`date_trunc('hour', occurred_at)` : sql`date_trunc('day', occurred_at)`} AS bucket,
               sum(case when event_type = 'open' then 1 else 0 end)::int AS email_opens,
               sum(case when event_type = 'click' then 1 else 0 end)::int AS email_clicks
          FROM email_campaign_events
         WHERE occurred_at >= ${since} AND occurred_at <= ${until}
           ${includeBots ? sql`` : sql`AND coalesce(user_agent, '') !~* ${botUaPattern}`}
         GROUP BY bucket ORDER BY bucket
      `);

      type Row = {
        bucket: string;
        web_views?: number;
        web_sessions?: number;
        web_visitors?: number;
        social_clicks?: number;
        email_opens?: number;
        email_clicks?: number;
      };
      type SqlRow = Record<string, unknown> & { bucket: Date | string };
      const merged = new Map<string, Row>();
      const upsert = (b: Date | string, patch: Partial<Row>) => {
        const key = b instanceof Date ? b.toISOString() : String(b);
        const cur = merged.get(key) || { bucket: key };
        merged.set(key, { ...cur, ...patch });
      };
      for (const r of (pvRows as unknown as { rows: SqlRow[] }).rows) {
        upsert(r.bucket, {
          web_views: Number(r.web_views) || 0,
          web_sessions: Number(r.web_sessions) || 0,
          web_visitors: Number(r.web_visitors) || 0,
        });
      }
      for (const r of (scRows as unknown as { rows: SqlRow[] }).rows) {
        upsert(r.bucket, { social_clicks: Number(r.social_clicks) || 0 });
      }
      for (const r of (emRows as unknown as { rows: SqlRow[] }).rows) {
        upsert(r.bucket, {
          email_opens: Number(r.email_opens) || 0,
          email_clicks: Number(r.email_clicks) || 0,
        });
      }

      const series = Array.from(merged.values())
        .sort((a, b) => a.bucket.localeCompare(b.bucket))
        .map((r) => ({
          bucket: r.bucket,
          webViews: r.web_views || 0,
          webSessions: r.web_sessions || 0,
          webVisitors: r.web_visitors || 0,
          socialClicks: r.social_clicks || 0,
          emailOpens: r.email_opens || 0,
          emailClicks: r.email_clicks || 0,
        }));
      res.json({ days, granularity, series });
    } catch (e) {
      console.error("[analytics] timeline error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/admin/analytics/top-pages", isAuthenticated, async (req, res) => {
    try {
      const { since, until, days } = rangeFromQuery(req.query);
      const limit = clampDays(req.query.limit, 25, 200);
      const rows = await db.select({
        path: pageViews.path,
        views: sql<number>`count(*)::int`,
        sessions: sql<number>`count(distinct ${pageViews.sessionId})::int`,
        visitors: sql<number>`count(distinct ${pageViews.visitorHash})::int`,
        avgViewsPerSession: sql<number>`round(count(*)::numeric / nullif(count(distinct ${pageViews.sessionId}),0), 2)`,
      })
        .from(pageViews)
        .where(and(gte(pageViews.createdAt, since), lte(pageViews.createdAt, until), eq(pageViews.isBot, false)))
        .groupBy(pageViews.path)
        .orderBy(sql`count(*) desc`)
        .limit(limit);
      res.json({ days, rows });
    } catch (e) {
      console.error("[analytics] top-pages error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/admin/analytics/referrers", isAuthenticated, async (req, res) => {
    try {
      const { since, until, days } = rangeFromQuery(req.query);
      const includeBotsReferrers = req.query.includeBots === "1";
      // /go/:slug is a server-side 302 (no HTML collector hit), so tracked-
      // link traffic is surfaced separately via the trackedLinkClicks block
      // below rather than the traffic_sessions classification.
      const classified = await db.execute(sql`
        SELECT
          CASE
            WHEN referrer IS NULL OR referrer = '' THEN 'direct'
            WHEN referrer ~* '(google|bing|duckduckgo|yahoo|ecosia|brave|startpage)\\.' THEN 'search'
            WHEN referrer ~* '(facebook|instagram|twitter|t\\.co|x\\.com|linkedin|reddit|pinterest|tiktok|youtube|threads)' THEN 'social'
            ELSE 'other'
          END AS source,
          count(*)::int AS sessions
        FROM traffic_sessions
        WHERE first_seen_at >= ${since} AND first_seen_at <= ${until}
          ${includeBotsReferrers ? sql`` : sql`AND is_bot = false`}
        GROUP BY source
        ORDER BY sessions DESC
      `);
      const trackedLinkClicksRow = await db.execute(sql`
        SELECT count(*)::int AS sessions
          FROM social_clicks
         WHERE clicked_at >= ${since} AND clicked_at <= ${until}
           ${includeBotsReferrers ? sql`` : sql`AND coalesce(user_agent, '') !~* 'bot|crawl|spider|preview|slurp|monitor|fetch|curl|wget|headless|axios|postman|node-fetch'`}
      `);
      const webRows = await db.execute(sql`
        SELECT
          coalesce(nullif(regexp_replace(referrer, '^https?://([^/]+).*$', '\\1'), ''), '(direct)') AS host,
          count(*)::int AS sessions
        FROM traffic_sessions
        WHERE first_seen_at >= ${since} AND first_seen_at <= ${until}
          ${includeBotsReferrers ? sql`` : sql`AND is_bot = false`}
        GROUP BY host
        ORDER BY sessions DESC
        LIMIT 50
      `);
      const notBotUaSocial = includeBotsReferrers ? sql`true` : sql`coalesce(${socialClicks.userAgent}, '') !~* 'bot|crawl|spider|preview|slurp|monitor|fetch|curl|wget|headless|axios|postman|node-fetch'`;
      const goRows = await db.select({
        platform: socialPosts.platform,
        clicks: sql<number>`count(${socialClicks.id})::int`,
      })
        .from(socialClicks)
        .innerJoin(socialPosts, eq(socialPosts.id, socialClicks.postId))
        .where(and(gte(socialClicks.clickedAt, since), lte(socialClicks.clickedAt, until), notBotUaSocial))
        .groupBy(socialPosts.platform)
        .orderBy(sql`count(${socialClicks.id}) desc`);

      type RefRow = Record<string, unknown>;
      const trackedLinkClicks = ((trackedLinkClicksRow as unknown as { rows: { sessions: number }[] }).rows[0]?.sessions) || 0;
      res.json({
        days,
        sources: (classified as unknown as { rows: RefRow[] }).rows,
        web: (webRows as unknown as { rows: RefRow[] }).rows,
        social: goRows,
        trackedLinkClicks,
      });
    } catch (e) {
      console.error("[analytics] referrers error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/admin/analytics/funnel", isAuthenticated, async (req, res) => {
    try {
      const { since, until, days } = rangeFromQuery(req.query);

      const [step1] = await db.select({ n: sql<number>`count(distinct ${pageViews.sessionId})::int` })
        .from(pageViews)
        .where(and(gte(pageViews.createdAt, since), lte(pageViews.createdAt, until), eq(pageViews.isBot, false)));

      const [step2] = await db.select({ n: sql<number>`count(distinct ${pageViews.sessionId})::int` })
        .from(pageViews)
        .where(and(
          gte(pageViews.createdAt, since),
          lte(pageViews.createdAt, until),
          eq(pageViews.isBot, false),
          sql`(${pageViews.path} = '/store' OR ${pageViews.path} LIKE '/store/%')`,
        ));

      const [step3] = await db.select({ n: sql<number>`count(distinct ${trafficEvents.sessionId})::int` })
        .from(trafficEvents)
        .where(and(gte(trafficEvents.createdAt, since), lte(trafficEvents.createdAt, until), eq(trafficEvents.eventType, "cart_started")));

      const [step4] = await db.select({ n: sql<number>`count(distinct ${trafficEvents.sessionId})::int` })
        .from(trafficEvents)
        .where(and(gte(trafficEvents.createdAt, since), lte(trafficEvents.createdAt, until), eq(trafficEvents.eventType, "checkout_started")));

      const [step5] = await db.select({ n: sql<number>`count(distinct ${trafficEvents.sessionId})::int` })
        .from(trafficEvents)
        .where(and(gte(trafficEvents.createdAt, since), lte(trafficEvents.createdAt, until), eq(trafficEvents.eventType, "order_completed")));

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
    } catch (e) {
      console.error("[analytics] funnel error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/admin/analytics/voting", isAuthenticated, async (req, res) => {
    try {
      const { since, until, days } = rangeFromQuery(req.query as Record<string, unknown>);
      const [pv] = await db.select({
        n: sql<number>`count(*)::int`,
        sessions: sql<number>`count(distinct ${pageViews.sessionId})::int`,
      }).from(pageViews)
        .where(and(
          gte(pageViews.createdAt, since),
          lte(pageViews.createdAt, until),
          eq(pageViews.isBot, false),
          eq(pageViews.path, "/photo-pairs"),
        ));

      // Total non-bot sessions in window — denominator for voting-session share.
      const [allSessions] = await db.select({
        n: sql<number>`count(distinct ${pageViews.sessionId})::int`,
      }).from(pageViews)
        .where(and(
          gte(pageViews.createdAt, since),
          lte(pageViews.createdAt, until),
          eq(pageViews.isBot, false),
        ));

      // Voting metrics derive from votes/pair_votes themselves (which carry
      // session_id + visitor_hash + is_bot), not from a separate client
      // beacon. is_bot=false is enforced everywhere so crawler-generated
      // rows are excluded.
      type CountRow = { n: number };
      const vsRowsRes = await db.execute(sql`
        SELECT count(distinct sid)::int AS n FROM (
          SELECT session_id AS sid FROM votes
           WHERE is_bot = false AND session_id IS NOT NULL
             AND timestamp::timestamptz >= ${since} AND timestamp::timestamptz <= ${until}
          UNION ALL
          SELECT session_id AS sid FROM pair_votes
           WHERE is_bot = false AND session_id IS NOT NULL
             AND timestamp >= ${since} AND timestamp <= ${until}
        ) s
      `);
      const votingSessions = ((vsRowsRes as unknown as { rows: CountRow[] }).rows[0]?.n) || 0;

      const voterRowsRes = await db.execute(sql`
        SELECT count(distinct vh)::int AS n FROM (
          SELECT visitor_hash AS vh FROM votes
           WHERE is_bot = false AND visitor_hash IS NOT NULL
             AND timestamp::timestamptz >= ${since} AND timestamp::timestamptz <= ${until}
          UNION ALL
          SELECT visitor_hash AS vh FROM pair_votes
           WHERE is_bot = false AND visitor_hash IS NOT NULL
             AND timestamp >= ${since} AND timestamp <= ${until}
        ) v
      `);
      const distinctVoters = ((voterRowsRes as unknown as { rows: CountRow[] }).rows[0]?.n) || 0;

      // Returning voter = visitor_hash that has voted in any session prior to
      // its earliest session within the window (i.e. not their first-ever vote).
      const returningVotersRowsRes = await db.execute(sql`
        WITH v AS (
          SELECT visitor_hash, session_id, timestamp::timestamptz AS t FROM votes
           WHERE is_bot = false AND visitor_hash IS NOT NULL
          UNION ALL
          SELECT visitor_hash, session_id, timestamp AS t FROM pair_votes
           WHERE is_bot = false AND visitor_hash IS NOT NULL
        )
        SELECT count(distinct visitor_hash)::int AS n FROM v
         WHERE t >= ${since} AND t <= ${until}
           AND visitor_hash IN (
             SELECT visitor_hash FROM v
              WHERE t < ${since}
           )
      `);
      const returningVoters = ((returningVotersRowsRes as unknown as { rows: CountRow[] }).rows[0]?.n) || 0;

      const vRowsRes = await db.execute(sql`SELECT count(*)::int AS n FROM votes WHERE is_bot = false AND timestamp::timestamptz >= ${since} AND timestamp::timestamptz <= ${until}`);
      const pRowsRes = await db.execute(sql`SELECT count(*)::int AS n FROM pair_votes WHERE is_bot = false AND timestamp >= ${since} AND timestamp <= ${until}`);
      const vrows = (vRowsRes as unknown as { rows: CountRow[] }).rows;
      const prows = (pRowsRes as unknown as { rows: CountRow[] }).rows;

      const totalSessions = allSessions?.n || 0;
      res.json({
        days,
        pairsViews: pv?.n || 0,
        pairsSessions: pv?.sessions || 0,
        votesCast: vrows[0]?.n || 0,
        pairVotesCast: prows[0]?.n || 0,
        votingSessions,
        totalSessions,
        votingSessionShare: totalSessions > 0 ? votingSessions / totalSessions : 0,
        distinctVoters,
        returningVoters,
        returningVoterRate: distinctVoters > 0 ? returningVoters / distinctVoters : 0,
      });
    } catch (e) {
      console.error("[analytics] voting error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });
}
