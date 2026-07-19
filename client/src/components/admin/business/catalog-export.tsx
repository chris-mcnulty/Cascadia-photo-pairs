import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, FileType, Loader2, Image as ImageIcon, QrCode } from "lucide-react";

type Mode = "portfolio" | "signage";

interface PreviewSize {
  sizeLabel: string;
  mediaType: string;
  priceCents: number;
}

interface PreviewEntry {
  productId: string;
  slug: string;
  title: string;
  year: number | null;
  collection: string;
  sizeCount: number;
  sizes: PreviewSize[];
  hasImage: boolean;
}

interface PreviewCollection {
  id: string;
  name: string;
  slug: string;
}

interface PreviewResponse {
  count: number;
  facets: { years: number[]; collections: PreviewCollection[] };
  entries: PreviewEntry[];
}

const AUTO = "auto";
const sizeKey = (s: PreviewSize) => `${s.sizeLabel}|||${s.mediaType}`;

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatSize(label: string): string {
  return label.replace(/(\d+(?:\.\d+)?)/g, "$1″");
}

export default function CatalogExport() {
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("portfolio");
  const [collection, setCollection] = useState("all");
  const [year, setYear] = useState("all");
  const [sort, setSort] = useState("title");
  const [inventoryStatuses, setInventoryStatuses] = useState<Set<string>>(new Set());

  // Signage-only options
  const [featuredSize, setFeaturedSize] = useState<"largest" | "smallest">("largest");
  const [includePhoto, setIncludePhoto] = useState(true);
  const [includeQr, setIncludeQr] = useState(true);
  const [useBrandLogo, setUseBrandLogo] = useState(true);
  const [storeBaseUrl, setStoreBaseUrl] = useState("https://www.chrismcnulty.net");
  const [showLogo, setShowLogo] = useState<string | null>(null);
  const [showLogoName, setShowLogoName] = useState<string>("");

  // Per-photo selection + per-card size choice
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sizeChoice, setSizeChoice] = useState<Record<string, string>>({});

  const [downloading, setDownloading] = useState<null | "pdf" | "docx">(null);

  const statusParam = inventoryStatuses.size > 0 ? Array.from(inventoryStatuses).sort().join(",") : "all";
  const previewKey = `/api/admin/catalog/entries?collection=${collection}&year=${year}&sort=${sort}&inventoryStatuses=${statusParam}`;
  const { data, isLoading } = useQuery<PreviewResponse>({
    queryKey: [previewKey],
  });

  const years = data?.facets.years || [];
  const entries = data?.entries || [];

  // When the filtered set changes, select everything by default.
  useEffect(() => {
    if (!data) return;
    setSelectedIds(new Set(data.entries.map((e) => e.productId)));
  }, [data]);

  const selectedCount = useMemo(
    () => entries.filter((e) => selectedIds.has(e.productId)).length,
    [entries, selectedIds],
  );

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(entries.map((e) => e.productId)));
  const clearAll = () => setSelectedIds(new Set());

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setShowLogo(reader.result as string);
      setShowLogoName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async (format: "pdf" | "docx") => {
    setDownloading(format);
    try {
      // Preserve preview order; only include checked photos.
      const selections = entries
        .filter((e) => selectedIds.has(e.productId))
        .map((e) => {
          const choice = mode === "signage" ? sizeChoice[e.productId] : undefined;
          if (choice && choice !== AUTO) {
            const [sizeLabel, mediaType] = choice.split("|||");
            return { productId: e.productId, sizeLabel, mediaType };
          }
          return { productId: e.productId };
        });

      const res = await apiRequest("POST", "/api/admin/catalog/export", {
        format,
        mode,
        collection,
        year,
        sort,
        inventoryStatuses: inventoryStatuses.size > 0 ? Array.from(inventoryStatuses) : [],
        featuredSize,
        includeQr,
        includePhoto: mode === "signage" ? includePhoto : true,
        storeBaseUrl,
        useBrandLogo,
        showLogo: mode === "signage" ? showLogo : null,
        selections,
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `cascadia-${mode}-${stamp}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Catalog generated", description: `Your ${format.toUpperCase()} download has started.` });
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
              <FileText className="w-5 h-5" style={{ color: "#174A2E" }} />
              Catalog Generator
            </CardTitle>
            <CardDescription>
              Generate branded print portfolios and exhibit signage from your for-sale photos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mode */}
            <div className="space-y-2">
              <Label>Document type</Label>
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList className="grid w-full grid-cols-2 max-w-md" data-testid="tabs-catalog-mode">
                  <TabsTrigger value="portfolio" data-testid="tab-portfolio">Print Portfolio</TabsTrigger>
                  <TabsTrigger value="signage" data-testid="tab-signage">Exhibit Signage</TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground">
                {mode === "portfolio"
                  ? "A full catalog booklet — each photo with its description and every available size."
                  : "One card per page — title, story, a featured size & price, QR code, and brand line."}
              </p>
            </div>

            <Separator />

            {/* Inventory status filter */}
            <div className="space-y-2">
              <Label>Inventory filter</Label>
              <p className="text-xs text-muted-foreground">
                Limit to photos with at least one print in the selected status(es). Leave all unchecked to show every for-sale photo regardless of inventory.
              </p>
              <div className="flex flex-wrap gap-4 pt-1">
                {[
                  { value: "in_stock", label: "In Stock" },
                  { value: "on_exhibit", label: "On Exhibit" },
                  { value: "ordered", label: "Ordered" },
                ].map((s) => (
                  <div key={s.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`inv-status-${s.value}`}
                      checked={inventoryStatuses.has(s.value)}
                      onCheckedChange={(v) =>
                        setInventoryStatuses((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(s.value);
                          else next.delete(s.value);
                          return next;
                        })
                      }
                      data-testid={`checkbox-inv-status-${s.value}`}
                    />
                    <Label htmlFor={`inv-status-${s.value}`} className="cursor-pointer font-normal">
                      {s.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Collection</Label>
                <Select value={collection} onValueChange={setCollection}>
                  <SelectTrigger data-testid="select-catalog-collection"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All collections</SelectItem>
                    {(data?.facets.collections ?? []).map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger data-testid="select-catalog-year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort by</Label>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger data-testid="select-catalog-sort"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="title">Title (A–Z)</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Signage options */}
            {mode === "signage" && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Signage options</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Default featured size</Label>
                      <Select value={featuredSize} onValueChange={(v) => setFeaturedSize(v as any)}>
                        <SelectTrigger data-testid="select-featured-size"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="largest">Largest available</SelectItem>
                          <SelectItem value="smallest">Smallest available</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Used for any card left on "Auto" below.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Store URL (for "More sizes at" + QR)</Label>
                      <Input
                        value={storeBaseUrl}
                        onChange={(e) => setStoreBaseUrl(e.target.value)}
                        data-testid="input-store-url"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label className="cursor-pointer">Include photo on card</Label>
                        <p className="text-xs text-muted-foreground">Turn off for text-only signage cards.</p>
                      </div>
                    </div>
                    <Switch checked={includePhoto} onCheckedChange={setIncludePhoto} data-testid="switch-include-photo" />
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label className="cursor-pointer">Include QR code</Label>
                        <p className="text-xs text-muted-foreground">Links to each photo's store page.</p>
                      </div>
                    </div>
                    <Switch checked={includeQr} onCheckedChange={setIncludeQr} data-testid="switch-qr" />
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label className="cursor-pointer">Include Cascadia brand logo</Label>
                        <p className="text-xs text-muted-foreground">Adds the Cascadia Oceanic mark to each card.</p>
                      </div>
                    </div>
                    <Switch checked={useBrandLogo} onCheckedChange={setUseBrandLogo} data-testid="switch-brand-logo" />
                  </div>

                  <div className="space-y-2">
                    <Label>Show logo (optional)</Label>
                    <Input type="file" accept="image/*" onChange={handleLogoUpload} data-testid="input-show-logo" />
                    {showLogoName && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {showLogoName}{" "}
                        <button
                          type="button"
                          className="underline ml-1"
                          onClick={() => { setShowLogo(null); setShowLogoName(""); }}
                        >
                          remove
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Download buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => handleDownload("pdf")}
                disabled={downloading !== null || selectedCount === 0}
                data-testid="button-download-pdf"
                style={{ backgroundColor: "#174A2E" }}
              >
                {downloading === "pdf" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileType className="w-4 h-4 mr-2" />}
                Download PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload("docx")}
                disabled={downloading !== null || selectedCount === 0}
                data-testid="button-download-docx"
              >
                {downloading === "docx" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Download Word
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Images are downsized for fast, reliable generation. A large catalog may still take a few moments.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Photo selection / preview */}
      <div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Photos</CardTitle>
              {!isLoading && entries.length > 0 && (
                <div className="flex gap-2 text-xs">
                  <button type="button" className="underline" onClick={selectAll} data-testid="button-select-all">All</button>
                  <button type="button" className="underline" onClick={clearAll} data-testid="button-clear-all">None</button>
                </div>
              )}
            </div>
            <CardDescription>
              {isLoading
                ? "Loading…"
                : `${selectedCount} of ${entries.length} selected`}
              {mode === "signage" && entries.length > 0 ? " · pick a size per card" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No photos match these filters.</p>
            ) : (
              <ScrollArea className="h-[460px] pr-3">
                <ul className="space-y-2" data-testid="list-catalog-preview">
                  {entries.map((e) => {
                    const checked = selectedIds.has(e.productId);
                    return (
                      <li key={e.productId} className="border-b pb-2">
                        <div className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleOne(e.productId, !!v)}
                            className="mt-0.5"
                            data-testid={`checkbox-photo-${e.slug}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{e.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {e.collection}
                              {e.year ? ` · ${e.year}` : ""} · {e.sizeCount} size{e.sizeCount === 1 ? "" : "s"}
                            </div>
                          </div>
                          {!e.hasImage && (
                            <span className="text-xs text-amber-600 whitespace-nowrap">no image</span>
                          )}
                        </div>

                        {mode === "signage" && checked && e.sizes.length > 0 && (
                          <div className="mt-2 ml-6">
                            <Select
                              value={sizeChoice[e.productId] || AUTO}
                              onValueChange={(v) =>
                                setSizeChoice((prev) => ({ ...prev, [e.productId]: v }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-size-${e.slug}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={AUTO}>Auto ({featuredSize})</SelectItem>
                                {e.sizes.map((s) => (
                                  <SelectItem key={sizeKey(s)} value={sizeKey(s)}>
                                    {formatSize(s.sizeLabel)} · {s.mediaType} · {formatPrice(s.priceCents)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
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
