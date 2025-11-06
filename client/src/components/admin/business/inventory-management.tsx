import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2 } from "lucide-react";
import InventoryFormDialog from "./inventory-form-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface InventoryItem {
  id: string;
  photoId: string;
  photoTitle: string;
  photoImageUrl?: string;
  title: string;
  mediaType: string;
  sizeLabel: string;
  status: string;
  acquisitionCost: number;
  listPrice: number;
}

export default function InventoryManagement() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const { toast } = useToast();

  const { data: inventory, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/admin/inventory", statusFilter !== "all" ? { status: statusFilter } : {}],
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this inventory item?")) return;

    try {
      await apiRequest("DELETE", `/api/admin/inventory/${id}`);
      
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory"] });
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

  const handleEdit = (item: InventoryItem) => {
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">Inventory Management</CardTitle>
            <div className="flex items-center gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
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
              <Button onClick={() => setDialogOpen(true)} data-testid="button-add-inventory">
                <Plus className="w-4 h-4 mr-2" />
                Add Inventory
              </Button>
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
                {inventory && inventory.length > 0 ? (
                  inventory.map((item) => (
                    <TableRow key={item.id} data-testid={`row-inventory-${item.id}`}>
                      <TableCell>
                        {item.photoImageUrl ? (
                          <img
                            src={item.photoImageUrl}
                            alt={item.title}
                            className="w-16 h-16 object-cover rounded"
                            data-testid={`img-inventory-${item.id}`}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                            <span className="text-xs text-gray-500">No image</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{item.title}</TableCell>
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
        editingItem={editingItem}
      />
    </div>
  );
}
