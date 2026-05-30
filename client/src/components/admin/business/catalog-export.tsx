import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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

interface PreviewEntry {
  productId: string;
  title: string;
  year: number | null;
  category: string;
  sizeCount: number;
  hasImage: boolean;
}

interface PreviewResponse {
  count: number;
  facets: { years: number[]; categories: string[] };
  entries: PreviewEntry[];
}

const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "seascapes", label: "Seascapes" },
  { value: "landscapes", label: "Landscapes" },
  { value: "cityscapes", label: "Cityscapes" },
  { value: "other", label: "Other" },
];

export default function CatalogExport() {
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("portfolio");
  const [category, setCategory] = useState("all");
  const [year, setYear] = useState("all");
  const [sort, setSort] = useState("title");

  // Signage-only options
  const [featuredSize, setFeaturedSize] = useState<"largest" | "smallest">("largest");
  const [includeQr, setIncludeQr] = useState(true);
  const [useBrandLogo, setUseBrandLogo] = useState(true);
  const [storeBaseUrl, setStoreBaseUrl] = useState("https://www.chrismcnulty.net");
  const [showLogo, setShowLogo] = useState<string | null>(null);
  const [showLogoName, setShowLogoName] = useState<string>("");

  const [downloading, setDownloading] = useState<null | "pdf" | "docx">(null);

  const previewKey = `/api/admin/catalog/entries?category=${category}&year=${year}&sort=${sort}`;
  const { data, isLoading } = useQuery<PreviewResponse>({
    queryKey: [previewKey],
  });

  const years = data?.facets.years || [];

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
      const res = await apiRequest("POST", "/api/admin/catalog/export", {
        format,
        mode,
        category,
        year,
        sort,
        featuredSize,
        includeQr,
        storeBaseUrl,
        useBrandLogo,
        showLogo: mode === "signage" ? showLogo : null,
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

            {/* Filters */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="select-catalog-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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
                      <Label>Featured size</Label>
                      <Select value={featuredSize} onValueChange={(v) => setFeaturedSize(v as any)}>
                        <SelectTrigger data-testid="select-featured-size"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="largest">Largest available</SelectItem>
                          <SelectItem value="smallest">Smallest available</SelectItem>
                        </SelectContent>
                      </Select>
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
                disabled={downloading !== null || (data?.count ?? 0) === 0}
                data-testid="button-download-pdf"
                style={{ backgroundColor: "#174A2E" }}
              >
                {downloading === "pdf" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileType className="w-4 h-4 mr-2" />}
                Download PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload("docx")}
                disabled={downloading !== null || (data?.count ?? 0) === 0}
                data-testid="button-download-docx"
              >
                {downloading === "docx" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Download Word
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Generating fetches each photo at full resolution, so a large catalog may take a few moments.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              {isLoading ? "Loading…" : `${data?.count ?? 0} photo${(data?.count ?? 0) === 1 ? "" : "s"} included`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (data?.entries.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No photos match these filters.</p>
            ) : (
              <ScrollArea className="h-[420px] pr-3">
                <ul className="space-y-2" data-testid="list-catalog-preview">
                  {data!.entries.map((e) => (
                    <li key={e.productId} className="flex items-start justify-between gap-2 text-sm border-b pb-2">
                      <div>
                        <div className="font-medium">{e.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.category}
                          {e.year ? ` · ${e.year}` : ""} · {e.sizeCount} size{e.sizeCount === 1 ? "" : "s"}
                        </div>
                      </div>
                      {!e.hasImage && (
                        <span className="text-xs text-amber-600 whitespace-nowrap">no image</span>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
