import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function CheckoutCancel() {
  useSEO({ title: "Checkout Cancelled", description: "Your checkout was cancelled." });
  return (
    <PublicLayout heroTitle="Checkout Cancelled">
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <XCircle className="w-16 h-16 mx-auto text-gray-400" />
        <h2 className="mt-6 text-2xl font-light text-gray-900">Checkout cancelled</h2>
        <p className="mt-3 text-gray-700">
          No payment was taken. Your cart is still saved if you'd like to try again.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/cart">
            <Button className="bg-cascadia-green hover:bg-green-800" data-testid="button-back-to-cart">
              Back to cart
            </Button>
          </Link>
          <Link href="/store">
            <Button variant="outline" data-testid="button-keep-shopping">
              Keep shopping
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
