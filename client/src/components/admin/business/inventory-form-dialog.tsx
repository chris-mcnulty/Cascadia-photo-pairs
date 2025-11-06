import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface Photo {
  id: string;
  title: string;
}

interface ProductSize {
  id: string;
  sizeLabel: string;
}

interface InventoryItem {
  id: string;
  photoId: string;
  title: string;
  description?: string;
  originalDate?: string;
  mediaType: string;
  productSizeId: string;
  acquisitionCost: number;
  listPrice: number;
  status: string;
  notes?: string;
}

interface InventoryFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingItem?: InventoryItem | null;
}

const inventorySchema = z.object({
  photoId: z.string().min(1, "Photo is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  originalDate: z.string().optional(),
  mediaType: z.string().min(1, "Media type is required"),
  productSizeId: z.string().min(1, "Size is required"),
  acquisitionCost: z.string().min(1, "Acquisition cost is required"),
  listPrice: z.string().min(1, "List price is required"),
  status: z.string().min(1, "Status is required"),
  notes: z.string().optional(),
});

type InventoryFormData = z.infer<typeof inventorySchema>;

export default function InventoryFormDialog({ open, onClose, editingItem }: InventoryFormDialogProps) {
  const { toast } = useToast();

  const { data: photos } = useQuery<Photo[]>({
    queryKey: ["/api/admin/photos"],
    enabled: open,
  });

  const { data: productSizes } = useQuery<ProductSize[]>({
    queryKey: ["/api/admin/product-sizes"],
    enabled: open,
  });

  const form = useForm<InventoryFormData>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      photoId: "",
      title: "",
      description: "",
      originalDate: "",
      mediaType: "ChromaLuxe",
      productSizeId: "",
      acquisitionCost: "",
      listPrice: "",
      status: "ordered",
      notes: "",
    },
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({
        photoId: editingItem.photoId,
        title: editingItem.title,
        description: editingItem.description || "",
        originalDate: editingItem.originalDate || "",
        mediaType: editingItem.mediaType,
        productSizeId: editingItem.productSizeId,
        acquisitionCost: (editingItem.acquisitionCost / 100).toFixed(2),
        listPrice: (editingItem.listPrice / 100).toFixed(2),
        status: editingItem.status,
        notes: editingItem.notes || "",
      });
    } else {
      form.reset({
        photoId: "",
        title: "",
        description: "",
        originalDate: "",
        mediaType: "ChromaLuxe",
        productSizeId: "",
        acquisitionCost: "",
        listPrice: "",
        status: "ordered",
        notes: "",
      });
    }
  }, [editingItem, form, open]);

  const onSubmit = async (data: InventoryFormData) => {
    try {
      const payload = {
        ...data,
        acquisitionCost: Math.round(parseFloat(data.acquisitionCost) * 100),
        listPrice: Math.round(parseFloat(data.listPrice) * 100),
      };

      if (editingItem) {
        await apiRequest("PUT", `/api/admin/inventory/${editingItem.id}`, payload);
      } else {
        await apiRequest("POST", "/api/admin/inventory", payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory"] });
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
                name="photoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-photo">
                          <SelectValue placeholder="Select a photo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {photos?.map((photo) => (
                          <SelectItem key={photo.id} value={photo.id}>
                            {photo.title}
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
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} data-testid="input-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="originalDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Original Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-original-date" />
                    </FormControl>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productSizeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-size">
                          <SelectValue placeholder="Select a size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productSizes?.map((size) => (
                          <SelectItem key={size.id} value={size.id}>
                            {size.sizeLabel}
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
                        data-testid="input-list-price"
                      />
                    </FormControl>
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
    </Dialog>
  );
}
