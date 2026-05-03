import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import PublicLayout from "@/components/public-layout";
import { useCart } from "@/contexts/cart-context";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function CheckoutSuccess() {
  useSEO({ title: "Order Confirmed", description: "Thank you for your order." });
  const search = useSearch();
  const { clear } = useCart();
  const sessionId = new URLSearchParams(search).get("session_id");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [totalCents, setTotalCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!sessionId) {
      setState("error");
      setError("Missing session id.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/checkout/confirm/${sessionId}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not confirm your order.");
          setState("error");
          return;
        }
        setOrderId(data.orderId);
        setTotalCents(data.totalCents);
        clear();
        setState("ok");
      } catch (err) {
        console.warn("confirm failed", err);
        setState("error");
        setError("Network error confirming your order.");
      }
    })();
  }, [sessionId, clear]);

  return (
    <PublicLayout heroTitle="Order Confirmed">
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        {state === "loading" && (
          <p className="text-gray-600" data-testid="checkout-success-loading">
            Confirming your payment…
          </p>
        )}
        {state === "ok" && (
          <div data-testid="checkout-success-ok">
            <CheckCircle2 className="w-16 h-16 mx-auto text-cascadia-green" />
            <h2 className="mt-6 text-3xl font-light text-gray-900">Thank you!</h2>
            <p className="mt-3 text-gray-700">
              Your payment was received and your order has been recorded.
            </p>
            {orderId && (
              <p className="mt-4 text-sm text-gray-500">
                Order reference: <code className="font-mono">{orderId}</code>
              </p>
            )}
            {totalCents != null && (
              <p className="mt-1 text-sm text-gray-500">
                Total charged: ${(totalCents / 100).toFixed(2)}
              </p>
            )}
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/store">
                <Button className="bg-cascadia-green hover:bg-green-800" data-testid="button-continue-shopping">
                  Continue shopping
                </Button>
              </Link>
            </div>
          </div>
        )}
        {state === "error" && (
          <div data-testid="checkout-success-error">
            <AlertCircle className="w-16 h-16 mx-auto text-red-500" />
            <h2 className="mt-6 text-2xl font-light text-gray-900">Confirmation issue</h2>
            <p className="mt-3 text-gray-700">{error}</p>
            <p className="mt-3 text-sm text-gray-500">
              If you were charged, your order will still be recorded automatically by our
              payment system. Please contact us if you don't receive a receipt soon.
            </p>
            <Link href="/cart">
              <Button variant="outline" className="mt-6" data-testid="button-back-to-cart">
                Back to cart
              </Button>
            </Link>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
