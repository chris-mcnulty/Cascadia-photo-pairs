import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Edit, Trash2, Wand2, Search, Download, Upload, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ProductSKU, ChannelSKU, Product, ProductSize, SalesChannel } from "@shared/schema";

interface ProductSKUWithDetails extends ProductSKU {
  productTitle?: string;
  sizeLabel?: string;
}

interface ChannelSKUWithDetails extends ChannelSKU {
  masterSKU?: string;
  channelName?: string;
}

const productSKUFormSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  productId: z.string().min(1, "Product is required"),
  mediaType: z.string().min(1, "Media type is required"),
  productSizeId: z.string().min(1, "Product size is required"),
  isActive: z.boolean().default(true),
});

const channelSKUFormSchema = z.object({
  channelSKU: z.string().min(1, "Channel SKU is required"),
  masterSKUId: z.string().min(1, "Master SKU is required"),
  channelId: z.string().min(1, "Sales channel is required"),
  channelListingId: z.string().optional(),
  isActive: z.boolean().default(true),
});

type ProductSKUFormData = z.infer<typeof productSKUFormSchema>;
type ChannelSKUFormData = z.infer<typeof channelSKUFormSchema>;

const MEDIA_TYPES = ["ChromaLuxe", "Framed Archival", "Canvas", "Metal", "Acrylic"];

