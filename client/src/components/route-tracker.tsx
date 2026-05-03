import { useEffect } from "react";
import { useLocation } from "wouter";
import { ensureGa4Loaded, trackPageView } from "@/lib/analytics";

/**
 * Mounted once at the app root. Sends one page_view (DB + GA4) per route change.
 */
export default function RouteTracker() {
  const [location] = useLocation();
  useEffect(() => {
    ensureGa4Loaded();
  }, []);
  useEffect(() => {
    trackPageView(location || "/");
  }, [location]);
  return null;
}
