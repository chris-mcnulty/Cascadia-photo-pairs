import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Download, Frame, X } from "lucide-react";
import InventoryFormDialog from "./inventory-form-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InventoryItem } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = {
  ordered: "Ordered",
  in_stock: "In Stock",
  on_exhibit: "On Exhibit",
  sold: "Sold",
  shipped: "Shipped",
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "in_stock":
      return "bg-green-100 text-green-800";
    case "on_exhibit":
      return "bg-amber-100 text-amber-800";
    case "sold":
      return "bg-blue-100 text-blue-800";
    case "shipped":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-yellow-100 text-yellow-800";
  }
};

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
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<"title" | "cost" | "price" | "status">("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemWithDetails | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: inventoryData, isLoading } = useQuery<InventoryItemWithDetails[]>({
    queryKey: ["/api/admin/inventory/details"],
  });

  const { data: knownLocations } = useQuery<string[]>({
    queryKey: ["/api/admin/inventory/locations"],
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

    // Location filter
    if (locationFilter !== "all") {
      filtered = filtered.filter(item => (item.location || "") === locationFilter);
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
  }, [inventoryData, statusFilter, mediaTypeFilter, sizeFilter, locationFilter, searchTerm, sortBy, sortOrder]);

  // Get unique media types and sizes
  const availableMediaTypes = useMemo(() => {
    const types = new Set(inventoryData?.map(item => item.mediaType) || []);
    return Array.from(types).filter(Boolean).sort();
  }, [inventoryData]);
  
  const availableSizes = useMemo(() => {
    const sizes = new Set(inventoryData?.map(item => item.sizeLabel) || []);
    return Array.from(sizes).filter((size): size is string => Boolean(size)).sort();
  }, [inventoryData]);

  // Locations currently in use (from inventory data) merged with any known locations
  const availableLocations = useMemo(() => {
    const locs = new Set<string>(knownLocations || []);
    inventoryData?.forEach(item => {
      if (item.location && item.location.trim()) locs.add(item.location);
    });
    return Array.from(locs).sort((a, b) => a.localeCompare(b));
  }, [inventoryData, knownLocations]);

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filteredInventory.length > 0 &&
    filteredInventory.every(item => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInventory.map(item => item.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const applyBulkUpdate = async (updates: { status?: string; location?: string | null }) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const res = await apiRequest("PATCH", "/api/admin/inventory/bulk", { ids, updates });
      const result = await res.json();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory/details"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory/locations"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory/available"] }),
      ]);
      toast({
        title: "Success",
        description: `Updated ${result.updatedCount ?? ids.length} inventory item(s)`,
      });
      clearSelection();
      setBulkDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update selected inventory items",
        variant: "destructive",
      });
    }
  };

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

  const formatDate = (d: Date | string | null | undefined) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US");
  };

  const handleExportCSV = () => {
    const headers = [
      "Title", "Size", "Media Type", "Status", "Location",
      "Cost (USD)", "List Price (USD)",
      "Purchase Date", "Received Date", "Sold Date", "Shipped Date",
      "Notes",
    ];

    const rows = filteredInventory.map(item => [
      item.productTitle || "",
      item.sizeLabel || "",
      item.mediaType || "",
      STATUS_LABELS[item.status] || item.status.replace("_", " "),
      item.location || "",
      (item.acquisitionCost / 100).toFixed(2),
      (item.listPrice / 100).toFixed(2),
      formatDate(item.purchaseDate),
      formatDate(item.receivedDate),
      formatDate(item.soldDate),
      formatDate(item.shippedDate),
      item.notes || "",
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const activeFilters = [
      statusFilter !== "all" ? statusFilter : "",
      mediaTypeFilter !== "all" ? mediaTypeFilter : "",
      sizeFilter !== "all" ? sizeFilter : "",
      locationFilter !== "all" ? locationFilter : "",
    ].filter(Boolean).join("-");
    link.href = url;
    link.download = `inventory${activeFilters ? `-${activeFilters}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold">Inventory Management</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  disabled={filteredInventory.length === 0}
                  data-testid="button-export-csv"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                  {filteredInventory.length > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({filteredInventory.length})
                    </span>
                  )}
                </Button>
                <Button onClick={() => setDialogOpen(true)} data-testid="button-add-inventory">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Inventory
                </Button>
              </div>
            </div>
            
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                  <SelectItem value="on_exhibit">On Exhibit</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                </SelectContent>
              </Select>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger data-testid="select-location-filter">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {availableLocations.map(loc => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
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

            {/* Bulk Actions Toolbar */}
            {selectedIds.size > 0 && (
              <div
                className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3"
                data-testid="bulk-actions-toolbar"
              >
                <span className="text-sm font-medium text-amber-900" data-testid="text-selected-count">
                  {selectedIds.size} selected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkDialogOpen(true)}
                  data-testid="button-bulk-edit"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Bulk Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyBulkUpdate({ status: "in_stock", location: null })}
                  data-testid="button-end-exhibit"
                >
                  <Frame className="w-4 h-4 mr-2" />
                  End Exhibit (return to stock)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSelection}
                  data-testid="button-clear-selection"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            )}
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
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Photo</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Title</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Size</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Media Type</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Location</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Cost</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">List Price</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.length > 0 ? (
                  filteredInventory.map((item) => (
                    <TableRow
                      key={item.id}
                      data-state={selectedIds.has(item.id) ? "selected" : undefined}
                      data-testid={`row-inventory-${item.id}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          aria-label={`Select ${item.productTitle || "item"}`}
                          data-testid={`checkbox-select-${item.id}`}
                        />
                      </TableCell>
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
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(item.status)}`}
                          data-testid={`status-${item.id}`}
                        >
                          {STATUS_LABELS[item.status] || item.status.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`location-${item.id}`}>
                        {item.location || <span className="text-gray-400">—</span>}
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
                    <TableCell colSpan={10} className="text-center text-gray-500 py-8">
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
          location: editingItem.location ?? undefined,
          notes: editingItem.notes ?? undefined,
        } : null}
      />

      <BulkEditDialog
        open={bulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
        count={selectedIds.size}
        knownLocations={availableLocations}
        onApply={applyBulkUpdate}
      />
    </div>
  );
}

