import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Image, Package2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, Photo } from "@shared/schema";
import { cn } from "@/lib/utils";

// Form schema for product creation/editing
const productFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  photoId: z.string().nullable(),
  aspectRatio: z.string().min(1, "Aspect ratio is required"),
  description: z.string().optional(),
  isActive: z.boolean(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export default function ProductManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [photoComboboxOpen, setPhotoComboboxOpen] = useState(false);
  const { toast } = useToast();

  // Fetch all products
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Fetch all photos for the photo selector
  const { data: photos = [] } = useQuery<Photo[]>({
    queryKey: ["/api/photos"],
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      title: "",
      photoId: null,
      aspectRatio: "3x2",
      description: "",
      isActive: true,
    },
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const res = await apiRequest("POST", "/api/products", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product created successfully" });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to create product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ProductFormValues }) => {
      const res = await apiRequest("PATCH", `/api/products/${id}`, values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product updated successfully" });
      setEditingProduct(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to update product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/products/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product deleted successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ProductFormValues) => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, values });
    } else {
      createProductMutation.mutate(values);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      title: product.title,
      photoId: product.photoId,
      aspectRatio: product.aspectRatio,
      description: product.description || "",
      isActive: product.isActive,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this product? This may affect existing inventory and sales.")) {
      deleteProductMutation.mutate(id);
    }
  };

  const getPhotoName = (photoId: string | null) => {
    if (!photoId) return "No photo linked";
    const photo = photos.find((p) => p.id === photoId);
    return photo?.title || "Unknown photo";
  };

  const aspectRatioOptions = [
    { value: "3x2", label: "3x2 (Landscape)" },
    { value: "2x3", label: "2x3 (Portrait)" },
    { value: "4x3", label: "4x3 (Landscape)" },
    { value: "3x4", label: "3x4 (Portrait)" },
    { value: "5x4", label: "5x4 (Portrait)" },
    { value: "4x5", label: "4x5 (Landscape)" },
    { value: "16x9", label: "16x9 (Wide)" },
    { value: "1x1", label: "1x1 (Square)" },
    { value: "5x7", label: "5x7 (Standard)" },
    { value: "7x5", label: "7x5 (Standard Landscape)" },
  ];

  // Sort photos alphabetically by title (memoized for performance)
  const sortedPhotos = useMemo(
    () => [...photos].sort((a, b) => (a.title || "").localeCompare(b.title || "")),
    [photos]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Product Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage your product catalog. Products can be linked to photos or exist independently.
          </p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="flex items-center"
          data-testid="button-add-product"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Products Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Photo</TableHead>
              <TableHead>Aspect Ratio</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Loading products...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No products yet. Add your first product to get started.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const linkedPhoto = product.photoId ? photos.find(p => p.id === product.photoId) : null;
                return (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        {linkedPhoto?.imageUrl ? (
                          <img
                            src={linkedPhoto.imageUrl}
                            alt={product.title}
                            className="w-12 h-12 object-cover rounded mr-2"
                            data-testid={`img-product-${product.id}`}
                            onError={(e) => {
                              // Fallback to icon if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallbackIcon = target.nextElementSibling as HTMLElement;
                              if (fallbackIcon) fallbackIcon.style.display = 'block';
                            }}
                          />
                        ) : null}
                        <div style={{ display: linkedPhoto?.imageUrl ? 'none' : 'flex' }} className="w-12 h-12 bg-gray-100 rounded mr-2 items-center justify-center">
                          {product.photoId ? (
                            <Image className="w-6 h-6 text-muted-foreground" />
                          ) : (
                            <Package2 className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <span>{product.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getPhotoName(product.photoId)}</TableCell>
                  <TableCell>{product.aspectRatio}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        product.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(product)}
                        data-testid={`button-edit-product-${product.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(product.id)}
                        data-testid={`button-delete-product-${product.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Product Dialog */}
      <Dialog
        open={isAddDialogOpen || !!editingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingProduct(null);
            form.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Update the product details below."
                : "Create a new product. You can link it to a photo or keep it as a standalone product."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Mountain Vista Print"
                        {...field}
                        data-testid="input-product-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="photoId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Linked Photo (Optional)</FormLabel>
                    <Popover open={photoComboboxOpen} onOpenChange={setPhotoComboboxOpen} modal={true}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={photoComboboxOpen}
                            className="w-full justify-between"
                            data-testid="select-photo"
                          >
                            {field.value
                              ? sortedPhotos.find((photo) => photo.id === field.value)?.title || "Unknown photo"
                              : "No photo linked"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search photos..." />
                          <CommandList>
                            <CommandEmpty>No photo found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  field.onChange(null);
                                  setPhotoComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !field.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                No photo linked
                              </CommandItem>
                              {sortedPhotos.map((photo) => (
                                <CommandItem
                                  key={photo.id}
                                  value={photo.title}
                                  onSelect={() => {
                                    field.onChange(photo.id);
                                    setPhotoComboboxOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === photo.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {photo.title}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Link this product to a specific photo from your gallery
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aspectRatio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aspect Ratio</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-aspect-ratio">
                          <SelectValue placeholder="Select aspect ratio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {aspectRatioOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The aspect ratio determines compatible print sizes
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Product description..."
                        className="resize-none"
                        {...field}
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-active"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Active products can be added to inventory and sold
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingProduct(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createProductMutation.isPending ||
                    updateProductMutation.isPending
                  }
                  data-testid="button-submit-product"
                >
                  {editingProduct ? "Update Product" : "Create Product"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}