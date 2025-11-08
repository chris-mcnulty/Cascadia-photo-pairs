import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ProductSize {
  id: string;
  sizeLabel: string;
  widthInches: number;
  heightInches: number;
  aspectRatio: string;
}

export default function ProductSizesManagement() {
  const { toast } = useToast();
  const [newSizeLabel, setNewSizeLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { data: productSizes, isLoading } = useQuery<ProductSize[]>({
    queryKey: ["/api/admin/product-sizes"],
  });

  // Group sizes by aspect ratio
  const sizesByAspectRatio = productSizes?.reduce((acc, size) => {
    if (!acc[size.aspectRatio]) {
      acc[size.aspectRatio] = [];
    }
    acc[size.aspectRatio].push(size);
    return acc;
  }, {} as Record<string, ProductSize[]>);

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

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/product-sizes"] });

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
    if (!confirm(`Are you sure you want to delete size "${sizeLabel}"?`)) return;

    try {
      await apiRequest("DELETE", `/api/admin/product-sizes/${id}`);

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/product-sizes"] });

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product Sizes</CardTitle>
          <p className="text-sm text-gray-600">
            Manage available product sizes. Enter sizes like "60x45" and the aspect ratio will be calculated automatically.
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
          ) : sizesByAspectRatio && Object.keys(sizesByAspectRatio).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(sizesByAspectRatio)
                .sort(([ratioA], [ratioB]) => ratioA.localeCompare(ratioB))
                .map(([aspectRatio, sizes]) => (
                  <div key={aspectRatio}>
                    <h3 className="text-lg font-semibold mb-3 text-gray-800">
                      Aspect Ratio: {aspectRatio}
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Size Label</TableHead>
                          <TableHead>Width (inches)</TableHead>
                          <TableHead>Height (inches)</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sizes
                          .sort((a, b) => a.widthInches - b.widthInches)
                          .map((size) => (
                            <TableRow key={size.id}>
                              <TableCell className="font-medium">{size.sizeLabel}</TableCell>
                              <TableCell>{size.widthInches}"</TableCell>
                              <TableCell>{size.heightInches}"</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteSize(size.id, size.sizeLabel)}
                                  data-testid={`button-delete-${size.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
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
