import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, FileText } from "lucide-react";
import ExpenseFormDialog from "./expense-form-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface Expense {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  categoryName: string;
  purpose?: string;
  receiptUrl?: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
}

export default function ExpenseTracker() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const { toast } = useToast();

  const { data: expenses, isLoading: loadingExpenses } = useQuery<Expense[]>({
    queryKey: ["/api/admin/expenses", categoryFilter !== "all" ? { category: categoryFilter } : {}],
  });

  const { data: categories } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/admin/expense-categories"],
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      await apiRequest("DELETE", `/api/admin/expenses/${id}`);

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });

      toast({
        title: "Success",
        description: "Expense deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Monthly Total Summary */}
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
                Monthly Total
              </div>
              <div className="text-4xl font-bold text-gray-900" data-testid="text-monthly-total">
                {formatCurrency(totalExpenses)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">Expenses</CardTitle>
            <div className="flex items-center gap-4">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setDialogOpen(true)} data-testid="button-add-expense">
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingExpenses ? (
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
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Vendor</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Category</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Purpose</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Amount</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide">Receipt</TableHead>
                  <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses && expenses.length > 0 ? (
                  expenses.map((expense) => (
                    <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                      <TableCell className="text-sm">
                        {format(new Date(expense.date), "MM/dd/yyyy")}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{expense.vendor}</TableCell>
                      <TableCell className="text-sm">{expense.categoryName}</TableCell>
                      <TableCell className="text-sm">{expense.purpose || "N/A"}</TableCell>
                      <TableCell className="text-sm text-right font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>
                        {expense.receiptUrl ? (
                          <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                            data-testid={`link-receipt-${expense.id}`}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            View
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">No receipt</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(expense)}
                            data-testid={`button-edit-${expense.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(expense.id)}
                            data-testid={`button-delete-${expense.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No expenses found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExpenseFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        editingExpense={editingExpense}
      />
    </div>
  );
}
