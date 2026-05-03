import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { useCart, itemKey } from "@/contexts/cart-context";
import { useSEO } from "@/hooks/use-seo";
import { Trash2, Minus, Plus, CheckCircle2, AlertCircle } from "lucide-react";

interface OrderConfirmation {
  orderId: string;
  totalCents: number;
  alreadyPersisted?: boolean;
}

export default function Cart() {
  useSEO({ title: "Cart", description: "Your shopping cart at chrismcnulty.net." });
  const { items, updateQuantity, removeItem, subtotalCents, count, clear } = useCart();
  const [location] = useLocation();
  const [statusBanner, setStatusBanner] = useState<
    | { kind: "success"; order?: OrderConfirmation }
    | { kind: "cancel" }
    | { kind: "error"; message: string }
    | null
  >(null);
  const confirmInFlight = useRef(false);

  // Detect Stripe redirect (?status=success&session_id=cs_...) and confirm.
  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);
    const status = params.get("status");
    const sessionId = params.get("session_id");

    if (status === "cancel") {
      setStatusBanner({ kind: "cancel" });
      window.history.replaceState({}, "", "/cart");
      return;
    }

    if (status !== "success" || !sessionId || confirmInFlight.current) return;
    confirmInFlight.current = true;

    fetch(`/api/checkout/confirm/${encodeURIComponent(sessionId)}`, { method: "POST" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(data.error || `Confirmation failed (${r.status})`);
        }
        return data as OrderConfirmation;
      })
      .then((order) => {
        setStatusBanner({ kind: "success", order });
        clear();
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Could not confirm order.";
        setStatusBanner({ kind: "error", message });
      })
      .finally(() => {
        window.history.replaceState({}, "", "/cart");
      });
  }, [location, clear]);

  return (
    <PublicLayout heroTitle="Cart">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {statusBanner?.kind === "success" && (
          <div
            className="mb-8 border border-green-300 bg-green-50 rounded-lg p-5 text-green-900 flex items-start gap-3"
            data-testid="banner-order-success"
          >
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Thank you — your order is confirmed.</p>
              <p className="text-sm mt-1">
                {statusBanner.order
                  ? `Order ${statusBanner.order.orderId.slice(0, 8)} totaling $${(
                      statusBanner.order.totalCents / 100
                    ).toFixed(2)}. A receipt is on its way to your inbox.`
                  : "We've recorded your purchase and a receipt is on its way to your inbox."}
              </p>
            </div>
          </div>
        )}
        {statusBanner?.kind === "cancel" && (
          <div className="mb-8 border border-amber-300 bg-amber-50 rounded-lg p-5 text-amber-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Checkout cancelled.</p>
              <p className="text-sm mt-1">
                Your cart is still here whenever you're ready.
              </p>
            </div>
          </div>
        )}
        {statusBanner?.kind === "error" && (
          <div className="mb-8 border border-red-300 bg-red-50 rounded-lg p-5 text-red-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">We couldn't finalize your order.</p>
              <p className="text-sm mt-1">{statusBanner.message}</p>
              <p className="text-sm mt-1">
                If you were charged, please email{" "}
                <a href="mailto:hello@chrismcnulty.net" className="underline">
                  hello@chrismcnulty.net
                </a>{" "}
                and we'll sort it out.
              </p>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-700 mb-6">
              {statusBanner?.kind === "success"
                ? "Your cart is now empty."
                : "Your cart is empty."}
            </p>
            <Link href="/store">
              <Button className="bg-cascadia-green hover:bg-green-800" data-testid="button-shop-prints-empty">
                Browse the Store
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
            <div className="space-y-4">
              {items.map((item) => {
                const key = itemKey(item);
                return (
                  <div
                    key={key}
                    className="flex gap-4 border border-gray-200 rounded-lg p-4 bg-white"
                    data-testid={`cart-item-${item.slug}`}
                  >
                    <Link
                      href={`/store/${item.slug}`}
                      className="block w-24 h-24 sm:w-32 sm:h-32 bg-gray-100 rounded overflow-hidden shrink-0"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                    </Link>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link href={`/store/${item.slug}`}>
                            <h3 className="text-lg font-medium text-gray-900 hover:text-cascadia-green">
                              {item.title}
                            </h3>
                          </Link>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.mediaType} · {item.sizeLabel}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(key)}
                          className="text-gray-400 hover:text-red-600"
                          aria-label="Remove"
                          data-testid={`button-remove-${item.slug}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center border border-gray-300 rounded">
                          <button
                            className="px-2 py-1 text-gray-600 hover:bg-gray-50"
                            onClick={() => updateQuantity(key, item.quantity - 1)}
                            data-testid={`button-qty-minus-${item.slug}`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-3 text-sm" data-testid={`text-qty-${item.slug}`}>
                            {item.quantity}
                          </span>
                          <button
                            className="px-2 py-1 text-gray-600 hover:bg-gray-50"
                            onClick={() => updateQuantity(key, item.quantity + 1)}
                            data-testid={`button-qty-plus-${item.slug}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-cascadia-green font-medium">
                          ${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <aside className="border border-gray-200 rounded-lg p-6 bg-cascadia-light h-fit">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Items</span>
                <span data-testid="text-summary-count">{count}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Subtotal</span>
                <span data-testid="text-summary-subtotal">${(subtotalCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-600">Shipping</span>
                <span className="text-gray-500">Calculated at checkout</span>
              </div>
              <div className="border-t border-gray-300 pt-3 flex justify-between font-semibold text-gray-900 mb-4">
                <span>Total</span>
                <span data-testid="text-summary-total">${(subtotalCents / 100).toFixed(2)}</span>
              </div>
              <Link href="/checkout">
                <Button
                  className="w-full bg-cascadia-green hover:bg-green-800"
                  data-testid="button-checkout"
                >
                  Checkout
                </Button>
              </Link>
              <Link
                href="/store"
                className="block text-center mt-3 text-sm text-cascadia-green hover:underline"
              >
                Continue shopping
              </Link>
            </aside>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
