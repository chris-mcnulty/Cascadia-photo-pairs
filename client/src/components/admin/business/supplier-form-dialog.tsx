import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
}

interface SupplierFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingSupplier?: Supplier | null;
}

const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  isActive: z.boolean(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

export default function SupplierFormDialog({ open, onClose, editingSupplier }: SupplierFormDialogProps) {
  const { toast } = useToast();

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contactEmail: "",
      contactPhone: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (open && editingSupplier) {
      form.reset({
        name: editingSupplier.name,
        contactEmail: editingSupplier.contactEmail || "",
        contactPhone: editingSupplier.contactPhone || "",
        isActive: editingSupplier.isActive,
      });
    } else if (open && !editingSupplier) {
      form.reset({
        name: "",
        contactEmail: "",
        contactPhone: "",
        isActive: true,
      });
    }
  }, [open, editingSupplier, form]);

  const onSubmit = async (data: SupplierFormData) => {
    try {
      const payload = {
        name: data.name,
        contactEmail: data.contactEmail || undefined,
        contactPhone: data.contactPhone || undefined,
        isActive: data.isActive,
      };

      if (editingSupplier) {
        await apiRequest("PUT", `/api/admin/suppliers/${editingSupplier.id}`, payload);
        toast({
          title: "Success",
          description: "Supplier updated successfully",
        });
      } else {
        await apiRequest("POST", "/api/admin/suppliers", payload);
        toast({
          title: "Success",
          description: "Supplier created successfully",
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers"] });
      onClose();
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: editingSupplier ? "Failed to update supplier" : "Failed to create supplier",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., BayPhoto" data-testid="input-supplier-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="contact@supplier.com" data-testid="input-supplier-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="(555) 123-4567" data-testid="input-supplier-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-base">Active</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Inactive suppliers won't appear in dropdowns
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-supplier-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                data-testid="button-submit-supplier"
                className="bg-green-600 hover:bg-green-700"
              >
                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingSupplier ? "Update" : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel-supplier"
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
