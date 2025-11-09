import { useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface Product {
  id: string;
  title: string;
}

interface SalesChannel {
  id: string;
  name: string;
  isActive: boolean;
}

interface Sale {
  id: string;
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
}

interface SalesFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingSale?: Sale | null;
}

const salesSchema = z.object({
  productId: z.string().optional(),
  channelId: z.string().min(1, "Sales channel is required"),
  saleDate: z.string().min(1, "Sale date is required"),
  soldPrice: z.string().min(1, "Sale price is required"),
  taxCollected: z.string().optional(),
  buyerName: z.string().optional(),
  buyerEmail: z.string().email().optional().or(z.literal("")),
  buyerPhone: z.string().optional(),
  shippingAddress: z.string().optional(),
  notes: z.string().optional(),
});

type SalesFormData = z.infer<typeof salesSchema>;

export default function SalesFormDialog({ open, onClose, editingSale }: SalesFormDialogProps) {
  const { toast } = useToast();

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: open,
  });

  const { data: channels } = useQuery<SalesChannel[]>({
    queryKey: ["/api/admin/sales-channels"],
    enabled: open,
  });

  const form = useForm<SalesFormData>({
    resolver: zodResolver(salesSchema),
    defaultValues: {
      productId: "",
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
        productId: editingSale.productId || "",
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
    } else {
      form.reset({
        productId: "",
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
    }
  }, [editingSale, form, open]);

  const createSaleMutation = useMutation({
    mutationFn: async (data: SalesFormData) => {
      const saleData = {
        productId: data.productId || null,
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

      return apiRequest("POST", "/api/admin/sales", saleData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Sale recorded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });
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
        productId: data.productId || null,
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product (Optional)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No product linked</SelectItem>
                        {products?.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Link to a product (optional for non-inventory sales)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
