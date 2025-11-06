import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface ExpenseCategory {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  categoryId: string;
  purpose?: string;
  receiptUrl?: string;
  notes?: string;
}

interface ExpenseFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingExpense?: Expense | null;
}

const expenseSchema = z.object({
  vendor: z.string().min(1, "Vendor is required"),
  amount: z.string().min(1, "Amount is required"),
  date: z.string().min(1, "Date is required"),
  categoryId: z.string().min(1, "Category is required"),
  purpose: z.string().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

export default function ExpenseFormDialog({ open, onClose, editingExpense }: ExpenseFormDialogProps) {
  const { toast } = useToast();

  const { data: categories } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/admin/expense-categories"],
    enabled: open,
  });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      vendor: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      categoryId: "",
      purpose: "",
      receiptUrl: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (editingExpense) {
      form.reset({
        vendor: editingExpense.vendor,
        amount: (editingExpense.amount / 100).toFixed(2),
        date: new Date(editingExpense.date).toISOString().split("T")[0],
        categoryId: editingExpense.categoryId,
        purpose: editingExpense.purpose || "",
        receiptUrl: editingExpense.receiptUrl || "",
        notes: editingExpense.notes || "",
      });
    } else {
      form.reset({
        vendor: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        categoryId: "",
        purpose: "",
        receiptUrl: "",
        notes: "",
      });
    }
  }, [editingExpense, form, open]);

  const onSubmit = async (data: ExpenseFormData) => {
    try {
      const payload = {
        ...data,
        amount: Math.round(parseFloat(data.amount) * 100),
      };

      if (editingExpense) {
        await apiRequest("PUT", `/api/admin/expenses/${editingExpense.id}`, payload);
      } else {
        await apiRequest("POST", "/api/admin/expenses", payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/expenses"] });

      toast({
        title: "Success",
        description: `Expense ${editingExpense ? "updated" : "created"} successfully`,
      });

      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${editingExpense ? "update" : "create"} expense`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-vendor" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-purpose" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="receiptUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt URL</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://example.com/receipt.pdf or file name"
                      data-testid="input-receipt-url"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-gray-500 mt-1">
                    Note: SharePoint upload integration will be added later
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                data-testid="button-submit"
              >
                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingExpense ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