export default function SKUManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("product-skus");
  const [productSKUDialogOpen, setProductSKUDialogOpen] = useState(false);
  const [channelSKUDialogOpen, setChannelSKUDialogOpen] = useState(false);
  const [editingProductSKU, setEditingProductSKU] = useState<ProductSKU | null>(null);
  const [editingChannelSKU, setEditingChannelSKU] = useState<ChannelSKU | null>(null);
  const [productSKUSearch, setProductSKUSearch] = useState("");
  const [channelSKUSearch, setChannelSKUSearch] = useState("");
  const [productComboboxOpen, setProductComboboxOpen] = useState(false);
  const [productFilter, setProductFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");

  const { data: productSKUs, isLoading: loadingProductSKUs } = useQuery<ProductSKUWithDetails[]>({
    queryKey: ["/api/admin/product-skus"],
  });

  const { data: channelSKUs, isLoading: loadingChannelSKUs } = useQuery<ChannelSKUWithDetails[]>({
    queryKey: ["/api/admin/channel-skus"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: productSizes } = useQuery<ProductSize[]>({
    queryKey: ["/api/admin/product-sizes"],
  });

  const { data: salesChannels } = useQuery<SalesChannel[]>({
    queryKey: ["/api/admin/sales-channels"],
  });

  // Memoized sorted products list
  const sortedProducts = useMemo(() => {
    if (!products) return [];
    return [...products].sort((a, b) => a.title.localeCompare(b.title));
  }, [products]);

  const productSKUForm = useForm<ProductSKUFormData>({
    resolver: zodResolver(productSKUFormSchema),
    defaultValues: {
      sku: "",
      productId: "",
      mediaType: "",
      productSizeId: "",
      isActive: true,
    },
  });

  const channelSKUForm = useForm<ChannelSKUFormData>({
    resolver: zodResolver(channelSKUFormSchema),
    defaultValues: {
      channelSKU: "",
      masterSKUId: "",
      channelId: "",
      channelListingId: "",
      isActive: true,
    },
  });

  // Watch the selected product ID
  const selectedProductId = productSKUForm.watch("productId");
  
  // Filter sizes based on selected product's allowed aspect ratios (supports multiple)
  const eligibleSizes = useMemo(() => {
    if (!productSizes || !selectedProductId || !products) return productSizes || [];
    
    const selectedProduct = products.find(p => p.id === selectedProductId);
    if (!selectedProduct) return productSizes;
    
    // Normalize aspect ratio for comparison (handle "3:2", "3x2", "3X2", "3×2" formats)
    const normalizeAspectRatio = (ratio: string) => ratio.toLowerCase().replace(/[x×]/g, ':');
    
    // Build the set of allowed ratios: prefer aspectRatios array, fall back to single aspectRatio
    const allowedRatiosRaw = (selectedProduct.aspectRatios && selectedProduct.aspectRatios.length > 0)
      ? selectedProduct.aspectRatios
      : [selectedProduct.aspectRatio];
    const allowedRatios = new Set(allowedRatiosRaw.map(normalizeAspectRatio));
    
    // Filter sizes whose aspect ratio matches any of the product's allowed ratios
    return productSizes.filter(size => 
      allowedRatios.has(normalizeAspectRatio(size.aspectRatio))
    );
  }, [productSizes, selectedProductId, products]);

  const createProductSKUMutation = useMutation({
    mutationFn: async (data: ProductSKUFormData) => {
      return await apiRequest("POST", "/api/admin/product-skus", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-skus"] });
      toast({
        title: "Success",
        description: "Product SKU created successfully",
      });
      setProductSKUDialogOpen(false);
      productSKUForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create product SKU",
        variant: "destructive",
      });
    },
  });

  const updateProductSKUMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductSKUFormData> }) => {
      return await apiRequest("PUT", `/api/admin/product-skus/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-skus"] });
      toast({
        title: "Success",
        description: "Product SKU updated successfully",
      });
      setProductSKUDialogOpen(false);
      setEditingProductSKU(null);
      productSKUForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update product SKU",
        variant: "destructive",
      });
    },
  });

  const deleteProductSKUMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/product-skus/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-skus"] });
      toast({
        title: "Success",
        description: "Product SKU deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete product SKU",
        variant: "destructive",
      });
    },
  });

  const createChannelSKUMutation = useMutation({
    mutationFn: async (data: ChannelSKUFormData) => {
      return await apiRequest("POST", "/api/admin/channel-skus", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/channel-skus"] });
      toast({
        title: "Success",
        description: "Channel SKU created successfully",
      });
      setChannelSKUDialogOpen(false);
      channelSKUForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create channel SKU",
        variant: "destructive",
      });
    },
  });

  const updateChannelSKUMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ChannelSKUFormData> }) => {
      return await apiRequest("PUT", `/api/admin/channel-skus/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/channel-skus"] });
      toast({
        title: "Success",
        description: "Channel SKU updated successfully",
      });
      setChannelSKUDialogOpen(false);
      setEditingChannelSKU(null);
      channelSKUForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update channel SKU",
        variant: "destructive",
      });
    },
  });

  const deleteChannelSKUMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/channel-skus/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/channel-skus"] });
      toast({
        title: "Success",
        description: "Channel SKU deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete channel SKU",
        variant: "destructive",
      });
    },
  });

  const filteredProductSKUs = useMemo(() => {
    if (!productSKUs) return [];
    
    let filtered = productSKUs;
    
    // Apply search filter
    if (productSKUSearch) {
      const search = productSKUSearch.toLowerCase();
      filtered = filtered.filter(
        (sku) =>
          sku.sku.toLowerCase().includes(search) ||
          sku.productTitle?.toLowerCase().includes(search) ||
          sku.mediaType.toLowerCase().includes(search) ||
          sku.sizeLabel?.toLowerCase().includes(search)
      );
    }
    
    // Apply product filter
    if (productFilter !== "all") {
      filtered = filtered.filter((sku) => sku.productId === productFilter);
    }
    
    // Apply size filter
    if (sizeFilter !== "all") {
      filtered = filtered.filter((sku) => sku.productSizeId === sizeFilter);
    }
    
    return filtered;
  }, [productSKUs, productSKUSearch, productFilter, sizeFilter]);

  const filteredChannelSKUs = useMemo(() => {
    if (!channelSKUs) return [];
    if (!channelSKUSearch) return channelSKUs;
    
    const search = channelSKUSearch.toLowerCase();
    return channelSKUs.filter(
      (sku) =>
        sku.channelSKU.toLowerCase().includes(search) ||
        sku.masterSKU?.toLowerCase().includes(search) ||
        sku.channelName?.toLowerCase().includes(search) ||
        sku.channelListingId?.toLowerCase().includes(search)
    );
  }, [channelSKUs, channelSKUSearch]);

  // Media type to code mapping
  const getMediaCode = (mediaType: string): string => {
    const mediaCodeMap: { [key: string]: string } = {
      "ChromaLuxe": "MTL",
      "Metal": "MTL",
      "Framed Archival": "FRM",
      "Canvas": "CNV",
      "Acrylic": "ACR",
    };
    return mediaCodeMap[mediaType] || mediaType.substring(0, 3).toUpperCase();
  };

  const handleAutoGenerateSKU = () => {
    const productId = productSKUForm.watch("productId");
    const mediaType = productSKUForm.watch("mediaType");
    const productSizeId = productSKUForm.watch("productSizeId");

    if (!productId || !mediaType || !productSizeId) {
      toast({
        title: "Missing Information",
        description: "Please select product, media type, and size first",
        variant: "destructive",
      });
      return;
    }

    const product = products?.find((p) => p.id === productId);
    const size = productSizes?.find((s) => s.id === productSizeId);

    if (!product || !size) return;

    // Extract 4-digit year from product title
    const yearMatch = product.title.match(/\b(20\d{2}|19\d{2})\b/);
    const yearSuffix = yearMatch ? yearMatch[1].slice(-2) : "";
    
    // Get product name (everything before the year, or entire title if no year)
    let productName = product.title;
    if (yearMatch) {
      productName = product.title.substring(0, product.title.indexOf(yearMatch[0]));
    }
    
    // Extract ONLY letters (no digits, no special chars), take first 5, convert to uppercase
    const productPrefix = productName
      .replace(/[^a-zA-Z]/g, "")
      .substring(0, 5)
      .toUpperCase();
    
    // Get media code (already uppercase)
    const mediaCode = getMediaCode(mediaType);
    
    // Get size code (remove ALL spaces, quotes, and special characters, uppercase everything)
    const sizeCode = size.sizeLabel
      .replace(/\s+/g, "")
      .replace(/["'`]/g, "")
      .toUpperCase();

    // Format: PRODUCTNAMEYY-MTL-36X48 (no spaces, all uppercase)
    const parts = [productPrefix + yearSuffix, mediaCode, sizeCode];
    const generatedSKU = parts.join("-").replace(/\s+/g, "");
    productSKUForm.setValue("sku", generatedSKU);
  };

  const handleAddProductSKU = () => {
    setEditingProductSKU(null);
    productSKUForm.reset({
      sku: "",
      productId: "",
      mediaType: "",
      productSizeId: "",
      isActive: true,
    });
    setProductSKUDialogOpen(true);
  };

  const handleEditProductSKU = (sku: ProductSKU) => {
    setEditingProductSKU(sku);
    productSKUForm.reset({
      sku: sku.sku,
      productId: sku.productId,
      mediaType: sku.mediaType,
      productSizeId: sku.productSizeId,
      isActive: sku.isActive,
    });
    setProductSKUDialogOpen(true);
  };

  const handleDeleteProductSKU = async (id: string, sku: string) => {
    if (!confirm(`Are you sure you want to delete SKU "${sku}"?`)) return;
    deleteProductSKUMutation.mutate(id);
  };

  const handleProductSKUSubmit = (data: ProductSKUFormData) => {
    if (editingProductSKU) {
      updateProductSKUMutation.mutate({ id: editingProductSKU.id, data });
    } else {
      createProductSKUMutation.mutate(data);
    }
  };

  const handleAddChannelSKU = () => {
    setEditingChannelSKU(null);
    channelSKUForm.reset({
      channelSKU: "",
      masterSKUId: "",
      channelId: "",
      channelListingId: "",
      isActive: true,
    });
    setChannelSKUDialogOpen(true);
  };

  const handleEditChannelSKU = (sku: ChannelSKU) => {
    setEditingChannelSKU(sku);
    channelSKUForm.reset({
      channelSKU: sku.channelSKU,
      masterSKUId: sku.masterSKUId,
      channelId: sku.channelId,
      channelListingId: sku.channelListingId || "",
      isActive: sku.isActive,
    });
    setChannelSKUDialogOpen(true);
  };

  const handleDeleteChannelSKU = async (id: string, sku: string) => {
    if (!confirm(`Are you sure you want to delete channel SKU "${sku}"?`)) return;
    deleteChannelSKUMutation.mutate(id);
  };

  const handleChannelSKUSubmit = (data: ChannelSKUFormData) => {
    if (editingChannelSKU) {
      updateChannelSKUMutation.mutate({ id: editingChannelSKU.id, data });
    } else {
      createChannelSKUMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">SKU Management</CardTitle>
          <p className="text-sm text-gray-600">
            Manage product SKUs and channel-specific SKU mappings
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="product-skus" data-testid="tab-product-skus">
                Product SKUs
              </TabsTrigger>
              <TabsTrigger value="channel-skus" data-testid="tab-channel-skus">
                Channel SKUs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="product-skus" className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search SKUs..."
                    value={productSKUSearch}
                    onChange={(e) => setProductSKUSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-product-skus"
                  />
                </div>
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="select-product-filter">
                    <SelectValue placeholder="All Products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {sortedProducts?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sizeFilter} onValueChange={setSizeFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-size-filter">
                    <SelectValue placeholder="All Sizes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sizes</SelectItem>
                    {productSizes?.map((size) => (
                      <SelectItem key={size.id} value={size.id}>
                        {size.sizeLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/admin/product-skus/export', {
                          headers: {
                            'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
                          }
                        });
                        if (!response.ok) throw new Error('Export failed');
                        const blob = await response.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'product-skus.csv';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast({
                          title: 'Export Complete',
                          description: 'Product SKUs exported successfully'
                        });
                      } catch (error) {
                        toast({
                          title: 'Export Failed',
                          description: error instanceof Error ? error.message : 'Unknown error',
                          variant: 'destructive'
                        });
                      }
                    }}
                    data-testid="button-export-product-skus"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.csv';
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const formData = new FormData();
                          formData.append('file', file);
                          try {
                            const response = await fetch('/api/admin/product-skus/import', {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
                              },
                              body: formData
                            });
                            const result = await response.json();
                            queryClient.invalidateQueries({ queryKey: ['/api/admin/product-skus'] });
                            toast({
                              title: 'Import Complete',
                              description: `Imported: ${result.imported}, Skipped: ${result.skipped}, Errors: ${result.errors?.length || 0}`
                            });
                          } catch (error) {
                            toast({
                              title: 'Import Failed',
                              description: error instanceof Error ? error.message : 'Unknown error',
                              variant: 'destructive'
                            });
                          }
                        }
                      };
                      input.click();
                    }}
                    data-testid="button-import-product-skus"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button onClick={handleAddProductSKU} data-testid="button-add-product-sku">
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              {loadingProductSKUs ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">SKU</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Product Title</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Media Type</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Size</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Status</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProductSKUs && filteredProductSKUs.length > 0 ? (
                      filteredProductSKUs.map((sku) => (
                        <TableRow key={sku.id} data-testid={`row-product-sku-${sku.id}`}>
                          <TableCell className="text-sm font-medium font-mono">{sku.sku}</TableCell>
                          <TableCell className="text-sm">{sku.productTitle || "N/A"}</TableCell>
                          <TableCell className="text-sm">{sku.mediaType}</TableCell>
                          <TableCell className="text-sm">{sku.sizeLabel || "N/A"}</TableCell>
                          <TableCell className="text-sm">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                sku.isActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                              data-testid={`status-product-sku-${sku.id}`}
                            >
                              {sku.isActive ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditProductSKU(sku)}
                                data-testid={`button-edit-product-sku-${sku.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProductSKU(sku.id, sku.sku)}
                                data-testid={`button-delete-product-sku-${sku.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          {productSKUSearch ? "No SKUs match your search" : "No product SKUs found"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="channel-skus" className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search channel SKUs..."
                    value={channelSKUSearch}
                    onChange={(e) => setChannelSKUSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-channel-skus"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/admin/channel-skus/export', {
                          headers: {
                            'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
                          }
                        });
                        if (!response.ok) throw new Error('Export failed');
                        const blob = await response.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'channel-skus.csv';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast({
                          title: 'Export Complete',
                          description: 'Channel SKUs exported successfully'
                        });
                      } catch (error) {
                        toast({
                          title: 'Export Failed',
                          description: error instanceof Error ? error.message : 'Unknown error',
                          variant: 'destructive'
                        });
                      }
                    }}
                    data-testid="button-export-channel-skus"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.csv';
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const formData = new FormData();
                          formData.append('file', file);
                          try {
                            const response = await fetch('/api/admin/channel-skus/import', {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
                              },
                              body: formData
                            });
                            const result = await response.json();
                            queryClient.invalidateQueries({ queryKey: ['/api/admin/channel-skus'] });
                            toast({
                              title: 'Import Complete',
                              description: `Imported: ${result.imported}, Skipped: ${result.skipped}, Errors: ${result.errors?.length || 0}`
                            });
                          } catch (error) {
                            toast({
                              title: 'Import Failed',
                              description: error instanceof Error ? error.message : 'Unknown error',
                              variant: 'destructive'
                            });
                          }
                        }
                      };
                      input.click();
                    }}
                    data-testid="button-import-channel-skus"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button onClick={handleAddChannelSKU} data-testid="button-add-channel-sku">
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              {loadingChannelSKUs ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Channel SKU</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Master SKU</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Sales Channel</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Channel Listing ID</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Status</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChannelSKUs && filteredChannelSKUs.length > 0 ? (
                      filteredChannelSKUs.map((sku) => (
                        <TableRow key={sku.id} data-testid={`row-channel-sku-${sku.id}`}>
                          <TableCell className="text-sm font-medium font-mono">{sku.channelSKU}</TableCell>
                          <TableCell className="text-sm font-mono">{sku.masterSKU || "N/A"}</TableCell>
                          <TableCell className="text-sm">{sku.channelName || "N/A"}</TableCell>
                          <TableCell className="text-sm">{sku.channelListingId || "—"}</TableCell>
                          <TableCell className="text-sm">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                sku.isActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                              data-testid={`status-channel-sku-${sku.id}`}
                            >
                              {sku.isActive ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditChannelSKU(sku)}
                                data-testid={`button-edit-channel-sku-${sku.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteChannelSKU(sku.id, sku.channelSKU)}
                                data-testid={`button-delete-channel-sku-${sku.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          {channelSKUSearch ? "No channel SKUs match your search" : "No channel SKUs found"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Product SKU Dialog */}
      <Dialog open={productSKUDialogOpen} onOpenChange={setProductSKUDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-product-sku">
          <DialogHeader>
            <DialogTitle>
              {editingProductSKU ? "Edit Product SKU" : "Add Product SKU"}
            </DialogTitle>
          </DialogHeader>

          <Form {...productSKUForm}>
            <form onSubmit={productSKUForm.handleSubmit(handleProductSKUSubmit)} className="space-y-4">
              <FormField
                control={productSKUForm.control}
                name="productId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Product</FormLabel>
                    <Popover open={productComboboxOpen} onOpenChange={setProductComboboxOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="justify-between"
                            data-testid="select-product"
                          >
                            {field.value
                              ? sortedProducts.find((product) => product.id === field.value)?.title
                              : "Select a product"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0">
                        <Command>
                          <CommandInput placeholder="Search products..." />
                          <CommandList>
                            <CommandEmpty>No product found.</CommandEmpty>
                            <CommandGroup>
                              {sortedProducts.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={product.title}
                                  onSelect={() => {
                                    const currentSize = productSKUForm.getValues("productSizeId");
                                    field.onChange(product.id);
                                    
                                    // Clear size if it's not eligible for the new product
                                    if (currentSize) {
                                      const selectedProduct = products?.find(p => p.id === product.id);
                                      const currentSizeObj = productSizes?.find(s => s.id === currentSize);
                                      if (selectedProduct && currentSizeObj) {
                                        // Normalize aspect ratios for comparison (handle both "3:2" and "3x2")
                                        const normalizeRatio = (ratio: string) => ratio.toLowerCase().replace(/[x×]/g, ':');
                                        const allowedRatios = (selectedProduct.aspectRatios && selectedProduct.aspectRatios.length > 0)
                                          ? selectedProduct.aspectRatios
                                          : [selectedProduct.aspectRatio];
                                        const allowedSet = new Set(allowedRatios.map(normalizeRatio));
                                        if (!allowedSet.has(normalizeRatio(currentSizeObj.aspectRatio))) {
                                          productSKUForm.setValue("productSizeId", "");
                                        }
                                      }
                                    }
                                    
                                    setProductComboboxOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      field.value === product.id ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {product.title}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={productSKUForm.control}
                name="mediaType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Media Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-media-type">
                          <SelectValue placeholder="Select media type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MEDIA_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={productSKUForm.control}
                name="productSizeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Size {selectedProductId && eligibleSizes.length > 0 && `(${eligibleSizes.length} matching)`}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product-size">
                          <SelectValue placeholder={selectedProductId ? "Select a size" : "Select a product first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eligibleSizes.length > 0 ? (
                          eligibleSizes.map((size) => (
                            <SelectItem key={size.id} value={size.id}>
                              {size.sizeLabel} ({size.widthInches}" × {size.heightInches}")
                            </SelectItem>
                          ))
                        ) : selectedProductId ? (
                          <div className="px-2 py-1.5 text-sm text-gray-500">
                            No sizes match this product's aspect ratio
                          </div>
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-gray-500">
                            Please select a product first
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-end gap-2">
                <FormField
                  control={productSKUForm.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>SKU Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., TRUL2020-CL-24x36"
                          className="font-mono"
                          data-testid="input-sku"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAutoGenerateSKU}
                  data-testid="button-auto-generate-sku"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Auto-generate
                </Button>
              </div>

              <FormField
                control={productSKUForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <div className="text-sm text-gray-600">
                        Set whether this SKU is currently active
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProductSKUDialogOpen(false)}
                  data-testid="button-cancel-product-sku"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createProductSKUMutation.isPending || updateProductSKUMutation.isPending}
                  data-testid="button-save-product-sku"
                >
                  {editingProductSKU ? "Update" : "Create"} SKU
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Channel SKU Dialog */}
      <Dialog open={channelSKUDialogOpen} onOpenChange={setChannelSKUDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-channel-sku">
          <DialogHeader>
            <DialogTitle>
              {editingChannelSKU ? "Edit Channel SKU" : "Add Channel SKU"}
            </DialogTitle>
          </DialogHeader>

          <Form {...channelSKUForm}>
            <form onSubmit={channelSKUForm.handleSubmit(handleChannelSKUSubmit)} className="space-y-4">
              <FormField
                control={channelSKUForm.control}
                name="masterSKUId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Master SKU</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-master-sku">
                          <SelectValue placeholder="Select a master SKU" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productSKUs?.map((sku) => (
                          <SelectItem key={sku.id} value={sku.id}>
                            {sku.sku} - {sku.productTitle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={channelSKUForm.control}
                name="channelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales Channel</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-sales-channel">
                          <SelectValue placeholder="Select a sales channel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {salesChannels?.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={channelSKUForm.control}
                name="channelSKU"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel SKU</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., AMZN-TRUL2020-CL-24x36"
                        className="font-mono"
                        data-testid="input-channel-sku"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={channelSKUForm.control}
                name="channelListingId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel Listing ID (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="External listing ID from sales channel"
                        data-testid="input-channel-listing-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={channelSKUForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <div className="text-sm text-gray-600">
                        Set whether this channel SKU is currently active
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-channel-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setChannelSKUDialogOpen(false)}
                  data-testid="button-cancel-channel-sku"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createChannelSKUMutation.isPending || updateChannelSKUMutation.isPending}
                  data-testid="button-save-channel-sku"
                >
                  {editingChannelSKU ? "Update" : "Create"} Channel SKU
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
