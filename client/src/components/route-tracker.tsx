import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ensureGa4Loaded, trackPageView } from "@/lib/analytics";

/**
 * Mounted once at the app root. Sends one page_view per SPA navigation.
 *
 * The very first route is intentionally skipped on the DB side: the
 * server-side HTML collector already logs the initial document GET, so
 * also posting from the client would double-count entry pages. GA4 still
 * fires for the first route since it has no server-side counterpart.
 */
export default function RouteTracker() {
  const [location] = useLocation();
  const initial = useRef(true);
  useEffect(() => {
    ensureGa4Loaded();
  }, []);
  useEffect(() => {
    const path = location || "/";
    if (path === "/admin" || path.startsWith("/admin/")) {
      initial.current = false;
      return;
    }
    if (initial.current) {
      initial.current = false;
      // GA4 only — server already counted this load.
      trackPageView(path, { skipServer: true });
      return;
    }
    trackPageView(path);
  }, [location]);
  return null;
}
