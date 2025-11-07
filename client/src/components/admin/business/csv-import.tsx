import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle, CheckCircle, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function CSVImport() {
  const [isImportingProducts, setIsImportingProducts] = useState(false);
  const [isImportingOrders, setIsImportingOrders] = useState(false);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [productResult, setProductResult] = useState<ImportResult | null>(null);
  const [orderResult, setOrderResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'order') => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      if (type === 'product') {
        setProductFile(file);
        setProductResult(null);
      } else {
        setOrderFile(file);
        setOrderResult(null);
      }
    }
  };

  const handleImportProducts = async () => {
    if (!productFile) {
      toast({
        title: "No file selected",
        description: "Please select a Wix Products CSV file",
        variant: "destructive",
      });
      return;
    }

    setIsImportingProducts(true);
    const formData = new FormData();
    formData.append('file', productFile);

    try {
      const response = await fetch('/api/admin/import/wix-products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'x-auth-token': localStorage.getItem('authToken') || '',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error((await response.json()).message || 'Import failed');
      }

      const result: ImportResult = await response.json();
      setProductResult(result);

      toast({
        title: "Products imported successfully",
        description: `Imported ${result.imported} products, skipped ${result.skipped}`,
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import products",
        variant: "destructive",
      });
    } finally {
      setIsImportingProducts(false);
    }
  };

  const handleImportOrders = async () => {
    if (!orderFile) {
      toast({
        title: "No file selected",
        description: "Please select a Wix Orders CSV file",
        variant: "destructive",
      });
      return;
    }

    setIsImportingOrders(true);
    const formData = new FormData();
    formData.append('file', orderFile);

    try {
      const response = await fetch('/api/admin/import/wix-orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'x-auth-token': localStorage.getItem('authToken') || '',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error((await response.json()).message || 'Import failed');
      }

      const result: ImportResult = await response.json();
      setOrderResult(result);

      toast({
        title: "Orders imported successfully",
        description: `Imported ${result.imported} sales records, skipped ${result.skipped}`,
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import orders",
        variant: "destructive",
      });
    } finally {
      setIsImportingOrders(false);
    }
  };

  const handleDrop = (event: React.DragEvent, type: 'product' | 'order') => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      if (type === 'product') {
        setProductFile(file);
        setProductResult(null);
      } else {
        setOrderFile(file);
        setOrderResult(null);
      }
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  return (
    <div className="space-y-6">
      {/* Products Import */}
      <Card>
        <CardHeader>
          <CardTitle>Import Wix Products</CardTitle>
          <CardDescription>
            Upload your Wix Products CSV export file to import product data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div 
            className="border-2 border-dashed rounded-lg p-8 text-center space-y-2 hover:border-primary/50 transition-colors"
            onDrop={(e) => handleDrop(e, 'product')}
            onDragOver={handleDragOver}
            data-testid="dropzone-wix-products"
          >
            {productFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{productFile.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => {
                    setProductFile(null);
                    setProductResult(null);
                  }}
                  data-testid="button-remove-product-file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop your Wix Products CSV file here or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileSelect(e, 'product')}
                  className="hidden"
                  id="product-file-input"
                  data-testid="input-product-file"
                />
                <label htmlFor="product-file-input">
                  <Button variant="secondary" size="sm" asChild>
                    <span>Select File</span>
                  </Button>
                </label>
              </>
            )}
          </div>

          {productResult && (
            <Alert className={productResult.errors.length > 0 ? "border-orange-200" : "border-green-200"}>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Import Complete</AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <p>Imported: {productResult.imported} products</p>
                  <p>Skipped: {productResult.skipped} items</p>
                  {productResult.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="font-medium text-orange-600">Errors encountered:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside max-h-20 overflow-y-auto">
                        {productResult.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleImportProducts}
            disabled={!productFile || isImportingProducts}
            className="w-full"
            data-testid="button-import-products"
          >
            {isImportingProducts ? "Importing..." : "Import Products"}
          </Button>
        </CardContent>
      </Card>

      {/* Orders Import */}
      <Card>
        <CardHeader>
          <CardTitle>Import Wix Orders</CardTitle>
          <CardDescription>
            Upload your Wix Orders CSV export file to import sales history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div 
            className="border-2 border-dashed rounded-lg p-8 text-center space-y-2 hover:border-primary/50 transition-colors"
            onDrop={(e) => handleDrop(e, 'order')}
            onDragOver={handleDragOver}
            data-testid="dropzone-wix-orders"
          >
            {orderFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{orderFile.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => {
                    setOrderFile(null);
                    setOrderResult(null);
                  }}
                  data-testid="button-remove-order-file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop your Wix Orders CSV file here or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileSelect(e, 'order')}
                  className="hidden"
                  id="order-file-input"
                  data-testid="input-order-file"
                />
                <label htmlFor="order-file-input">
                  <Button variant="secondary" size="sm" asChild>
                    <span>Select File</span>
                  </Button>
                </label>
              </>
            )}
          </div>

          {orderResult && (
            <Alert className={orderResult.errors.length > 0 ? "border-orange-200" : "border-green-200"}>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Import Complete</AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <p>Imported: {orderResult.imported} sales records</p>
                  <p>Skipped: {orderResult.skipped} items</p>
                  {orderResult.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="font-medium text-orange-600">Errors encountered:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside max-h-20 overflow-y-auto">
                        {orderResult.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleImportOrders}
            disabled={!orderFile || isImportingOrders}
            className="w-full"
            data-testid="button-import-orders"
          >
            {isImportingOrders ? "Importing..." : "Import Orders"}
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Import Instructions</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Export your products from Wix Store → Products → Export</li>
            <li>Export your orders from Wix Store → Orders → Export</li>
            <li>Import Products first (this creates the product catalog)</li>
            <li>Import Orders second (this creates sales records)</li>
            <li>The import will match orders to products by name and SKU</li>
          </ol>
        </AlertDescription>
      </Alert>
    </div>
  );
}