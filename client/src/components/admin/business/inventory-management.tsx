import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2 } from "lucide-react";
import InventoryFormDialog from "./inventory-form-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InventoryItem } from "@shared/schema";

// Extended inventory item with additional display fields
interface InventoryItemWithDetails extends InventoryItem {
  productTitle?: string;
  photoImageUrl?: string;
  sizeLabel?: string;
}

export default function InventoryManagement() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<"title" | "cost" | "price" | "status">("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemWithDetails | null>(null);
  const { toast } = useToast();

  const { data: inventoryData, isLoading } = useQuery<InventoryItemWithDetails[]>({
    queryKey: ["/api/admin/inventory/details"],
  });
  
  // Filter and sort inventory
  const filteredInventory = useMemo(() => {
    let filtered = inventoryData || [];
    
    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(item => item.status === statusFilter);
    }
    
    // Media type filter
    if (mediaTypeFilter !== "all") {
      filtered = filtered.filter(item => item.mediaType === mediaTypeFilter);
    }
    
    // Size filter
    if (sizeFilter !== "all") {
      filtered = filtered.filter(item => item.sizeLabel === sizeFilter);
    }
    
    // Search filter (by product title)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        (item.productTitle || "").toLowerCase().includes(search)
      );
    }
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case "title":
          compareValue = (a.productTitle || "").localeCompare(b.productTitle || "");
          break;
        case "cost":
          compareValue = a.acquisitionCost - b.acquisitionCost;
          break;
        case "price":
          compareValue = a.listPrice - b.listPrice;
          break;
        case "status":
          compareValue = a.status.localeCompare(b.status);
          break;
      }
      
      return sortOrder === "asc" ? compareValue : -compareValue;
    });
    
    return sorted;
  }, [inventoryData, statusFilter, mediaTypeFilter, sizeFilter, searchTerm, sortBy, sortOrder]);

  // Get unique media types and sizes
  const availableMediaTypes = useMemo(() => {
    const types = new Set(inventoryData?.map(item => item.mediaType) || []);
    return Array.from(types).filter(Boolean).sort();
  }, [inventoryData]);
  
  const availableSizes = useMemo(() => {
    const sizes = new Set(inventoryData?.map(item => item.sizeLabel) || []);
    return Array.from(sizes).filter((size): size is string => Boolean(size)).sort();
  }, [inventoryData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this inventory item?")) return;

    try {
      await apiRequest("DELETE", `/api/admin/inventory/${id}`);
      
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory/details"] });
      
      toast({
        title: "Success",
        description: "Inventory item deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete inventory item",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: InventoryItemWithDetails) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold">Inventory Management</CardTitle>
              <Button onClick={() => setDialogOpen(true)} data-testid="button-add-inventory">
                <Plus className="w-4 h-4 mr-2" />
                Add Inventory
              </Button>
            </div>
            
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                type="text"
                placeholder="Search by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-inventory"
                className="md:col-span-2"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                </SelectContent>
              </Select>
              <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
                <SelectTrigger data-testid="select-media-filter">
                  <SelectValue placeholder="Media Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Media</SelectItem>
                  {availableMediaTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger data-testid="select-size-filter">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  {availableSizes.map(size => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
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
                  <SelectItem value="cost">Cost</SelectItem>
                  <SelectItem value="price">List Price</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                <SelectTrigger className="w-[150px]" data-testid="select-sort-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Photo</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Title</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Size</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Media Type</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Cost</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">List Price</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.length > 0 ? (
                  filteredInventory.map((item) => (
                    <TableRow key={item.id} data-testid={`row-inventory-${item.id}`}>
                      <TableCell>
                        {item.photoImageUrl ? (
                          <img
                            src={item.photoImageUrl}
                            alt={item.productTitle || "Product"}
                            className="w-16 h-16 object-cover rounded"
                            data-testid={`img-inventory-${item.id}`}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                            <span className="text-xs text-gray-500">No image</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{item.productTitle || "Untitled"}</TableCell>
                      <TableCell className="text-sm">{item.sizeLabel}</TableCell>
                      <TableCell className="text-sm">{item.mediaType}</TableCell>
                      <TableCell className="text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "in_stock"
                              ? "bg-green-100 text-green-800"
                              : item.status === "sold"
                              ? "bg-blue-100 text-blue-800"
                              : item.status === "shipped"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                          data-testid={`status-${item.id}`}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(item.acquisitionCost)}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{formatCurrency(item.listPrice)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      No inventory items found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InventoryFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        editingItem={editingItem ? {
          id: editingItem.id,
          productId: editingItem.productId,
          productSKUId: editingItem.productSKUId,
          supplierId: editingItem.supplierId,
          mediaType: editingItem.mediaType,
          productSizeId: editingItem.productSizeId,
          acquisitionCost: editingItem.acquisitionCost,
          listPrice: editingItem.listPrice,
          status: editingItem.status,
          notes: editingItem.notes ?? undefined,
        } : null}
      />
    </div>
  );
}
