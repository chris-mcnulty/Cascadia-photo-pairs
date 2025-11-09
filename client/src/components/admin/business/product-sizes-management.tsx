import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Edit, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ProductSize {
  id: string;
  sizeLabel: string;
  widthInches: number;
  heightInches: number;
  aspectRatio: string;
}

interface PricingData {
  size: ProductSize;
  mediaType: string;
  avgSupplierCost: number | null;
  retailPrice: number | null;
  marginPercent: number | null;
}

export default function ProductSizesManagement() {
  const { toast } = useToast();
  const [newSizeLabel, setNewSizeLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingRow, setEditingRow] = useState<{sizeId: string; mediaType: string} | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const { data: pricingData, isLoading } = useQuery<PricingData[]>({
    queryKey: ["/api/admin/product-sizes/pricing"],
  });

  const setRetailPriceMutation = useMutation({
    mutationFn: async (params: { productSizeId: string; mediaType: string; retailPrice: number }) => {
      return await apiRequest("PUT", "/api/admin/retail-prices", {
        productSizeId: params.productSizeId,
        mediaType: params.mediaType,
        retailPrice: params.retailPrice,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-sizes/pricing"] });
      toast({
        title: "Success",
        description: "Retail price updated successfully",
      });
      setEditingRow(null);
      setEditPrice("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update retail price",
        variant: "destructive",
      });
    },
  });

  const handleAddSize = async () => {
    if (!newSizeLabel.trim()) {
      toast({
        title: "Error",
        description: "Please enter a size label (e.g., 60x45)",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      await apiRequest("POST", "/api/admin/product-sizes", {
        sizeLabel: newSizeLabel.trim(),
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/product-sizes/pricing"] });

      toast({
        title: "Success",
        description: `Size "${newSizeLabel}" added successfully`,
      });

      setNewSizeLabel("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to add size. Use format like '60x45' or '60 x 45'",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSize = async (id: string, sizeLabel: string) => {
    if (!confirm(`Are you sure you want to delete size "${sizeLabel}"? This will remove pricing for all media types.`)) return;

    try {
      await apiRequest("DELETE", `/api/admin/product-sizes/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/product-sizes/pricing"] });

      toast({
        title: "Success",
        description: "Size deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete size",
        variant: "destructive",
      });
    }
  };

  const handleStartEdit = (sizeId: string, mediaType: string, currentPrice: number | null) => {
    setEditingRow({ sizeId, mediaType });
    setEditPrice(currentPrice !== null ? (currentPrice / 100).toFixed(2) : "");
  };

  const handleSavePrice = (sizeId: string, mediaType: string) => {
    const priceInCents = Math.round(parseFloat(editPrice) * 100);
    if (isNaN(priceInCents) || priceInCents < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }

    setRetailPriceMutation.mutate({
      productSizeId: sizeId,
      mediaType,
      retailPrice: priceInCents,
    });
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
    setEditPrice("");
  };

  const formatCurrency = (cents: number | null) => {
    if (cents === null) return "—";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatMargin = (margin: number | null) => {
    if (margin === null) return "—";
    return `${margin}%`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product Sizes & Pricing</CardTitle>
          <p className="text-sm text-gray-600">
            Manage product sizes and set retail prices by media type. Average supplier costs are calculated automatically.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add New Size */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter size (e.g., 60x45)"
              value={newSizeLabel}
              onChange={(e) => setNewSizeLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddSize();
                }
              }}
              data-testid="input-new-size"
            />
            <Button 
              onClick={handleAddSize} 
              disabled={isAdding}
              data-testid="button-add-size"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Size
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : pricingData && pricingData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>Dimensions</TableHead>
                    <TableHead>Media Type</TableHead>
                    <TableHead className="text-right">Avg Supplier Cost</TableHead>
                    <TableHead className="text-right">Your Retail Price</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricingData.map((row) => {
                    const isEditing = editingRow?.sizeId === row.size.id && editingRow?.mediaType === row.mediaType;
                    
                    return (
                      <TableRow key={`${row.size.id}-${row.mediaType}`}>
                        <TableCell className="font-medium">{row.size.sizeLabel}</TableCell>
                        <TableCell>{row.size.widthInches}" × {row.size.heightInches}"</TableCell>
                        <TableCell>{row.mediaType}</TableCell>
                        <TableCell className="text-right text-gray-600">
                          {formatCurrency(row.avgSupplierCost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-sm">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="w-24 h-8 text-right"
                                data-testid={`input-edit-price-${row.size.id}-${row.mediaType}`}
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span className={row.retailPrice === null ? "text-gray-400" : "font-medium"}>
                              {formatCurrency(row.retailPrice)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={row.marginPercent !== null && row.marginPercent > 0 ? "text-green-600 font-medium" : "text-gray-400"}>
                            {formatMargin(row.marginPercent)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSavePrice(row.size.id, row.mediaType)}
                                disabled={setRetailPriceMutation.isPending}
                                data-testid={`button-save-price-${row.size.id}-${row.mediaType}`}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                                disabled={setRetailPriceMutation.isPending}
                                data-testid={`button-cancel-edit-${row.size.id}-${row.mediaType}`}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartEdit(row.size.id, row.mediaType, row.retailPrice)}
                                data-testid={`button-edit-price-${row.size.id}-${row.mediaType}`}
                              >
                                <Edit className="w-4 h-4 text-blue-600" />
                              </Button>
                              {/* Only show delete button for the first media type of each size */}
                              {pricingData.findIndex(p => p.size.id === row.size.id) === pricingData.findIndex(p => p.size.id === row.size.id && p.mediaType === row.mediaType) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteSize(row.size.id, row.size.sizeLabel)}
                                  data-testid={`button-delete-${row.size.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No product sizes found. Add one above to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
