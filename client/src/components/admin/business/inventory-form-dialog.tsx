import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  title: string;
  photoId: string | null;
  aspectRatio: string;
}

interface ProductSize {
  id: string;
  sizeLabel: string;
  aspectRatio: string;
}

interface Supplier {
  id: string;
  name: string;
  isActive: boolean;
}

interface InventoryItem {
  id: string;
  productId: string;
  productSKUId: string | null;
  supplierId: string;
  mediaType: string;
  productSizeId: string;
  acquisitionCost: number;
  listPrice: number;
  status: string;
  purchaseDate?: string | null;
  soldDate?: string | null;
  notes?: string;
}

interface InventoryFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingItem?: InventoryItem | null;
}

const inventorySchema = z.object({
  productId: z.string().min(1, "Product is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  mediaType: z.string().min(1, "Media type is required"),
  productSizeId: z.string().min(1, "Size is required"),
  acquisitionCost: z.string().min(1, "Acquisition cost is required"),
  listPrice: z.string().min(1, "List price is required"),
  status: z.string().min(1, "Status is required"),
  purchaseDate: z.string().optional(),
  soldDate: z.string().optional(),
  notes: z.string().optional(),
});

type InventoryFormData = z.infer<typeof inventorySchema>;

export default function InventoryFormDialog({ open, onClose, editingItem }: InventoryFormDialogProps) {
  const { toast } = useToast();
  const [addSizeDialogOpen, setAddSizeDialogOpen] = useState(false);
  const [newSizeLabel, setNewSizeLabel] = useState("");
  const [isAddingSize, setIsAddingSize] = useState(false);
  const [selectedProductAspectRatio, setSelectedProductAspectRatio] = useState<string | null>(null);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [isManualPrice, setIsManualPrice] = useState(false);
  const [lastAutoFilledPrice, setLastAutoFilledPrice] = useState<string | null>(null);

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: open,
  });

  const { data: productSizes } = useQuery<ProductSize[]>({
    queryKey: ["/api/admin/product-sizes"],
    enabled: open,
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/admin/suppliers"],
    enabled: open,
  });

  // Watch for size and media type changes to auto-fill price
  const watchedSizeId = form.watch("productSizeId");
  const watchedMediaType = form.watch("mediaType");

  // Fetch retail price when size and media type are both selected
  const { data: retailPriceData, isLoading: isLoadingPrice } = useQuery<{ retailPrice: number } | null>({
    queryKey: ["/api/admin/retail-prices", watchedSizeId, watchedMediaType],
    enabled: open && !!watchedSizeId && !!watchedMediaType,
  });

  // Sort products by name/title alphabetically
  const sortedProducts = useMemo(() => {
    if (!products) return [];
    return [...products].sort((a, b) => a.title.localeCompare(b.title));
  }, [products]);

  // Filter product sizes based on selected product's aspect ratio
  // Convert product aspectRatio format (e.g., "3x2") to match product_sizes format (e.g., "3:2")
  const convertedAspectRatio = selectedProductAspectRatio?.replace('x', ':');
  const filteredProductSizes = convertedAspectRatio
    ? productSizes?.filter(size => size.aspectRatio === convertedAspectRatio)
    : productSizes;

  const form = useForm<InventoryFormData>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      productId: "",
      supplierId: "",
      mediaType: "ChromaLuxe",
      productSizeId: "",
      acquisitionCost: "",
      listPrice: "",
      status: "ordered",
      purchaseDate: "",
      soldDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({
        productId: editingItem.productId,
        supplierId: editingItem.supplierId,
        mediaType: editingItem.mediaType,
        productSizeId: editingItem.productSizeId,
        acquisitionCost: (editingItem.acquisitionCost / 100).toFixed(2),
        listPrice: (editingItem.listPrice / 100).toFixed(2),
        status: editingItem.status,
        purchaseDate: editingItem.purchaseDate ? new Date(editingItem.purchaseDate).toISOString().split('T')[0] : "",
        soldDate: editingItem.soldDate ? new Date(editingItem.soldDate).toISOString().split('T')[0] : "",
        notes: editingItem.notes || "",
      });
      // Set the aspect ratio for the edited item's product
      const product = products?.find(p => p.id === editingItem.productId);
      if (product) {
        setSelectedProductAspectRatio(product.aspectRatio);
      }
      // Reset manual price flag when editing
      setIsManualPrice(false);
      setLastAutoFilledPrice(null);
    } else {
      form.reset({
        productId: "",
        supplierId: "",
        mediaType: "ChromaLuxe",
        productSizeId: "",
        acquisitionCost: "",
        listPrice: "",
        status: "ordered",
        purchaseDate: "",
        soldDate: "",
        notes: "",
      });
      setSelectedProductAspectRatio(null);
      setIsManualPrice(false);
      setLastAutoFilledPrice(null);
    }
  }, [editingItem, form, open, products]);

  // Auto-fill price when retail price data is available
  useEffect(() => {
    // Only auto-fill if user hasn't manually entered a price
    if (!isManualPrice && retailPriceData && retailPriceData.retailPrice !== undefined) {
      const priceInDollars = (retailPriceData.retailPrice / 100).toFixed(2);
      setLastAutoFilledPrice(priceInDollars);
      form.setValue("listPrice", priceInDollars);
    } else if (!isManualPrice && retailPriceData === null) {
      // No retail price found - clear the field
      form.setValue("listPrice", "");
      setLastAutoFilledPrice(null);
    }
  }, [retailPriceData, isManualPrice, form]);

  // Reset manual price flag when size or media type changes
  useEffect(() => {
    setIsManualPrice(false);
  }, [watchedSizeId, watchedMediaType]);

  const handleAddCustomSize = async () => {
    if (!newSizeLabel.trim()) {
      toast({
        title: "Error",
        description: "Please enter a size label",
        variant: "destructive",
      });
      return;
    }

    setIsAddingSize(true);
    try {
      await apiRequest("POST", "/api/admin/product-sizes", {
        sizeLabel: newSizeLabel.trim(),
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/product-sizes"] });

      toast({
        title: "Success",
        description: `Size "${newSizeLabel}" added successfully`,
      });

      setNewSizeLabel("");
      setAddSizeDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add custom size",
        variant: "destructive",
      });
    } finally {
      setIsAddingSize(false);
    }
  };

  const onSubmit = async (data: InventoryFormData) => {
    try {
      const payload = {
        ...data,
        acquisitionCost: Math.round(parseFloat(data.acquisitionCost) * 100),
        listPrice: Math.round(parseFloat(data.listPrice) * 100),
        purchaseDate: data.purchaseDate && data.purchaseDate.trim() !== "" ? data.purchaseDate : undefined,
        soldDate: data.soldDate && data.soldDate.trim() !== "" ? data.soldDate : undefined,
      };

      if (editingItem) {
        await apiRequest("PUT", `/api/admin/inventory/${editingItem.id}`, payload);
      } else {
        await apiRequest("POST", "/api/admin/inventory", payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory/details"] });

      toast({
        title: "Success",
        description: `Inventory item ${editingItem ? "updated" : "created"} successfully`,
      });

      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${editingItem ? "update" : "create"} inventory item`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Product</FormLabel>
                    <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={productSearchOpen}
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="select-product"
                          >
                            {field.value
                              ? sortedProducts.find((product) => product.id === field.value)?.title
                              : "Select a product"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
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
                                    field.onChange(product.id);
                                    setSelectedProductAspectRatio(product.aspectRatio);
                                    form.setValue("productSizeId", "");
                                    setProductSearchOpen(false);
                                  }}
                                  data-testid={`product-option-${product.id}`}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === product.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {product.title} ({product.aspectRatio})
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

            </div>

            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-supplier">
                        <SelectValue placeholder="Select a supplier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers?.filter(s => s.isActive).map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mediaType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Media Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-media-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ChromaLuxe">ChromaLuxe</SelectItem>
                      <SelectItem value="Magnet">Magnet</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productSizeId"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Size</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAddSizeDialogOpen(true)}
                        data-testid="button-add-custom-size"
                        className="h-7 text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Custom
                      </Button>
                    </div>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-size">
                          <SelectValue placeholder="Select a size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredProductSizes?.length ? (
                          filteredProductSizes.map((size) => (
                            <SelectItem key={size.id} value={size.id}>
                              {size.sizeLabel}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                            {selectedProductAspectRatio 
                              ? "No sizes available for this aspect ratio" 
                              : "Please select a product first"}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ordered">Ordered</SelectItem>
                        <SelectItem value="in_stock">In Stock</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acquisition Date (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-purchase-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="soldDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Date (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-sold-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="acquisitionCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acquisition Cost ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-acquisition-cost"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="listPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>List Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          // Mark as manual if user changes the value
                          const currentValue = e.target.value;
                          if (currentValue !== lastAutoFilledPrice) {
                            setIsManualPrice(true);
                          }
                        }}
                        disabled={isLoadingPrice}
                        data-testid="input-list-price"
                      />
                    </FormControl>
                    {isLoadingPrice && (
                      <p className="text-xs text-muted-foreground">Loading price...</p>
                    )}
                    {!isLoadingPrice && watchedSizeId && watchedMediaType && !field.value && (
                      <p className="text-xs text-amber-600">No retail price found for this size/media combination. Please enter a price or update retail pricing.</p>
                    )}
                    {!isLoadingPrice && field.value && !isManualPrice && (
                      <p className="text-xs text-green-600">Auto-filled from retail pricing</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                data-testid="button-submit"
              >
                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Add Custom Size Dialog */}
      <Dialog open={addSizeDialogOpen} onOpenChange={setAddSizeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Size</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="size-label" className="text-sm font-medium">
                Size Label
              </label>
              <Input
                id="size-label"
                value={newSizeLabel}
                onChange={(e) => setNewSizeLabel(e.target.value)}
                placeholder="e.g., 60x45"
                data-testid="input-custom-size-label"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomSize();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddSizeDialogOpen(false);
                setNewSizeLabel("");
              }}
              data-testid="button-cancel-custom-size"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddCustomSize}
              disabled={isAddingSize}
              data-testid="button-submit-custom-size"
              className="bg-green-600 hover:bg-green-700"
            >
              {isAddingSize && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Size
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
