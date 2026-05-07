import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Menu, X, Mail, Globe, ChevronDown } from "lucide-react";
import { FaInstagram, FaFacebookF, FaLinkedinIn } from "react-icons/fa6";
import { useCart } from "@/contexts/cart-context";
const HERO_PHOTO_URL = "/hero-photo.jpg";

const PRIMARY_NAV: { label: string; href: string }[] = [
  { label: "Home", href: "/home" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Store", href: "/store" },
  { label: "Calendar", href: "/calendar" },
  { label: "Biography", href: "/biography" },
];

const PAIRS_NAV: { label: string; href: string }[] = [
  { label: "Photo Pairs", href: "/" },
  { label: "Leaderboard", href: "/leaderboard" },
];

const MORE_NAV: { label: string; href: string }[] = [
  { label: "News & Updates", href: "/news" },
  { label: "Music", href: "/music" },
  { label: "Books & Writing", href: "/books" },
  { label: "Podcasts", href: "/podcasts" },
  { label: "Professional", href: "/professional" },
];

function useAuth() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Admin session takes priority (MFA-based admin login)
    if (localStorage.getItem("admin-session-id")) {
      setIsAuthed(true);
      setIsAdmin(true);
      return;
    }
    const token = localStorage.getItem("auth-token");
    if (!token) return;
    fetch("/api/auth/user", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((u) => {
        if (!u) return;
        setIsAuthed(true);
        if (u.isAdmin || u.isMasterAdmin) setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  return { isAuthed, isAdmin };
}

interface PublicLayoutProps {
  children: ReactNode;
  /** When true, the mountain hero shows above the page; otherwise a slim banner */
  showHero?: boolean;
  heroTitle?: string;
  /** When true, child content is rendered without the standard footer margin
   *  so embedded full-bleed pages (e.g. the voting Photo Pairs page) sit
   *  flush against the public chrome. */
  contentBleed?: boolean;
}

export default function PublicLayout({
  children,
  showHero = true,
  heroTitle,
  contentBleed = false,
}: PublicLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pairsOpen, setPairsOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const pairsRef = useRef<HTMLDivElement>(null);
  const { count } = useCart();
  const { isAuthed, isAdmin } = useAuth();

  const adminItems = isAdmin ? [{ label: "Admin", href: "/admin" }] : [];
  const primaryItems = [...PRIMARY_NAV, ...adminItems];
  const allNavItems = [...PRIMARY_NAV, ...PAIRS_NAV, ...MORE_NAV, ...adminItems];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (pairsRef.current && !pairsRef.current.contains(e.target as Node)) setPairsOpen(false);
    }
    if (moreOpen || pairsOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [moreOpen, pairsOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 font-metronova">
      {/* Hero with real photo and wordmark — parallax anchored to top of image (sky) */}
      <header className="relative">
        <div
          className="relative w-full bg-cascadia-green overflow-hidden"
          style={{ minHeight: showHero ? "260px" : "120px" }}
          data-testid="public-hero"
        >
          {/* Background photo — position 35% shows mountains, not just sky */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url('${HERO_PHOTO_URL}')`,
              backgroundPosition: "center 35%",
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              zIndex: 0,
            }}
          />
          {/* Dark overlay for text legibility */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(rgba(10,25,15,0.50), rgba(10,25,15,0.38))",
              zIndex: 1,
            }}
          />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 flex items-start justify-between">
            {/* Top utility row */}
            <div className="flex items-center gap-4 text-white/90 text-sm">
              <a
                href="https://www.instagram.com/chrismcnultynet/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="hover:text-white"
              >
                <FaInstagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="hover:text-white"
              >
                <FaFacebookF className="w-5 h-5" />
              </a>
              <a
                href="https://www.linkedin.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="hover:text-white"
              >
                <FaLinkedinIn className="w-5 h-5" />
              </a>
            </div>

            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-white/90 hover:text-white text-sm font-medium bg-white/10 hover:bg-white/20 border border-white/30 px-3 py-1 rounded transition-colors"
                  data-testid="link-admin-shortcut"
                >
                  Admin Panel
                </Link>
              )}
              {isAuthed ? (
                <Link
                  href="/profile"
                  className="text-white/90 hover:text-white text-sm font-medium underline-offset-4 hover:underline"
                  data-testid="link-profile"
                >
                  My Account
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="text-white/90 hover:text-white text-sm font-medium underline-offset-4 hover:underline"
                  data-testid="link-login"
                >
                  Log In
                </Link>
              )}
              <Link
                href="/cart"
                className="relative text-white/90 hover:text-white"
                data-testid="link-cart"
                aria-label="Cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {count > 0 && (
                  <span
                    className="absolute -top-2 -right-2 bg-white text-cascadia-green text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                    data-testid="text-cart-count"
                  >
                    {count}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Wordmark */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-4 pb-4">
            <Link href="/" data-testid="link-home-wordmark">
              <h1
                className="text-white font-light tracking-wide drop-shadow-md"
                style={{ fontSize: "clamp(2rem, 5vw, 3.75rem)", letterSpacing: "0.04em" }}
              >
                Chris McNulty
              </h1>
            </Link>
            {heroTitle && (
              <p className="mt-2 text-white/95 text-lg sm:text-xl drop-shadow-md">{heroTitle}</p>
            )}
          </div>
        </div>

        {/* Primary nav bar */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="hidden md:flex items-center justify-center gap-6 h-14">
              {/* Home, Portfolio, Store */}
              {PRIMARY_NAV.slice(0, 3).map((item) => {
                const isActive = location === item.href || location.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm tracking-wide uppercase transition-colors ${isActive ? "text-cascadia-green font-semibold border-b-2 border-cascadia-green pb-1" : "text-gray-700 hover:text-cascadia-green"}`}
                    data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* Photo Pairs dropdown (contains Leaderboard) */}
              <div ref={pairsRef} className="relative">
                <button
                  onClick={() => setPairsOpen((o) => !o)}
                  className={`flex items-center gap-1 text-sm tracking-wide uppercase transition-colors ${
                    PAIRS_NAV.some((i) => i.href === "/" ? location === "/" || location === "/photo-pairs" : location === i.href)
                      ? "text-cascadia-green font-semibold border-b-2 border-cascadia-green pb-1"
                      : "text-gray-700 hover:text-cascadia-green"
                  }`}
                  data-testid="nav-photo-pairs"
                  aria-expanded={pairsOpen}
                >
                  Photo Pairs <ChevronDown className={`w-3.5 h-3.5 transition-transform ${pairsOpen ? "rotate-180" : ""}`} />
                </button>
                {pairsOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[160px] z-50">
                    {PAIRS_NAV.map((item) => {
                      const isActive = item.href === "/" ? location === "/" || location === "/photo-pairs" : location === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setPairsOpen(false)}
                          className={`block px-4 py-2 text-sm transition-colors ${isActive ? "text-cascadia-green font-semibold bg-gray-50" : "text-gray-700 hover:text-cascadia-green hover:bg-gray-50"}`}
                          data-testid={`nav-pairs-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Calendar, Biography (+ Admin if applicable) */}
              {[...PRIMARY_NAV.slice(3), ...adminItems].map((item) => {
                const isActive = location === item.href || location.startsWith(item.href + "/");
                const isAdminLink = item.label === "Admin";
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm tracking-wide uppercase transition-colors ${
                      isAdminLink
                        ? isActive ? "text-cascadia-green font-semibold border-b-2 border-cascadia-green pb-1" : "text-cascadia-green font-semibold hover:text-green-800"
                        : isActive ? "text-cascadia-green font-semibold border-b-2 border-cascadia-green pb-1" : "text-gray-700 hover:text-cascadia-green"
                    }`}
                    data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* "More" dropdown for secondary pages */}
              <div ref={moreRef} className="relative">
                <button
                  onClick={() => setMoreOpen((o) => !o)}
                  className={`flex items-center gap-1 text-sm tracking-wide uppercase transition-colors ${
                    MORE_NAV.some((i) => location === i.href || location.startsWith(i.href + "/"))
                      ? "text-cascadia-green font-semibold border-b-2 border-cascadia-green pb-1"
                      : "text-gray-700 hover:text-cascadia-green"
                  }`}
                  data-testid="nav-more"
                  aria-expanded={moreOpen}
                >
                  More <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                </button>
                {moreOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[180px] z-50">
                    {MORE_NAV.map((item) => {
                      const isActive = location === item.href || location.startsWith(item.href + "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            isActive
                              ? "text-cascadia-green font-semibold bg-gray-50"
                              : "text-gray-700 hover:text-cascadia-green hover:bg-gray-50"
                          }`}
                          data-testid={`nav-more-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile nav */}
            <div className="md:hidden flex items-center justify-between h-14">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Open menu"
                className="text-gray-700"
                data-testid="button-mobile-menu"
              >
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <span className="text-sm text-cascadia-green uppercase tracking-wider font-semibold">
                Menu
              </span>
              <div className="w-6" />
            </div>

            {mobileOpen && (
              <div className="md:hidden pb-3 flex flex-col gap-2">
                {allNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm tracking-wide uppercase py-2 px-2 ${
                      item.label === "Admin"
                        ? "text-cascadia-green font-semibold"
                        : "text-gray-700 hover:text-cascadia-green"
                    }`}
                    onClick={() => setMobileOpen(false)}
                    data-testid={`nav-mobile-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer — photo background showing the bottom slice of the image */}
      <footer
        className={contentBleed ? "" : "mt-16"}
        style={{
          position: "relative",
          backgroundImage: `url('${HERO_PHOTO_URL}')`,
          backgroundPosition: "center 85%",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Dark overlay so text stays legible */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(rgba(10,22,14,0.72), rgba(10,22,14,0.80))",
            pointerEvents: "none",
          }}
        />
        <div className="relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
            <div>
              <h3 className="font-semibold text-white mb-3">Chris McNulty</h3>
              <p className="text-white/70 leading-relaxed">
                Landscape and seascape photography from the Pacific Northwest and beyond.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-3">Explore</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/portfolio" className="text-white/70 hover:text-white">
                    Portfolio
                  </Link>
                </li>
                <li>
                  <Link href="/store" className="text-white/70 hover:text-white">
                    Store
                  </Link>
                </li>
                <li>
                  <Link href="/" className="text-white/70 hover:text-white">
                    Photo Pairs
                  </Link>
                </li>
                <li>
                  <Link href="/leaderboard" className="text-white/70 hover:text-white">
                    Leaderboard
                  </Link>
                </li>
                <li>
                  <Link href="/calendar" className="text-white/70 hover:text-white">
                    Calendar
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-3">About</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/biography" className="text-white/70 hover:text-white">
                    Biography
                  </Link>
                </li>
                <li>
                  <Link href="/news" className="text-white/70 hover:text-white">
                    News &amp; Updates
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-3">Contact</h3>
              <ul className="space-y-2 text-white/70">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <a href="mailto:hello@chrismcnulty.net" className="hover:text-white">
                    hello@chrismcnulty.net
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Cascadia Oceanic LLC
                </li>
              </ul>
              <div className="mt-4 flex gap-3">
                <a
                  href="https://www.instagram.com/chrismcnultynet/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="text-white/60 hover:text-white"
                >
                  <FaInstagram className="w-4 h-4" />
                </a>
                <a
                  href="https://www.facebook.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="text-white/60 hover:text-white"
                >
                  <FaFacebookF className="w-4 h-4" />
                </a>
                <a
                  href="https://www.linkedin.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="text-white/60 hover:text-white"
                >
                  <FaLinkedinIn className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/20 py-4 text-center text-xs text-white/50">
            © {new Date().getFullYear()} Cascadia Oceanic LLC. All rights reserved.{" "}
            <Link href="/privacy/analytics" className="hover:text-white underline-offset-4 hover:underline" data-testid="link-privacy-analytics">
              Analytics &amp; Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
