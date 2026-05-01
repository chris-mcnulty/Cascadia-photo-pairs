import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Image, Package2, Check, ChevronsUpDown, ChevronDown, ChevronRight } from "lucide-react";
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
import type { Product, Photo, ProductSKU, ProductSize } from "@shared/schema";
import { cn } from "@/lib/utils";

// Form schema for product creation/editing
const productFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  photoId: z.string().nullable(),
  aspectRatio: z.string().min(1, "A primary aspect ratio is required"),
  aspectRatios: z.array(z.string()).min(1, "At least one aspect ratio is required"),
  description: z.string().optional(),
  externalId: z.string().optional(),
  isActive: z.boolean(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export default function ProductManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [photoComboboxOpen, setPhotoComboboxOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [aspectFilter, setAspectFilter] = useState<string>("all");
  const [photoFilter, setPhotoFilter] = useState<"all" | "with-photo" | "no-photo">("all");
  const [sortBy, setSortBy] = useState<"title" | "aspectRatio" | "created">("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch all products
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Fetch all photos for the photo selector
  const { data: photos = [] } = useQuery<Photo[]>({
    queryKey: ["/api/photos"],
  });

  // Fetch all product SKUs
  const { data: productSKUs = [] } = useQuery<ProductSKU[]>({
    queryKey: ["/api/admin/product-skus"],
  });

  // Fetch all product sizes
  const { data: productSizes = [] } = useQuery<ProductSize[]>({
    queryKey: ["/api/admin/product-sizes"],
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      title: "",
      photoId: null,
      aspectRatio: "3x2",
      aspectRatios: ["3x2"],
      description: "",
      externalId: "",
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
    const ratios = (product.aspectRatios && product.aspectRatios.length > 0)
      ? product.aspectRatios
      : [product.aspectRatio];
    form.reset({
      title: product.title,
      photoId: product.photoId,
      aspectRatio: product.aspectRatio,
      aspectRatios: ratios.includes(product.aspectRatio) ? ratios : [product.aspectRatio, ...ratios],
      description: product.description || "",
      externalId: product.externalId || "",
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

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(search) ||
        (p.description && p.description.toLowerCase().includes(search))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(p => 
        statusFilter === "active" ? p.isActive : !p.isActive
      );
    }

    // Aspect ratio filter — match if ANY of the product's ratios match
    if (aspectFilter !== "all") {
      filtered = filtered.filter(p => {
        const ratios = (p.aspectRatios && p.aspectRatios.length > 0) ? p.aspectRatios : [p.aspectRatio];
        return ratios.includes(aspectFilter);
      });
    }

    // Photo filter
    if (photoFilter === "with-photo") {
      filtered = filtered.filter(p => p.photoId !== null);
    } else if (photoFilter === "no-photo") {
      filtered = filtered.filter(p => p.photoId === null);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case "title":
          compareValue = a.title.localeCompare(b.title);
          break;
        case "aspectRatio":
          compareValue = a.aspectRatio.localeCompare(b.aspectRatio);
          break;
        case "created":
          // Note: If createdAt doesn't exist, we'll sort by id as a proxy
          compareValue = a.id.localeCompare(b.id);
          break;
      }
      
      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return sorted;
  }, [products, searchTerm, statusFilter, aspectFilter, photoFilter, sortBy, sortOrder]);

  // Get unique aspect ratios from products (collect from all aspectRatios arrays)
  const availableAspectRatios = useMemo(() => {
    const ratios = new Set<string>();
    products.forEach(p => {
      const r = (p.aspectRatios && p.aspectRatios.length > 0) ? p.aspectRatios : [p.aspectRatio];
      r.forEach(x => ratios.add(x));
    });
    return Array.from(ratios).sort();
  }, [products]);

  // Toggle product expansion
  const toggleProductExpansion = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // Get SKUs for a product
  const getProductSKUs = (productId: string) => {
    return productSKUs.filter(sku => sku.productId === productId);
  };

  // Get size label for a SKU
  const getSizeLabel = (sizeId: string) => {
    const size = productSizes.find(s => s.id === sizeId);
    return size?.sizeLabel || "Unknown";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
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

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-products"
            className="md:col-span-2"
          />
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={aspectFilter} onValueChange={setAspectFilter}>
            <SelectTrigger data-testid="select-aspect-filter">
              <SelectValue placeholder="Aspect Ratio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratios</SelectItem>
              {availableAspectRatios.map(ratio => (
                <SelectItem key={ratio} value={ratio}>
                  {ratio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={photoFilter} onValueChange={(value: any) => setPhotoFilter(value)}>
            <SelectTrigger data-testid="select-photo-filter">
              <SelectValue placeholder="Photo Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="with-photo">With Photo</SelectItem>
              <SelectItem value="no-photo">No Photo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sorting Options */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Sort by:</label>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[150px]" data-testid="select-sort-by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="aspectRatio">Aspect Ratio</SelectItem>
              <SelectItem value="created">Created</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
            <SelectTrigger className="w-[150px]" data-testid="select-sort-order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">A-Z</SelectItem>
              <SelectItem value="desc">Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Photo</TableHead>
              <TableHead>Aspect Ratio</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Loading products...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {products.length === 0 ? "No products yet. Add your first product to get started." : "No products match your filters"}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const linkedPhoto = product.photoId ? photos.find(p => p.id === product.photoId) : null;
                const isExpanded = expandedProducts.has(product.id);
                const skus = getProductSKUs(product.id);
                
                return (
                  <>
                    <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                      <TableCell className="w-[40px]">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleProductExpansion(product.id)}
                          data-testid={`button-toggle-skus-${product.id}`}
                          className="h-8 w-8"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          {linkedPhoto?.imageUrl ? (
                            <img
                              src={linkedPhoto.imageUrl}
                              alt={product.title}
                              className="w-12 h-12 object-cover rounded mr-2"
                              data-testid={`img-product-${product.id}`}
                              onError={(e) => {
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
                      <TableCell>
                        {(() => {
                          const ratios = (product.aspectRatios && product.aspectRatios.length > 0)
                            ? product.aspectRatios
                            : [product.aspectRatio];
                          return (
                            <div className="flex flex-wrap gap-1" data-testid={`aspect-ratios-${product.id}`}>
                              {ratios.map(r => (
                                <span
                                  key={r}
                                  className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                    r === product.aspectRatio
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-gray-100 text-gray-700"
                                  )}
                                  title={r === product.aspectRatio ? "Primary" : "Additional"}
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground font-mono">
                          {product.externalId || "-"}
                        </span>
                      </TableCell>
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
                    
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/50 p-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Linked SKUs ({skus.length})</h4>
                            {skus.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No SKUs linked to this product yet.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {skus.map((sku) => (
                                  <div
                                    key={sku.id}
                                    className="bg-background border rounded-md p-3 text-sm"
                                    data-testid={`sku-${sku.id}`}
                                  >
                                    <div className="font-mono font-medium">{sku.sku}</div>
                                    <div className="text-muted-foreground mt-1">
                                      {sku.mediaType} · {getSizeLabel(sku.productSizeId)}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {sku.isActive ? "Active" : "Inactive"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
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
                name="aspectRatios"
                render={({ field }) => {
                  const primary = form.watch("aspectRatio");
                  const selectedRatios: string[] = field.value || [];
                  const toggleRatio = (value: string, checked: boolean) => {
                    if (checked) {
                      const next = Array.from(new Set([...selectedRatios, value]));
                      field.onChange(next);
                    } else {
                      // Don't allow removing the primary ratio
                      if (value === primary) return;
                      const next = selectedRatios.filter(r => r !== value);
                      field.onChange(next.length > 0 ? next : [primary]);
                    }
                  };
                  const setPrimary = (value: string) => {
                    form.setValue("aspectRatio", value);
                    if (!selectedRatios.includes(value)) {
                      field.onChange([value, ...selectedRatios]);
                    }
                  };
                  return (
                    <FormItem>
                      <FormLabel>Aspect Ratios</FormLabel>
                      <FormDescription>
                        Check every ratio this product is offered in. Click the star to mark the primary ratio (used for the gallery thumbnail).
                      </FormDescription>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2" data-testid="aspect-ratios-grid">
                        {aspectRatioOptions.map((option) => {
                          const isChecked = selectedRatios.includes(option.value);
                          const isPrimary = option.value === primary;
                          return (
                            <div
                              key={option.value}
                              className={cn(
                                "flex items-center justify-between gap-2 px-3 py-2 rounded-md border",
                                isPrimary && "border-blue-400 bg-blue-50",
                                !isPrimary && isChecked && "border-gray-300 bg-gray-50",
                                !isChecked && "border-gray-200"
                              )}
                            >
                              <label className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(c) => toggleRatio(option.value, !!c)}
                                  disabled={isPrimary}
                                  data-testid={`checkbox-aspect-${option.value}`}
                                />
                                <span className="truncate">{option.label}</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => setPrimary(option.value)}
                                className={cn(
                                  "text-xs px-2 py-0.5 rounded font-medium shrink-0",
                                  isPrimary
                                    ? "bg-blue-600 text-white"
                                    : "text-gray-500 hover:text-blue-600 hover:bg-blue-100"
                                )}
                                title={isPrimary ? "Primary ratio" : "Make this the primary ratio"}
                                data-testid={`button-primary-${option.value}`}
                              >
                                {isPrimary ? "Primary" : "Set primary"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
                name="externalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>External ID (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., WIX-12345, ETSY-ABC123"
                        {...field}
                        data-testid="input-external-id"
                      />
                    </FormControl>
                    <FormDescription>
                      Unique identifier for integration with external systems (Etsy, Amazon, etc.)
                    </FormDescription>
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