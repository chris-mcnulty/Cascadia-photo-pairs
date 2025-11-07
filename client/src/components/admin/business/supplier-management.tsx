import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import SupplierFormDialog from "./supplier-form-dialog";

interface Supplier {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
}

interface ProductSize {
  id: string;
  sizeLabel: string;
}

interface SupplierPrice {
  id: string;
  supplierId: string;
  productSizeId: string;
  mediaType: string;
  basePrice: number;
}

export default function SupplierManagement() {
  const { toast } = useToast();
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const { data: suppliers, isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/admin/suppliers"],
  });

  const { data: productSizes, isLoading: loadingSizes } = useQuery<ProductSize[]>({
    queryKey: ["/api/admin/product-sizes"],
  });

  const { data: supplierPrices, isLoading: loadingPrices } = useQuery<SupplierPrice[]>({
    queryKey: ["/api/admin/supplier-prices"],
  });

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("Are you sure you want to delete this supplier?")) return;

    try {
      await apiRequest("DELETE", `/api/admin/suppliers/${id}`);

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers"] });

      toast({
        title: "Success",
        description: "Supplier deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete supplier",
        variant: "destructive",
      });
    }
  };

  const getPriceForSupplierAndSize = (supplierId: string, sizeId: string, mediaType: string) => {
    const price = supplierPrices?.find(
      (p) => p.supplierId === supplierId && p.productSizeId === sizeId && p.mediaType === mediaType
    );
    return price ? price.basePrice / 100 : 0;
  };

  const getPriceId = (supplierId: string, sizeId: string, mediaType: string) => {
    const price = supplierPrices?.find(
      (p) => p.supplierId === supplierId && p.productSizeId === sizeId && p.mediaType === mediaType
    );
    return price?.id;
  };

  const handlePriceChange = (key: string, value: string) => {
    setEditingPrices((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSavePrice = async (supplierId: string, sizeId: string, mediaType: string) => {
    const key = `${supplierId}-${sizeId}-${mediaType}`;
    const value = editingPrices[key];
    
    if (!value) return;

    try {
      const priceInCents = Math.round(parseFloat(value) * 100);
      const priceId = getPriceId(supplierId, sizeId, mediaType);

      if (priceId) {
        await apiRequest("PUT", `/api/admin/supplier-prices/${priceId}`, {
          basePrice: priceInCents,
        });
      } else {
        await apiRequest("POST", "/api/admin/supplier-prices", {
          supplierId,
          productSizeId: sizeId,
          mediaType,
          basePrice: priceInCents,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/supplier-prices"] });

      setEditingPrices((prev) => {
        const newPrices = { ...prev };
        delete newPrices[key];
        return newPrices;
      });

      toast({
        title: "Success",
        description: "Price updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update price",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents);
  };

  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierDialogOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierDialogOpen(true);
  };

  const handleCloseSupplierDialog = () => {
    setSupplierDialogOpen(false);
    setEditingSupplier(null);
  };

  return (
    <div className="space-y-8">
      {/* Suppliers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">Suppliers</CardTitle>
            <Button size="sm" onClick={handleAddSupplier} data-testid="button-add-supplier">
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSuppliers ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Name</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Email</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Phone</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers && suppliers.length > 0 ? (
                  suppliers.map((supplier) => (
                    <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                      <TableCell className="text-sm font-medium">{supplier.name}</TableCell>
                      <TableCell className="text-sm">{supplier.contactEmail || "N/A"}</TableCell>
                      <TableCell className="text-sm">{supplier.contactPhone || "N/A"}</TableCell>
                      <TableCell className="text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            supplier.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {supplier.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSupplier(supplier)}
                            data-testid={`button-edit-supplier-${supplier.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSupplier(supplier.id)}
                            data-testid={`button-delete-supplier-${supplier.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No suppliers found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pricing Matrix Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Pricing Matrix (ChromaLuxe)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSizes || loadingPrices || loadingSuppliers ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm font-semibold uppercase tracking-wide sticky left-0 bg-white">
                      Size
                    </TableHead>
                    {suppliers?.map((supplier) => (
                      <TableHead
                        key={supplier.id}
                        className="text-sm font-semibold uppercase tracking-wide text-right"
                      >
                        {supplier.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productSizes?.map((size) => (
                    <TableRow key={size.id}>
                      <TableCell className="text-sm font-medium sticky left-0 bg-white">
                        {size.sizeLabel}
                      </TableCell>
                      {suppliers?.map((supplier) => {
                        const key = `${supplier.id}-${size.id}-ChromaLuxe`;
                        const currentPrice = getPriceForSupplierAndSize(supplier.id, size.id, "ChromaLuxe");
                        const isEditing = key in editingPrices;
                        
                        return (
                          <TableCell key={supplier.id} className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                className="w-24 text-right"
                                value={isEditing ? editingPrices[key] : currentPrice.toFixed(2)}
                                onChange={(e) => handlePriceChange(key, e.target.value)}
                                data-testid={`input-price-${key}`}
                              />
                              {isEditing && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleSavePrice(supplier.id, size.id, "ChromaLuxe")}
                                  data-testid={`button-save-price-${key}`}
                                >
                                  <Save className="w-4 h-4 text-green-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SupplierFormDialog
        open={supplierDialogOpen}
        onClose={handleCloseSupplierDialog}
        editingSupplier={editingSupplier}
      />
    </div>
  );
}
