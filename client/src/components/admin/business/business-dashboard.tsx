import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, DollarSign, ShoppingCart, Receipt } from "lucide-react";
import { format } from "date-fns";
import SalesFormDialog from "./sales-form-dialog";

interface DashboardStats {
  totalInventoryValue: number;
  monthlySales: number;
  pendingOrders: number;
  totalExpenses: number;
}

interface RecentSale {
  id: string;
  photoTitle: string;
  soldPrice: number;
  saleDate: string;
  channelName: string;
  buyerName?: string;
}

interface BusinessDashboardProps {
  onNavigateToTab?: (tab: "dashboard" | "products" | "inventory" | "suppliers" | "sizes" | "expenses" | "import") => void;
}

export default function BusinessDashboard({ onNavigateToTab }: BusinessDashboardProps) {
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);

  const { data: stats, isLoading: statsLoading} = useQuery<DashboardStats>({
    queryKey: ["/api/admin/business/stats"],
  });

  const { data: recentSales, isLoading: salesLoading } = useQuery<RecentSale[]>({
    queryKey: ["/api", "admin", "sales", "recent?limit=5"],
  });

  console.log("[BusinessDashboard] recentSales query state:", { 
    data: recentSales, 
    isLoading: salesLoading,
    dataLength: recentSales?.length 
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-8">
            {statsLoading ? (
              <>
                <Skeleton className="h-10 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-4xl font-bold text-gray-900" data-testid="text-total-inventory-value">
                  {formatCurrency(stats?.totalInventoryValue || 0)}
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mt-2">
                  Total Inventory Value
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-8">
            {statsLoading ? (
              <>
                <Skeleton className="h-10 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <DollarSign className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-4xl font-bold text-gray-900" data-testid="text-monthly-sales">
                  {formatCurrency(stats?.monthlySales || 0)}
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mt-2">
                  Monthly Sales
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-8">
            {statsLoading ? (
              <>
                <Skeleton className="h-10 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <ShoppingCart className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-4xl font-bold text-gray-900" data-testid="text-pending-orders">
                  {stats?.pendingOrders || 0}
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mt-2">
                  Pending Orders
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-8">
            {statsLoading ? (
              <>
                <Skeleton className="h-10 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <Receipt className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-4xl font-bold text-gray-900" data-testid="text-total-expenses">
                  {formatCurrency(stats?.totalExpenses || 0)}
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mt-2">
                  Total Expenses
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Recent Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {salesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Photo</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Date</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Channel</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Buyer</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSales && recentSales.length > 0 ? (
                  recentSales.map((sale) => (
                    <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                      <TableCell className="text-sm">{sale.photoTitle}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(sale.saleDate), "MM/dd/yyyy")}
                      </TableCell>
                      <TableCell className="text-sm">{sale.channelName}</TableCell>
                      <TableCell className="text-sm">{sale.buyerName || "N/A"}</TableCell>
                      <TableCell className="text-sm text-right font-medium">
                        {formatCurrency(sale.soldPrice)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No recent sales
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => onNavigateToTab?.('products')}
              data-testid="button-add-product"
            >
              <Package className="w-4 h-4 mr-2" />
              Add Product
            </Button>
            <Button
              variant="outline"
              onClick={() => setSalesDialogOpen(true)}
              data-testid="button-record-sale"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Record Sale
            </Button>
            <Button
              variant="outline"
              onClick={() => onNavigateToTab?.('expenses')}
              data-testid="button-log-expense"
            >
              <Receipt className="w-4 h-4 mr-2" />
              Log Expense
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sales Form Dialog */}
      <SalesFormDialog
        open={salesDialogOpen}
        onClose={() => setSalesDialogOpen(false)}
      />
    </div>
  );
}