interface BulkEditDialogProps {
  open: boolean;
  onClose: () => void;
  count: number;
  knownLocations: string[];
  onApply: (updates: { status?: string; location?: string | null }) => Promise<void>;
}

function BulkEditDialog({ open, onClose, count, knownLocations, onApply }: BulkEditDialogProps) {
  // "" means leave the field unchanged
  const [status, setStatus] = useState<string>("");
  const [locationMode, setLocationMode] = useState<"keep" | "set" | "clear">("keep");
  const [location, setLocation] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reset local state whenever the dialog (re)opens
  useEffect(() => {
    if (open) {
      setStatus("");
      setLocationMode("keep");
      setLocation("");
    }
  }, [open]);

  const handleApply = async () => {
    const updates: { status?: string; location?: string | null } = {};
    if (status) updates.status = status;
    if (locationMode === "set") updates.location = location.trim();
    else if (locationMode === "clear") updates.location = null;

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await onApply(updates);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Edit Inventory</DialogTitle>
          <DialogDescription>
            Apply changes to {count} selected item{count === 1 ? "" : "s"}. Leave a field unchanged to keep current values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-bulk-status">
                <SelectValue placeholder="Keep current status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="on_exhibit">On Exhibit</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Select value={locationMode} onValueChange={(v) => setLocationMode(v as "keep" | "set" | "clear")}>
              <SelectTrigger data-testid="select-bulk-location-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Keep current location</SelectItem>
                <SelectItem value="set">Set location…</SelectItem>
                <SelectItem value="clear">Clear location</SelectItem>
              </SelectContent>
            </Select>
            {locationMode === "set" && (
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                list="bulk-location-options"
                placeholder="e.g., Texaco, Beaumont Cellars"
                data-testid="input-bulk-location"
              />
            )}
            <datalist id="bulk-location-options">
              {knownLocations.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-bulk-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={submitting || (locationMode === "set" && !location.trim())}
            data-testid="button-bulk-apply"
          >
            Apply to {count}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
