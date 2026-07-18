import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Package, Truck } from "lucide-react";

interface Product {
  id: string;
  title: string;
}

interface SalesChannel {
  id: string;
  name: string;
  isActive: boolean;
}

interface Supplier {
  id: string;
  name: string;
  isActive: boolean;
}

interface InventoryItem {
  id: string;
  productId: string;
  productTitle?: string;
  mediaType: string;
  sizeLabel?: string;
  status: string;
  acquisitionCost: number;
  listPrice: number;
}

interface Sale {
  id: string;
  orderNumber?: string | null;
  productId: string | null;
  channelId: string;
  saleDate: string;
  soldPrice: number;
  taxCollected: number;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  shippingAddress?: string | null;
  notes?: string | null;
  saleType?: "inventory" | "dropship";
  inventoryItemId?: string | null;
  supplierId?: string | null;
  acquisitionCost?: number | null;
}

interface SalesFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingSale?: Sale | null;
}

const salesSchema = z.object({
  orderNumber: z.string().optional(),
  saleType: z.enum(["inventory", "dropship"]).default("inventory"),
  productId: z.string().optional(),
  inventoryItemId: z.string().optional(),
  supplierId: z.string().optional(),
  acquisitionCost: z.string().optional(),
  channelId: z.string().min(1, "Sales channel is required"),
  saleDate: z.string().min(1, "Sale date is required"),
  soldPrice: z.string().min(1, "Sale price is required"),
  taxCollected: z.string().optional(),
  buyerName: z.string().optional(),
  buyerEmail: z.string().email().optional().or(z.literal("")),
  buyerPhone: z.string().optional(),
  shippingAddress: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  // If sale type is inventory, must select an inventory item
  if (data.saleType === "inventory" && !data.inventoryItemId) {
    return false;
  }
  // If sale type is dropship, must select a supplier and product
  if (data.saleType === "dropship" && (!data.supplierId || !data.productId)) {
    return false;
  }
  return true;
}, {
  message: "Please select an inventory item for inventory sales, or a product and supplier for drop ship sales",
  path: ["saleType"],
});

type SalesFormData = z.infer<typeof salesSchema>;

