import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { FileText, FileType, Loader2, Tag } from "lucide-react";

const ALL_STATUSES = [
  { value: "in_stock", label: "In Stock" },
  { value: "on_exhibit", label: "On Exhibit" },
  { value: "ordered", label: "Ordered" },
  { value: "sold", label: "Sold" },
  { value: "shipped", label: "Shipped" },
];

interface InventoryItem {
  id: string;
  productTitle?: string;
  sizeLabel?: string;
  mediaType: string;
  listPrice: number;
  status: string;
  location?: string;
}

function applyDiscount(listCents: number, discountRate: number): number {
  const after = listCents * (1 - discountRate / 100);
  return Math.round(after / 500) * 500;
}

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

export default function PriceListExport() {
  const { toast } = useToast();

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set(["in_stock", "on_exhibit"]),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [downloading, setDownloading] = useState<null | "pdf" | "docx">(null);

  const { data: allItems, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/admin/inventory/all"],
  });

  // Filtered by selected statuses
  const filteredItems = (allItems ?? []).filter((item) =>
    selectedStatuses.has(item.status),
  );

  // Sort by title then by size label
  const sortedItems = [...filteredItems].sort((a, b) => {
    const ta = (a.productTitle ?? "").toLowerCase();
    const tb = (b.productTitle ?? "").toLowerCase();
    if (ta !== tb) return ta < tb ? -1 : 1;
    return (a.sizeLabel ?? "").localeCompare(b.sizeLabel ?? "");
  });

  // Re-select everything when filter changes
  useEffect(() => {
    setSelectedIds(new Set(sortedItems.map((i) => i.id)));
  }, [selectedStatuses, allItems]);

  const toggleStatus = (status: string, checked: boolean) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (checked) next.add(status);
      else next.delete(status);
      return next;
    });
  };

  const toggleItem = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(sortedItems.map((i) => i.id)));
  const clearAll = () => setSelectedIds(new Set());

  const selectedItems = sortedItems.filter((i) => selectedIds.has(i.id));
  const selectedCount = selectedItems.length;

  const handleDownload = async (format: "pdf" | "docx") => {
    if (selectedCount === 0) return;
    setDownloading(format);
    try {
      const res = await apiRequest("POST", "/api/admin/pricelist/export", {
        format,
        title: title || "Price List",
        subtitle: subtitle || undefined,
        discountRate,
        itemIds: selectedItems.map((i) => i.id),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      const slug = (title || "pricelist")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      a.download = `${slug}-${stamp}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "Price list generated",
        description: `Your ${format.toUpperCase()} download has started.`,
      });
    } catch (err: any) {
      toast({
        title: "Export failed",
        description: err?.message || "Could not generate the document.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Options */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" style={{ color: "#174A2E" }} />
              Show Price List Generator
            </CardTitle>
            <CardDescription>
              Generate a branded price list from your inventory for art shows and exhibits. Fits on 1–2 pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title & Subtitle */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pl-title">Show / Event Title</Label>
                <Input
                  id="pl-title"
                  placeholder="e.g. Bellevue Arts Fair 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-pricelist-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-subtitle">Subtitle (optional)</Label>
                <Input
                  id="pl-subtitle"
                  placeholder="e.g. ChromaLuxe Metal Prints"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  data-testid="input-pricelist-subtitle"
                />
              </div>
            </div>

            <Separator />

            {/* Discount */}
            <div className="space-y-3">
              <Label>Show Discount</Label>
              <div className="flex items-center gap-3">
                <div className="relative w-32">
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    step={1}
                    value={discountRate}
                    onChange={(e) =>
                      setDiscountRate(Math.max(0, Math.min(99, Number(e.target.value))))
                    }
                    className="pr-8"
                    data-testid="input-pricelist-discount"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {discountRate > 0
                    ? `Prices are discounted by ${discountRate}% and rounded to the nearest $5.`
                    : "Enter a percentage to apply an across-the-board show discount."}
                </p>
              </div>
              {discountRate > 0 && selectedCount > 0 && (
                <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Preview:{" "}
                  {selectedItems.slice(0, 3).map((item, i) => (
                    <span key={item.id}>
                      {i > 0 && " · "}
                      {item.productTitle} {item.sizeLabel}{" "}
                      <span className="line-through">
                        {fmtPrice(item.listPrice)}
                      </span>{" "}
                      →{" "}
                      <strong className="text-foreground">
                        {fmtPrice(applyDiscount(item.listPrice, discountRate))}
                      </strong>
                    </span>
                  ))}
                  {selectedItems.length > 3 && " …"}
                </div>
              )}
            </div>

            <Separator />

            {/* Status filter */}
            <div className="space-y-3">
              <Label>Filter by inventory status</Label>
              <div className="flex flex-wrap gap-4">
                {ALL_STATUSES.map((s) => (
                  <div key={s.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`status-${s.value}`}
                      checked={selectedStatuses.has(s.value)}
                      onCheckedChange={(v) => toggleStatus(s.value, !!v)}
                      data-testid={`checkbox-status-${s.value}`}
                    />
                    <Label htmlFor={`status-${s.value}`} className="cursor-pointer font-normal">
                      {s.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Download buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => handleDownload("pdf")}
                disabled={downloading !== null || selectedCount === 0}
                data-testid="button-pricelist-pdf"
                style={{ backgroundColor: "#174A2E" }}
              >
                {downloading === "pdf" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileType className="w-4 h-4 mr-2" />
                )}
                Download PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload("docx")}
                disabled={downloading !== null || selectedCount === 0}
                data-testid="button-pricelist-docx"
              >
                {downloading === "docx" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                Download Word
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sorted by photo name, then size. Designed to fit on 1–2 pages.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Item selection */}
      <div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Inventory Items</CardTitle>
              {!isLoading && sortedItems.length > 0 && (
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="underline"
                    onClick={selectAll}
                    data-testid="button-pricelist-select-all"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="underline"
                    onClick={clearAll}
                    data-testid="button-pricelist-clear-all"
                  >
                    None
                  </button>
                </div>
              )}
            </div>
            <CardDescription>
              {isLoading
                ? "Loading…"
                : `${selectedCount} of ${sortedItems.length} selected`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : sortedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No inventory items match the selected statuses.
              </p>
            ) : (
              <ScrollArea className="h-[520px] pr-3">
                <ul className="space-y-1" data-testid="list-pricelist-items">
                  {sortedItems.map((item) => {
                    const checked = selectedIds.has(item.id);
                    const showPrice =
                      discountRate > 0
                        ? applyDiscount(item.listPrice, discountRate)
                        : item.listPrice;
                    return (
                      <li key={item.id} className="border-b pb-1.5 pt-1">
                        <div className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleItem(item.id, !!v)}
                            className="mt-0.5"
                            data-testid={`checkbox-item-${item.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {item.productTitle ?? "Unknown"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.sizeLabel} · {item.mediaType}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {discountRate > 0 ? (
                              <>
                                <div className="text-xs line-through text-muted-foreground">
                                  {fmtPrice(item.listPrice)}
                                </div>
                                <div className="text-xs font-semibold" style={{ color: "#3F8F5A" }}>
                                  {fmtPrice(showPrice)}
                                </div>
                              </>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {fmtPrice(item.listPrice)}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
