import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings } from "@shared/schema";

export default function AdminSettings() {
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    enabled: true, // Re-enable for testing
  });

  const [formData, setFormData] = useState({
    purchaseEnabled: false,
    defaultPurchaseUrl: "https://www.chrismcnulty.net/store",
    adminPassword: "",
    mfaPhoneNumber: "",
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("PUT", "/api/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "There was an error updating the settings.",
        variant: "destructive",
      });
    },
  });

  const migrateToProductionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/migrate-to-production", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Production migration completed",
        description: data.message,
      });
    },
    onError: () => {
      toast({
        title: "Migration failed",
        description: "There was an error migrating data to production.",
        variant: "destructive",
      });
    },
  });

  const initDatabaseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/force-init", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      toast({
        title: "Database initialized",
        description: `Successfully initialized with ${data.finalPhotoCount} photos.`,
      });
    },
    onError: () => {
      toast({
        title: "Initialization failed",
        description: "There was an error initializing the database.",
        variant: "destructive",
      });
    },
  });

  // Update form data when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData({
        purchaseEnabled: settings.purchaseEnabled,
        defaultPurchaseUrl: settings.defaultPurchaseUrl || "https://www.chrismcnulty.net/store",
        adminPassword: settings.adminPassword || "",
        mfaPhoneNumber: settings.mfaPhoneNumber || "",
      });
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12">Loading settings...</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Database Management Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
            <div className="space-y-2">
              <Label className="text-lg font-semibold text-green-900">Shared Database Configuration</Label>
              <p className="text-sm text-green-700">
                <strong>Database Status:</strong> Your development and production environments share the same Neon database. 
                Changes made in either environment appear in both immediately. Your photo collection is synchronized across environments.
              </p>
              <div className="text-xs text-green-600 bg-green-100 p-2 rounded">
                Current status: Database shared between environments
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => migrateToProductionMutation.mutate()}
                disabled={migrateToProductionMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {migrateToProductionMutation.isPending ? "Checking..." : "Verify Database Sync"}
              </Button>
              
              <Button
                type="button"
                onClick={() => initDatabaseMutation.mutate()}
                disabled={initDatabaseMutation.isPending}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                {initDatabaseMutation.isPending ? "Initializing..." : "Quick Initialize"}
              </Button>
            </div>
          </div>
          
          {/* Purchase Links Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Enable Purchase Links</Label>
              <div className="text-sm text-gray-600">
                Show "Buy" links on voting interface
              </div>
            </div>
            <Switch
              checked={formData.purchaseEnabled}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, purchaseEnabled: checked }))
              }
            />
          </div>
          
          {/* Default Purchase URL */}
          <div className="space-y-2">
            <Label htmlFor="defaultPurchaseUrl" className="text-base font-medium">
              Default Purchase URL
            </Label>
            <Input
              id="defaultPurchaseUrl"
              type="url"
              placeholder="https://www.chrismcnulty.net/store"
              value={formData.defaultPurchaseUrl}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, defaultPurchaseUrl: e.target.value }))
              }
              className="w-full"
            />
            <div className="text-sm text-gray-500">
              This URL will be used when individual photos don't have custom purchase URLs set.
              <br />
              <strong>Purchase Priority:</strong> Master control (this toggle) → Individual photo "Never for Sale" setting
            </div>
          </div>

          {/* Admin Password */}
          <div className="space-y-2">
            <Label htmlFor="adminPassword" className="text-base font-medium">
              Admin Password
            </Label>
            <Input
              id="adminPassword"
              type="password"
              placeholder="Enter new admin password"
              value={formData.adminPassword}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, adminPassword: e.target.value }))
              }
              className="w-full"
            />
            <div className="text-sm text-gray-500">
              Change the password required to access the admin panel.
            </div>
          </div>

          {/* MFA Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="mfaPhoneNumber" className="text-base font-medium">
              MFA Phone Number
            </Label>
            <Input
              id="mfaPhoneNumber"
              type="tel"
              placeholder="+16179809810"
              value={formData.mfaPhoneNumber}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, mfaPhoneNumber: e.target.value }))
              }
              className="w-full"
            />
            <div className="text-sm text-gray-500">
              Phone number to receive SMS verification codes. Include country code (e.g., +1 for US).
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <Button 
              type="submit" 
              className="bg-green-700 hover:bg-green-800"
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}