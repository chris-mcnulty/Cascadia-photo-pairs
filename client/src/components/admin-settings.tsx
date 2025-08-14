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
    contestSignupText: "",
    supportEmail: "",
    privacyPolicyUrl: "",
    termsOfServiceUrl: "",
    userLoginEnabledDev: true,
    userLoginEnabledProd: false,
    consentCopyLong: "",
    consentCopyShort: "",
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("PUT", "/api/settings", data, sessionId ? { 'x-session-id': sessionId } : undefined);
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
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("POST", "/api/migrate-to-production", {}, sessionId ? { 'x-session-id': sessionId } : undefined);
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
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("POST", "/api/force-init", {}, sessionId ? { 'x-session-id': sessionId } : undefined);
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
        contestSignupText: settings.contestSignupText || "Join our monthly photo contest! The person who votes the most wins a free print of their choice.",
        supportEmail: settings.supportEmail || "support@cascadiaoceanic.com",
        privacyPolicyUrl: settings.privacyPolicyUrl || "/privacy",
        termsOfServiceUrl: settings.termsOfServiceUrl || "/terms",
        userLoginEnabledDev: settings.userLoginEnabledDev !== undefined ? settings.userLoginEnabledDev : true,
        userLoginEnabledProd: settings.userLoginEnabledProd !== undefined ? settings.userLoginEnabledProd : false,
        consentCopyLong: settings.consentCopyLong || "By registering, you agree to receive updates, tips, and offers from Christopher F. McNulty (Chris) and Cascadia Oceanic LLC. You can unsubscribe anytime via the link in our emails or by contacting privacy@chrismcnulty.net. We do not sell your information. See our Privacy Policy: https://www.chrismcnulty.net/privacy",
        consentCopyShort: settings.consentCopyShort || "I agree to receive updates from Christopher F. McNulty (Chris) & Cascadia Oceanic LLC and accept the Privacy Policy.",
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
          
          {/* User Login Toggle - Split Dev/Prod Settings */}
          <div className="space-y-4">
            <div className="text-lg font-semibold text-gray-900">User Login Features</div>
            
            {/* Development Toggle */}
            <div className="flex items-center justify-between p-4 border border-blue-300 bg-blue-50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base font-medium text-blue-900">Enable in Development</Label>
                <div className="text-sm text-blue-700">
                  Test login/signup features in development environment
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Safe to enable - only affects development environment
                </div>
              </div>
              <Switch
                checked={formData.userLoginEnabledDev}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, userLoginEnabledDev: checked }))
                }
                className="data-[state=checked]:bg-blue-600"
              />
            </div>

            {/* Production Toggle */}
            <div className="flex items-center justify-between p-4 border-2 border-orange-300 bg-orange-50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base font-medium text-orange-900">Enable in Production</Label>
                <div className="text-sm text-orange-700">
                  <strong>⚠️ Production Feature:</strong> Shows login/signup buttons to all users
                </div>
                <div className="text-xs text-orange-600 mt-1">
                  Keep OFF until fully tested and ready for production rollout
                </div>
              </div>
              <Switch
                checked={formData.userLoginEnabledProd}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, userLoginEnabledProd: checked }))
                }
                className="data-[state=checked]:bg-orange-600"
              />
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

          {/* Contest/Signup Text */}
          <div className="space-y-2">
            <Label htmlFor="contestSignupText" className="text-base font-medium">
              Contest Signup Text
            </Label>
            <textarea
              id="contestSignupText"
              placeholder="Join our monthly photo contest! The person who votes the most wins a free print of their choice."
              value={formData.contestSignupText}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, contestSignupText: e.target.value }))
              }
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <div className="text-sm text-gray-500">
              This text appears on the signup page to encourage users to register. Mention benefits like leaderboard access and contest entries.
            </div>
          </div>

          {/* Support Email */}
          <div className="space-y-2">
            <Label htmlFor="supportEmail" className="text-base font-medium">
              Support Email
            </Label>
            <Input
              id="supportEmail"
              type="email"
              placeholder="support@cascadiaoceanic.com"
              value={formData.supportEmail}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, supportEmail: e.target.value }))
              }
              className="w-full"
            />
            <div className="text-sm text-gray-500">
              Contact email displayed in footer and support sections.
            </div>
          </div>

          {/* Privacy Policy URL */}
          <div className="space-y-2">
            <Label htmlFor="privacyPolicyUrl" className="text-base font-medium">
              Privacy Policy URL
            </Label>
            <Input
              id="privacyPolicyUrl"
              type="text"
              placeholder="/privacy"
              value={formData.privacyPolicyUrl}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, privacyPolicyUrl: e.target.value }))
              }
              className="w-full"
            />
            <div className="text-sm text-gray-500">
              URL or path to your privacy policy page (shown in footer).
            </div>
          </div>

          {/* Terms of Service URL */}
          <div className="space-y-2">
            <Label htmlFor="termsOfServiceUrl" className="text-base font-medium">
              Terms of Service URL
            </Label>
            <Input
              id="termsOfServiceUrl"
              type="text"
              placeholder="/terms"
              value={formData.termsOfServiceUrl}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, termsOfServiceUrl: e.target.value }))
              }
              className="w-full"
            />
            <div className="text-sm text-gray-500">
              URL or path to your terms of service page (shown in footer).
            </div>
          </div>

          {/* Consent Copy - Long Form */}
          <div className="space-y-2">
            <Label htmlFor="consentCopyLong" className="text-base font-medium">
              Consent Copy - Long Form (Web)
            </Label>
            <textarea
              id="consentCopyLong"
              placeholder="By registering, you agree to receive updates, tips, and offers from Christopher F. McNulty (Chris) and Cascadia Oceanic LLC..."
              value={formData.consentCopyLong}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, consentCopyLong: e.target.value }))
              }
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <div className="text-sm text-gray-500">
              Full consent text displayed on web signup pages. Should include complete privacy policy and unsubscribe information.
            </div>
          </div>

          {/* Consent Copy - Short Form */}
          <div className="space-y-2">
            <Label htmlFor="consentCopyShort" className="text-base font-medium">
              Consent Copy - Short Form (Mobile)
            </Label>
            <textarea
              id="consentCopyShort"
              placeholder="I agree to receive updates from Christopher F. McNulty (Chris) & Cascadia Oceanic LLC and accept the Privacy Policy."
              value={formData.consentCopyShort}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, consentCopyShort: e.target.value }))
              }
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <div className="text-sm text-gray-500">
              Shortened consent text for mobile signup forms. Should be concise but legally compliant.
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