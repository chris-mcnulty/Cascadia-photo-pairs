import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [location] = useLocation();

  useEffect(() => {
    const path = window.location.pathname;
    const referrer = document.referrer || "";
    const userAgent = navigator.userAgent || "";

    fetch("/api/404-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, referrer, userAgent }),
    }).catch(() => {});
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div
          className="text-[7rem] font-black leading-none tracking-tighter"
          style={{ color: "var(--color-primary, #1e3a2f)" }}
        >
          404
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-stone-800">
            This page doesn't exist or may have moved.
          </h1>
          <p className="text-stone-500 text-base">
            The link you followed might be outdated, or the address may have changed.
          </p>
        </div>

        <div className="pt-2">
          <Link href="/">
            <Button
              variant="default"
              className="gap-2 px-6 py-3 text-base"
            >
              <ArrowLeft className="w-5 h-5" />
              Go to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
