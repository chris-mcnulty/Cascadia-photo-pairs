import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, DollarSign, Receipt, TrendingUp, ShoppingBag } from "lucide-react";
import SalesFormDialog from "./sales-form-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface Sale {
  id: string;
  productId: string | null;
  channelId: string;
  saleDate: string;
  soldPrice: number;
  taxCollected: number;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  shippingAddress?: string | null;
  notes?: string | null;
}

interface SaleWithDetails {
  id: string;
  photoTitle: string | null;
  soldPrice: number;
  taxCollected: number;
  saleDate: string;
  channelName: string;
  buyerName: string | null;
  buyerEmail: string | null;
  productId: string | null;
  channelId: string;
}

interface SalesChannel {
  id: string;
  name: string;
  isActive: boolean;
}

export default function SalesManagement() {
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date" | "price" | "buyer" | "channel">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const { toast } = useToast();

  // Build query params for filtering
  const queryParams: Record<string, string> = {};
  if (startDate) queryParams.startDate = startDate;
  if (endDate) queryParams.endDate = endDate;

  // Build query URL with parameters
  const queryUrl = `/api/admin/sales${Object.keys(queryParams).length > 0 ? `?${new URLSearchParams(queryParams).toString()}` : ''}`;

  const { data: allSales, isLoading: loadingSales } = useQuery<Sale[]>({
    queryKey: [queryUrl],
  });

  const { data: channels } = useQuery<SalesChannel[]>({
    queryKey: ["/api/admin/sales-channels"],
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sale? This action cannot be undone.")) return;

    try {
      await apiRequest("DELETE", `/api/admin/sales/${id}`);

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/sales"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/sales/recent"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/business/stats"] });

      toast({
        title: "Success",
        description: "Sale deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete sale",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingSale(null);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  // Apply filters and sorting
  const filteredSales = allSales?.filter((sale) => {
    // Channel filter
    if (channelFilter !== "all" && sale.channelId !== channelFilter) return false;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const buyerName = sale.buyerName?.toLowerCase() || "";
      const buyerEmail = sale.buyerEmail?.toLowerCase() || "";
      if (!buyerName.includes(search) && !buyerEmail.includes(search)) return false;
    }
    
    return true;
  }) || [];

  // Apply sorting
  const sortedSales = [...filteredSales].sort((a, b) => {
    let compareValue = 0;
    
    switch (sortBy) {
      case "date":
        compareValue = new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime();
        break;
      case "price":
        compareValue = a.soldPrice - b.soldPrice;
        break;
      case "buyer":
        compareValue = (a.buyerName || "").localeCompare(b.buyerName || "");
        break;
      case "channel":
        const channelA = channels?.find(c => c.id === a.channelId)?.name || "";
        const channelB = channels?.find(c => c.id === b.channelId)?.name || "";
        compareValue = channelA.localeCompare(channelB);
        break;
    }
    
    return sortOrder === "asc" ? compareValue : -compareValue;
  });

  // Calculate statistics
  const totalSales = sortedSales.reduce((sum, sale) => sum + sale.soldPrice, 0);
  const totalTax = sortedSales.reduce((sum, sale) => sum + sale.taxCollected, 0);
  const numberOfSales = sortedSales.length;
  const averageSale = numberOfSales > 0 ? totalSales / numberOfSales : 0;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900" data-testid="text-total-sales">
              {formatCurrency(totalSales)}
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mt-1">
              Total Sales
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Receipt className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900" data-testid="text-total-tax">
              {formatCurrency(totalTax)}
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mt-1">
              Total Tax
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <ShoppingBag className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900" data-testid="text-number-sales">
              {numberOfSales}
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mt-1">
              Transactions
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900" data-testid="text-average-sale">
              {formatCurrency(averageSale)}
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mt-1">
              Average Sale
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold">All Sales</CardTitle>
              <Button onClick={() => setDialogOpen(true)} data-testid="button-add-sale">
                <Plus className="w-4 h-4 mr-2" />
                Record Sale
              </Button>
            </div>
            
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Channel</label>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger data-testid="select-channel-filter">
                    <SelectValue placeholder="All channels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    {channels?.filter(c => c.isActive).map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Search Buyer</label>
                <Input
                  type="text"
                  placeholder="Search by name or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-buyer"
                />
              </div>
            </div>
            
            {/* Sorting Options */}
            <div className="flex items-center gap-4 pt-2">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[150px]" data-testid="select-sort-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="channel">Channel</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                <SelectTrigger className="w-[150px]" data-testid="select-sort-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest First</SelectItem>
                  <SelectItem value="asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSales ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Date</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Channel</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Buyer</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Sale Price</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Tax</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Total</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSales.length > 0 ? (
                  sortedSales.map((sale) => {
                    const channel = channels?.find(c => c.id === sale.channelId);
                    return (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                        <TableCell className="text-sm">
                          {format(new Date(sale.saleDate), "MM/dd/yyyy")}
                        </TableCell>
                        <TableCell className="text-sm">{channel?.name || "Unknown"}</TableCell>
                        <TableCell className="text-sm">
                          {sale.buyerName || sale.buyerEmail || "N/A"}
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium">
                          {formatCurrency(sale.soldPrice)}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {formatCurrency(sale.taxCollected)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-bold">
                          {formatCurrency(sale.soldPrice + sale.taxCollected)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(sale)}
                              data-testid={`button-edit-${sale.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(sale.id)}
                              data-testid={`button-delete-${sale.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      {allSales?.length === 0 ? "No sales recorded yet" : "No sales match your filters"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sales Form Dialog */}
      <SalesFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        editingSale={editingSale}
      />
    </div>
  );
}