export default function SalesFormDialog({ open, onClose, editingSale }: SalesFormDialogProps) {
  const { toast } = useToast();
  const [saleType, setSaleType] = useState<"inventory" | "dropship">("inventory");
  const [showAllInventory, setShowAllInventory] = useState(false);

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: open,
  });

  const { data: channels } = useQuery<SalesChannel[]>({
    queryKey: ["/api/admin/sales-channels"],
    enabled: open,
  });

  const inventoryQueryKey = showAllInventory
    ? "/api/admin/inventory/all"
    : "/api/admin/inventory/available";

  const { data: inventoryItems } = useQuery<InventoryItem[]>({
    queryKey: [inventoryQueryKey],
    enabled: open && saleType === "inventory",
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    enabled: open && saleType === "dropship",
  });

  const { data: nextOrderNumberData } = useQuery<{ nextOrderNumber: string }>({
    queryKey: ["/api/admin/sales/next-order-number"],
    enabled: open && !editingSale,
  });

  const form = useForm<SalesFormData>({
    resolver: zodResolver(salesSchema),
    defaultValues: {
      orderNumber: "",
      saleType: "inventory",
      productId: "",
      inventoryItemId: "",
      supplierId: "",
      acquisitionCost: "",
      channelId: "",
      saleDate: new Date().toISOString().split('T')[0],
      soldPrice: "",
      taxCollected: "0.00",
      buyerName: "",
      buyerEmail: "",
      buyerPhone: "",
      shippingAddress: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (editingSale) {
      form.reset({
        orderNumber: editingSale.orderNumber || "",
        saleType: editingSale.saleType || "inventory",
        productId: editingSale.productId || "",
        inventoryItemId: editingSale.inventoryItemId || "",
        supplierId: editingSale.supplierId || "",
        acquisitionCost: editingSale.acquisitionCost != null ? (editingSale.acquisitionCost / 100).toFixed(2) : "",
        channelId: editingSale.channelId,
        saleDate: editingSale.saleDate.split('T')[0],
        soldPrice: (editingSale.soldPrice / 100).toFixed(2),
        taxCollected: (editingSale.taxCollected / 100).toFixed(2),
        buyerName: editingSale.buyerName || "",
        buyerEmail: editingSale.buyerEmail || "",
        buyerPhone: editingSale.buyerPhone || "",
        shippingAddress: editingSale.shippingAddress || "",
        notes: editingSale.notes || "",
      });
      setSaleType(editingSale.saleType || "inventory");
      setShowAllInventory(false);
    } else {
      form.reset({
        orderNumber: nextOrderNumberData?.nextOrderNumber || "",
        saleType: "inventory",
        productId: "",
        inventoryItemId: "",
        supplierId: "",
        acquisitionCost: "",
        channelId: "",
        saleDate: new Date().toISOString().split('T')[0],
        soldPrice: "",
        taxCollected: "0.00",
        buyerName: "",
        buyerEmail: "",
        buyerPhone: "",
        shippingAddress: "",
        notes: "",
      });
      setSaleType("inventory");
      setShowAllInventory(false);
    }
  }, [editingSale, form, open, nextOrderNumberData]);

  // Watch sale type changes
  const watchedSaleType = form.watch("saleType");
  useEffect(() => {
    setSaleType(watchedSaleType);
    // Reset related fields when sale type changes
    if (watchedSaleType === "inventory") {
      form.setValue("supplierId", "");
      form.setValue("productId", "");
    } else if (watchedSaleType === "dropship") {
      form.setValue("inventoryItemId", "");
    }
  }, [watchedSaleType, form]);

  // Auto-fill price when inventory item is selected
  const watchedInventoryItem = form.watch("inventoryItemId");
  useEffect(() => {
    if (watchedInventoryItem && inventoryItems) {
      const item = inventoryItems.find(i => i.id === watchedInventoryItem);
      if (item) {
        form.setValue("soldPrice", (item.listPrice / 100).toFixed(2));
        form.setValue("productId", item.productId);
      }
    }
  }, [watchedInventoryItem, inventoryItems, form]);

  const createSaleMutation = useMutation({
    mutationFn: async (data: SalesFormData) => {
      const saleData = {
        orderNumber: data.orderNumber || null,
        saleType: data.saleType,
        productId: data.productId || null,
        inventoryItemId: data.inventoryItemId || null,
        supplierId: data.supplierId || null,
        acquisitionCost: data.saleType === "dropship" && data.acquisitionCost
          ? Math.round(parseFloat(data.acquisitionCost) * 100)
          : null,
        channelId: data.channelId,
        saleDate: new Date(data.saleDate).toISOString(),
        soldPrice: Math.round(parseFloat(data.soldPrice) * 100),
        taxCollected: Math.round(parseFloat(data.taxCollected || "0") * 100),
        buyerName: data.buyerName || null,
        buyerEmail: data.buyerEmail || null,
        buyerPhone: data.buyerPhone || null,
        shippingAddress: data.shippingAddress || null,
        notes: data.notes || null,
        overrideInventoryGuard: showAllInventory,
      };

      return apiRequest("POST", "/api/admin/sales", saleData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Sale recorded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory/details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales/next-order-number"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record sale",
        variant: "destructive",
      });
    },
  });

  const updateSaleMutation = useMutation({
    mutationFn: async (data: SalesFormData) => {
      if (!editingSale) throw new Error("No sale to update");

      const saleData = {
        orderNumber: data.orderNumber || null,
        saleType: data.saleType,
        productId: data.productId || null,
        inventoryItemId: data.inventoryItemId || null,
        supplierId: data.supplierId || null,
        acquisitionCost: data.saleType === "dropship" && data.acquisitionCost
          ? Math.round(parseFloat(data.acquisitionCost) * 100)
          : null,
        channelId: data.channelId,
        saleDate: new Date(data.saleDate).toISOString(),
        soldPrice: Math.round(parseFloat(data.soldPrice) * 100),
        taxCollected: Math.round(parseFloat(data.taxCollected || "0") * 100),
        buyerName: data.buyerName || null,
        buyerEmail: data.buyerEmail || null,
        buyerPhone: data.buyerPhone || null,
        shippingAddress: data.shippingAddress || null,
        notes: data.notes || null,
      };

      return apiRequest("PUT", `/api/admin/sales/${editingSale.id}`, saleData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Sale updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update sale",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SalesFormData) => {
    if (editingSale) {
      updateSaleMutation.mutate(data);
    } else {
      createSaleMutation.mutate(data);
    }
  };

  const isLoading = createSaleMutation.isPending || updateSaleMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingSale ? "Edit Sale" : "Record Sale"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="orderNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="10010"
                      {...field}
                      data-testid="input-order-number"
                    />
                  </FormControl>
                  <FormDescription>
                    Auto-filled with the next available number; edit if needed.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sale Type Selection */}
            <FormField
              control={form.control}
              name="saleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale Type *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-6"
                      data-testid="radio-sale-type"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="inventory" id="inventory" />
                        <label htmlFor="inventory" className="flex items-center gap-2 cursor-pointer">
                          <Package className="h-4 w-4" />
                          Inventory Sale
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dropship" id="dropship" />
                        <label htmlFor="dropship" className="flex items-center gap-2 cursor-pointer">
                          <Truck className="h-4 w-4" />
                          Drop Ship Sale
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    {saleType === "inventory" 
                      ? "Sell from your existing inventory stock" 
                      : "Supplier ships directly to customer"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Conditional fields based on sale type */}
              {saleType === "inventory" ? (
                <div className="col-span-2 space-y-2">
                  <FormField
                    control={form.control}
                    name="inventoryItemId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inventory Item *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-inventory-item">
                              <SelectValue placeholder="Select inventory item" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {inventoryItems?.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                <span className="flex items-center gap-2">
                                  {item.productTitle} — {item.mediaType} {item.sizeLabel} (${(item.listPrice / 100).toFixed(2)})
                                  {item.status !== "in_stock" && item.status !== "on_exhibit" && (
                                    <span className="ml-1 text-xs text-amber-600 font-medium">[{item.status}]</span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="showAllInventory"
                      checked={showAllInventory}
                      onCheckedChange={(v) => {
                        setShowAllInventory(!!v);
                        form.setValue("inventoryItemId", "");
                      }}
                      data-testid="checkbox-show-all-inventory"
                    />
                    <label htmlFor="showAllInventory" className="text-sm text-gray-600 cursor-pointer select-none">
                      Show all inventory items (including already sold) — cleanup override
                    </label>
                  </div>
                  {showAllInventory && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Override active — item status will be set to <strong>sold</strong> even if already marked sold. Use this to backfill missing sale records.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-product">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products?.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.title}
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
                    name="supplierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-supplier">
                              <SelectValue placeholder="Select supplier" />
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
                        <FormDescription>
                          Supplier for drop shipment
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="acquisitionCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier Cost</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            data-testid="input-acquisition-cost"
                          />
                        </FormControl>
                        <FormDescription>
                          What the supplier charged for this item, used to calculate profit
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="channelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales Channel *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-channel">
                          <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {channels?.filter(c => c.isActive).map((channel) => (
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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="saleDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-sale-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="soldPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Price *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-sold-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxCollected"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Collected</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-tax-collected"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Buyer Information (Optional)</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="buyerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buyer Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          {...field}
                          data-testid="input-buyer-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="buyerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buyer Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="buyer@example.com"
                          {...field}
                          data-testid="input-buyer-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="buyerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buyer Phone</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="(555) 123-4567"
                        {...field}
                        data-testid="input-buyer-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shippingAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="123 Main St, City, State ZIP"
                        {...field}
                        data-testid="textarea-shipping-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about this sale..."
                        {...field}
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingSale ? "Update Sale" : "Record Sale"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
