import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Package, Package2, Building2, Receipt, Upload } from "lucide-react";
import BusinessDashboard from "./business/business-dashboard";
import ProductManagement from "./business/product-management";
import InventoryManagement from "./business/inventory-management";
import SupplierManagement from "./business/supplier-management";
import ProductSizesManagement from "./business/product-sizes-management";
import ExpenseTracker from "./business/expense-tracker";
import { CSVImport } from "./business/csv-import";

export default function BusinessManagement() {
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "products" | "inventory" | "suppliers" | "sizes" | "expenses" | "import">("dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-medium text-gray-900">Business Management</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeSubTab === "dashboard" ? "default" : "outline"}
          onClick={() => setActiveSubTab("dashboard")}
          className="flex items-center text-sm"
          size="sm"
          data-testid="button-dashboard-subtab"
        >
          <LayoutDashboard className="w-4 h-4 mr-2" />
          Dashboard
        </Button>
        <Button
          variant={activeSubTab === "products" ? "default" : "outline"}
          onClick={() => setActiveSubTab("products")}
          className="flex items-center text-sm"
          size="sm"
          data-testid="button-products-subtab"
        >
          <Package2 className="w-4 h-4 mr-2" />
          Products
        </Button>
        <Button
          variant={activeSubTab === "inventory" ? "default" : "outline"}
          onClick={() => setActiveSubTab("inventory")}
          className="flex items-center text-sm"
          size="sm"
          data-testid="button-inventory-subtab"
        >
          <Package className="w-4 h-4 mr-2" />
          Inventory
        </Button>
        <Button
          variant={activeSubTab === "suppliers" ? "default" : "outline"}
          onClick={() => setActiveSubTab("suppliers")}
          className="flex items-center text-sm"
          size="sm"
          data-testid="button-suppliers-subtab"
        >
          <Building2 className="w-4 h-4 mr-2" />
          Suppliers
        </Button>
        <Button
          variant={activeSubTab === "sizes" ? "default" : "outline"}
          onClick={() => setActiveSubTab("sizes")}
          className="flex items-center text-sm"
          size="sm"
          data-testid="button-sizes-subtab"
        >
          <Package2 className="w-4 h-4 mr-2" />
          Sizes
        </Button>
        <Button
          variant={activeSubTab === "expenses" ? "default" : "outline"}
          onClick={() => setActiveSubTab("expenses")}
          className="flex items-center text-sm"
          size="sm"
          data-testid="button-expenses-subtab"
        >
          <Receipt className="w-4 h-4 mr-2" />
          Expenses
        </Button>
        <Button
          variant={activeSubTab === "import" ? "default" : "outline"}
          onClick={() => setActiveSubTab("import")}
          className="flex items-center text-sm"
          size="sm"
          data-testid="button-import-subtab"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import Data
        </Button>
      </div>

      {/* Sub-tab Content */}
      {activeSubTab === "dashboard" && <BusinessDashboard />}
      {activeSubTab === "products" && <ProductManagement />}
      {activeSubTab === "inventory" && <InventoryManagement />}
      {activeSubTab === "suppliers" && <SupplierManagement />}
      {activeSubTab === "sizes" && <ProductSizesManagement />}
      {activeSubTab === "expenses" && <ExpenseTracker />}
      {activeSubTab === "import" && <CSVImport />}
    </div>
  );
}
