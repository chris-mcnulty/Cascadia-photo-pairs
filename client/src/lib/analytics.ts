/**
 * Lightweight analytics client. Sends a beacon to the self-hosted endpoint on
 * every route change AND fires a corresponding GA4 page_view if a measurement
 * id is configured via VITE_GA4_MEASUREMENT_ID.
 */

const GA4_ID = (import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined) || "";

let ga4Loaded = false;

export function ensureGa4Loaded(): void {
  if (ga4Loaded || !GA4_ID || typeof window === "undefined") return;
  ga4Loaded = true;
  const w = window as unknown as { dataLayer?: any[]; gtag?: (...a: any[]) => void };
  w.dataLayer = w.dataLayer || [];
  function gtag(..._args: any[]) {
    w.dataLayer!.push(arguments);
  }
  w.gtag = gtag as any;
  gtag("js", new Date());
  // Disable GA4 auto page_view; we fire it manually on route change
  gtag("config", GA4_ID, { send_page_view: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`;
  document.head.appendChild(s);
}

function utm(): { utmSource?: string; utmMedium?: string; utmCampaign?: string } {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const out: any = {};
  const s = p.get("utm_source");
  const m = p.get("utm_medium");
  const c = p.get("utm_campaign");
  if (s) out.utmSource = s;
  if (m) out.utmMedium = m;
  if (c) out.utmCampaign = c;
  return out;
}

function send(url: string, body: object): void {
  try {
    const data = JSON.stringify(body);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(url, new Blob([data], { type: "application/json" }));
      if (ok) return;
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // analytics never throws
  }
}

let lastPath = "";

export function trackPageView(path: string): void {
  if (typeof window === "undefined") return;
  if (path === lastPath) return;
  lastPath = path;
  const referrer = document.referrer || undefined;
  send("/api/analytics/page", { path, referrer, ...utm() });
  if (GA4_ID) {
    ensureGa4Loaded();
    const w = window as any;
    if (typeof w.gtag === "function") {
      w.gtag("event", "page_view", {
        page_path: path,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }
}

export function trackEvent(eventType: string, opts: { path?: string; metadata?: Record<string, any> } = {}): void {
  if (typeof window === "undefined") return;
  send("/api/analytics/event", {
    eventType,
    path: opts.path || window.location.pathname,
    metadata: opts.metadata || null,
  });
  if (GA4_ID) {
    ensureGa4Loaded();
    const w = window as any;
    if (typeof w.gtag === "function") {
      w.gtag("event", eventType, opts.metadata || {});
    }
  }
}
