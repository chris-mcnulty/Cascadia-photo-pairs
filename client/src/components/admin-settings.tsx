import { useState } from "react";
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
  });

  const [formData, setFormData] = useState({
    purchaseEnabled: settings?.purchaseEnabled || false,
    defaultPurchaseUrl: settings?.defaultPurchaseUrl || "https://www.chrismcnulty.net/store",
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

  // Update form data when settings are loaded
  useState(() => {
    if (settings) {
      setFormData({
        purchaseEnabled: settings.purchaseEnabled,
        defaultPurchaseUrl: settings.defaultPurchaseUrl || "https://www.chrismcnulty.net/store",
      });
    }
  });

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
