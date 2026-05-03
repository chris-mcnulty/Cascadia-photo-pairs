import { useEffect, useState } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/cart-context";
import { useSEO } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";

export default function Checkout() {
  useSEO({ title: "Checkout", description: "Secure checkout for prints from chrismcnulty.net." });
  const { items, subtotalCents } = useCart();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stripeAvailable, setStripeAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/checkout/status")
      .then((r) => r.json())
      .then((d) => setStripeAvailable(!!d.available))
      .catch((err) => {
        console.warn("Checkout: failed to probe checkout status", err);
        setStripeAvailable(false);
      });
  }, []);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    const incomplete = items.find((i) => !i.productId || !i.productSizeId || !i.mediaType);
    if (incomplete) {
      toast({
        title: "Cart needs an update",
        description: "Please remove and re-add items added before this update.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Send only IDs + quantity. Pricing is computed server-side
          // against the catalog to prevent any tampering.
          items: items.map((i) => ({
            productId: i.productId,
            productSizeId: i.productSizeId,
            mediaType: i.mediaType,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout failed");
      }
      window.location.href = data.url;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not start checkout.";
      toast({ title: "Checkout error", description: message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <PublicLayout heroTitle="Checkout">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-700 mb-4">Your cart is empty.</p>
            <Link href="/store">
              <Button variant="outline">Browse the Store</Button>
            </Link>
          </div>
        ) : stripeAvailable === false ? (
          <div className="border border-amber-300 bg-amber-50 rounded-lg p-6 text-amber-900">
            <h2 className="font-semibold text-lg mb-2">Online checkout coming soon</h2>
            <p className="text-sm">
              Online payments aren't available right now. To place an order, please email{" "}
              <a className="underline" href="mailto:hello@chrismcnulty.net">
                hello@chrismcnulty.net
              </a>{" "}
              with your selection and we'll send you a secure invoice.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <h2 className="text-lg font-semibold mb-4">Order Review</h2>
              <ul className="divide-y divide-gray-100 text-sm">
                {items.map((i) => (
                  <li key={`${i.productId}-${i.mediaType}-${i.sizeLabel}`} className="py-3 flex justify-between gap-4">
                    <span className="text-gray-700">
                      {i.title} <span className="text-gray-500">({i.mediaType} · {i.sizeLabel})</span> × {i.quantity}
                    </span>
                    <span className="text-gray-900">${((i.unitPriceCents * i.quantity) / 100).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between font-semibold">
                <span>Subtotal</span>
                <span>${(subtotalCents / 100).toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Shipping and tax calculated on the next step.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Final pricing is verified against the catalog at checkout.
              </p>
            </div>

            <Button
              className="w-full bg-cascadia-green hover:bg-green-800"
              size="lg"
              onClick={handleCheckout}
              disabled={loading || stripeAvailable === null}
              data-testid="button-stripe-checkout"
            >
              {loading ? "Redirecting…" : "Pay with Stripe"}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Secure payment processing by Stripe. Your card details never touch our server.
            </p>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
