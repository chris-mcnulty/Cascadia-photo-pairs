import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Menu, X, Mail, Globe } from "lucide-react";
import { FaInstagram, FaFacebookF, FaLinkedinIn } from "react-icons/fa6";
import { useCart } from "@/contexts/cart-context";

const HERO_MOUNTAIN_URL = "/hero-mountains.png";

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Home", href: "/" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Store", href: "/store" },
  { label: "Photo Pairs", href: "/photo-pairs" },
  { label: "Calendar", href: "/calendar" },
  { label: "Biography", href: "/biography" },
  { label: "News & Updates", href: "/news" },
];

function useUserAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem("auth-token");
    if (!token) return;
    fetch("/api/auth/user", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setIsAuthenticated(r.ok))
      .catch(() => setIsAuthenticated(false));
  }, []);
  return isAuthenticated;
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
  const { count } = useCart();
  const isAuthed = useUserAuth();

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 font-metronova">
      {/* Hero with mountains and wordmark */}
      <header className="relative">
        <div
          className="relative w-full bg-center bg-cover bg-cascadia-green"
          style={{
            backgroundImage: `linear-gradient(rgba(20,40,30,0.45), rgba(20,40,30,0.35)), url('${HERO_MOUNTAIN_URL}')`,
            minHeight: showHero ? "260px" : "120px",
          }}
          data-testid="public-hero"
        >
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
            <div className="hidden md:flex items-center justify-center gap-8 h-14">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/"
                    ? location === "/"
                    : location === item.href || location.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm tracking-wide uppercase transition-colors ${
                      isActive
                        ? "text-cascadia-green font-semibold border-b-2 border-cascadia-green pb-1"
                        : "text-gray-700 hover:text-cascadia-green"
                    }`}
                    data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
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
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm tracking-wide uppercase py-2 px-2 text-gray-700 hover:text-cascadia-green"
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

      <footer className={`bg-cascadia-light border-t border-gray-200 ${contentBleed ? "mt-0" : "mt-16"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Chris McNulty</h3>
            <p className="text-gray-600 leading-relaxed">
              Landscape and seascape photography from the Pacific Northwest and beyond.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Explore</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/portfolio" className="text-gray-600 hover:text-cascadia-green">
                  Portfolio
                </Link>
              </li>
              <li>
                <Link href="/store" className="text-gray-600 hover:text-cascadia-green">
                  Store
                </Link>
              </li>
              <li>
                <Link href="/photo-pairs" className="text-gray-600 hover:text-cascadia-green">
                  Photo Pairs
                </Link>
              </li>
              <li>
                <Link href="/calendar" className="text-gray-600 hover:text-cascadia-green">
                  Calendar
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">About</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/biography" className="text-gray-600 hover:text-cascadia-green">
                  Biography
                </Link>
              </li>
              <li>
                <Link href="/news" className="text-gray-600 hover:text-cascadia-green">
                  News &amp; Updates
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <a href="mailto:hello@chrismcnulty.net" className="hover:text-cascadia-green">
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
                className="text-gray-500 hover:text-cascadia-green"
              >
                <FaInstagram className="w-4 h-4" />
              </a>
              <a
                href="https://www.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-gray-500 hover:text-cascadia-green"
              >
                <FaFacebookF className="w-4 h-4" />
              </a>
              <a
                href="https://www.linkedin.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="text-gray-500 hover:text-cascadia-green"
              >
                <FaLinkedinIn className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 py-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Cascadia Oceanic LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
