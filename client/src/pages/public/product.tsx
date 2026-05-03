import { useEffect, useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/use-seo";
import { useCart } from "@/contexts/cart-context";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShoppingCart } from "lucide-react";

interface SizeOption {
  productSizeId: string;
  sizeLabel: string;
  mediaType: string;
  retailPriceCents: number;
}

interface PublicProductDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  heroImageUrl: string | null;
  badge: string | null;
  basePriceCents: number | null;
  aspectRatio: string;
  collectionSlug: string | null;
  collectionName: string | null;
  sizeOptions: SizeOption[];
}

export default function Product() {
  const [, params] = useRoute("/store/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug || "";
  const { addItem } = useCart();
  const { toast } = useToast();

  const { data: product, isLoading } = useQuery<PublicProductDetail>({
    queryKey: ["/api/public/products", slug],
    enabled: !!slug,
  });

  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  useEffect(() => {
    if (!product?.sizeOptions?.length) return;
    if (!selectedMedia) setSelectedMedia(product.sizeOptions[0].mediaType);
  }, [product, selectedMedia]);

  useEffect(() => {
    if (!product?.sizeOptions?.length || !selectedMedia) return;
    const first = product.sizeOptions.find((o) => o.mediaType === selectedMedia);
    if (first && (!selectedSize || !product.sizeOptions.find((o) => o.productSizeId === selectedSize && o.mediaType === selectedMedia))) {
      setSelectedSize(first.productSizeId);
    }
  }, [product, selectedMedia, selectedSize]);

  useSEO({
    title: product?.title,
    description:
      product?.description ||
      `Original photograph by Chris McNulty${product ? `: ${product.title}` : ""}.`,
    imageUrl: product?.heroImageUrl || undefined,
  });

  if (isLoading) {
    return (
      <PublicLayout showHero={false}>
        <div className="max-w-7xl mx-auto py-20 text-center text-gray-500">Loading print…</div>
      </PublicLayout>
    );
  }

  if (!product) {
    return (
      <PublicLayout showHero={false}>
        <div className="max-w-7xl mx-auto py-20 text-center">
          <p className="text-gray-700">Print not found.</p>
          <Link href="/store">
            <Button variant="outline" className="mt-4">
              Back to store
            </Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const mediaTypes = Array.from(new Set(product.sizeOptions.map((s) => s.mediaType)));
  const sizesForMedia = product.sizeOptions.filter((s) => s.mediaType === selectedMedia);
  const currentOption = sizesForMedia.find((s) => s.productSizeId === selectedSize);

  const handleAdd = () => {
    if (!currentOption) {
      toast({ title: "Choose a size", variant: "destructive" });
      return;
    }
    addItem({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      imageUrl: product.heroImageUrl || "",
      mediaType: currentOption.mediaType,
      sizeLabel: currentOption.sizeLabel,
      productSizeId: currentOption.productSizeId,
      unitPriceCents: currentOption.retailPriceCents,
      quantity: 1,
    });
    toast({ title: "Added to cart", description: `${product.title} (${currentOption.sizeLabel}, ${currentOption.mediaType})` });
  };

  return (
    <PublicLayout showHero={false}>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <Link
          href="/store"
          className="inline-flex items-center gap-1 text-cascadia-green text-sm mb-6 hover:underline"
          data-testid="link-back-store"
        >
          <ArrowLeft className="w-4 h-4" /> Back to store
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            {product.heroImageUrl ? (
              <img
                src={product.heroImageUrl}
                alt={product.title}
                className="w-full h-auto"
                data-testid="img-product-hero"
              />
            ) : (
              <div className="aspect-square bg-gray-200" />
            )}
          </div>

          <div>
            {product.collectionName && (
              <p className="text-sm uppercase tracking-wider text-cascadia-green mb-2">
                {product.collectionName}
              </p>
            )}
            <h1 className="text-3xl font-light text-gray-900" data-testid="text-product-title">
              {product.title}
            </h1>
            {currentOption ? (
              <p className="mt-2 text-2xl text-cascadia-green font-medium" data-testid="text-product-price">
                ${(currentOption.retailPriceCents / 100).toFixed(2)}
              </p>
            ) : product.basePriceCents != null ? (
              <p className="mt-2 text-2xl text-cascadia-green font-medium">
                From ${(product.basePriceCents / 100).toFixed(2)}
              </p>
            ) : null}

            {product.description && (
              <p className="mt-6 text-gray-700 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            )}

            {mediaTypes.length > 0 && (
              <div className="mt-8">
                <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                  Material
                </label>
                <div className="flex flex-wrap gap-2">
                  {mediaTypes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMedia(m)}
                      className={`px-4 py-2 text-sm border rounded ${
                        selectedMedia === m
                          ? "bg-cascadia-green text-white border-cascadia-green"
                          : "border-gray-300 text-gray-700 hover:border-cascadia-green"
                      }`}
                      data-testid={`button-media-${m.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sizesForMedia.length > 0 && (
              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                  Size
                </label>
                <div className="flex flex-wrap gap-2">
                  {sizesForMedia.map((s) => (
                    <button
                      key={s.productSizeId}
                      type="button"
                      onClick={() => setSelectedSize(s.productSizeId)}
                      className={`px-4 py-2 text-sm border rounded ${
                        selectedSize === s.productSizeId
                          ? "bg-cascadia-green text-white border-cascadia-green"
                          : "border-gray-300 text-gray-700 hover:border-cascadia-green"
                      }`}
                      data-testid={`button-size-${s.sizeLabel.replace(/\s+/g, "-")}`}
                    >
                      {s.sizeLabel}
                      <span className="block text-xs opacity-80">
                        ${(s.retailPriceCents / 100).toFixed(0)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              size="lg"
              className="mt-8 w-full sm:w-auto bg-cascadia-green hover:bg-green-800"
              onClick={handleAdd}
              data-testid="button-add-to-cart"
              disabled={!currentOption}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>

            <div className="mt-8 text-sm text-gray-600 space-y-1">
              <p>• ChromaLuxe metal prints with lifetime durability</p>
              <p>• Each print signed and numbered by the artist</p>
              <p>• Ships from Washington State</p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
