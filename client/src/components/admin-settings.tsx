import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings } from "@shared/schema";

export default function AdminSettings() {
  const { toast } = useToast();
  const [isDatabaseSectionOpen, setIsDatabaseSectionOpen] = useState(false);
  const [isSpeSectionOpen, setIsSpeSectionOpen] = useState(false);
  const [speTestResult, setSpeTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [speTestLoading, setSpeTestLoading] = useState(false);
  const [migrationJobId, setMigrationJobId] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<{
    running: boolean; total: number; done: number; failed: number;
    items: Array<{ id: string; title: string; status: string; error?: string }>;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    enabled: true, // Re-enable for testing
  });

  const [formData, setFormData] = useState({
    publicSiteEnabled: true,
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
    pairsEnabled: false,
    pairsMinInterval: 4,
    pairsMaxInterval: 8,
    campaignFromName: "",
    campaignFromEmail: "",
    campaignReplyTo: "",
    campaignMailingAddress: "",
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
        publicSiteEnabled: settings.publicSiteEnabled !== undefined ? settings.publicSiteEnabled : true,
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
        pairsEnabled: settings.pairsEnabled !== undefined ? settings.pairsEnabled : false,
        pairsMinInterval: settings.pairsMinInterval || 4,
        pairsMaxInterval: settings.pairsMaxInterval || 8,
        campaignFromName: settings.campaignFromName || "Cascadia Oceanic",
        campaignFromEmail: settings.campaignFromEmail || "cascadia@chrismcnulty.net",
        campaignReplyTo: settings.campaignReplyTo || "cascadia@chrismcnulty.net",
        campaignMailingAddress: settings.campaignMailingAddress || "",
      });
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(formData);
  };

  const handleSpeTest = async () => {
    setSpeTestLoading(true);
    setSpeTestResult(null);
    try {
      const sessionId = localStorage.getItem('admin-session-id');
      const token = localStorage.getItem('auth-token');
      const headers: Record<string, string> = {};
      if (sessionId) headers['x-session-id'] = sessionId;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch("/api/admin/settings/spe-test", { headers });
      const data = await res.json();
      setSpeTestResult(data);
    } catch (err) {
      setSpeTestResult({ ok: false, message: String(err) });
    } finally {
      setSpeTestLoading(false);
    }
  };

  const handleStartMigration = async () => {
    try {
      const sessionId = localStorage.getItem('admin-session-id');
      const token = localStorage.getItem('auth-token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionId) headers['x-session-id'] = sessionId;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch("/api/admin/photos/migrate-to-spe", { method: "POST", headers });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Migration failed to start", description: data.message, variant: "destructive" });
        return;
      }
      setMigrationJobId(data.jobId);
      toast({ title: "Migration started", description: `${data.total} photos queued` });
      // Start polling
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const pollRes = await fetch(`/api/admin/photos/migration-status?jobId=${data.jobId}`, { headers });
        const status = await pollRes.json();
        setMigrationStatus(status);
        if (!status.running) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          toast({ title: "Migration complete", description: `Done: ${status.done}, Failed: ${status.failed}` });
        }
      }, 3000);
    } catch (err) {
      toast({ title: "Migration error", description: String(err), variant: "destructive" });
    }
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

          {/* Site Access Mode — top-level gate */}
          <div className={`flex items-center justify-between p-4 border-2 rounded-lg ${formData.publicSiteEnabled ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
            <div className="space-y-0.5">
              <Label className={`text-base font-semibold ${formData.publicSiteEnabled ? "text-green-900" : "text-red-900"}`}>
                Public Site Access
              </Label>
              <div className={`text-sm ${formData.publicSiteEnabled ? "text-green-700" : "text-red-700"}`}>
                {formData.publicSiteEnabled
                  ? "Full site is visible — visitors can browse Portfolio, Store, Biography, etc."
                  : "Restricted mode — non-admin visitors only see the Photo Pairs voting app. All other pages redirect to /."}
              </div>
              <div className={`text-xs mt-1 ${formData.publicSiteEnabled ? "text-green-600" : "text-red-600"}`}>
                {formData.publicSiteEnabled
                  ? "Turn OFF to hide the full public site while keeping Photo Pairs live."
                  : "Admins are unaffected and retain full access to all pages and the Admin panel."}
              </div>
            </div>
            <Switch
              checked={formData.publicSiteEnabled}
              onCheckedChange={(checked) =>
                setFormData(prev => ({ ...prev, publicSiteEnabled: checked }))
              }
              className={formData.publicSiteEnabled ? "data-[state=checked]:bg-green-600" : ""}
            />
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

          {/* Photo Pairs Feature Settings */}
          <div className="space-y-4 p-4 border border-purple-300 bg-purple-50 rounded-lg">
            <div className="text-lg font-semibold text-purple-900">Photo Pairs Feature</div>
            
            {/* Pairs Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium text-purple-900">Enable Photo Pairs</Label>
                <div className="text-sm text-purple-700">
                  Show predefined photo pairs (e.g., color vs B&W versions) at regular intervals
                </div>
              </div>
              <Switch
                checked={formData.pairsEnabled}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, pairsEnabled: checked }))
                }
                className="data-[state=checked]:bg-purple-600"
              />
            </div>
            
            {/* Frequency Settings */}
            {formData.pairsEnabled && (
              <div className="space-y-3 mt-3 pl-4 border-l-2 border-purple-300">
                <div className="space-y-2">
                  <Label htmlFor="pairsMinInterval" className="text-sm font-medium text-purple-900">
                    Minimum Votes Between Pairs
                  </Label>
                  <Input
                    id="pairsMinInterval"
                    type="number"
                    min="1"
                    max="50"
                    value={formData.pairsMinInterval}
                    onChange={(e) => 
                      setFormData(prev => ({ ...prev, pairsMinInterval: parseInt(e.target.value) || 4 }))
                    }
                    className="w-24"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pairsMaxInterval" className="text-sm font-medium text-purple-900">
                    Maximum Votes Between Pairs
                  </Label>
                  <Input
                    id="pairsMaxInterval"
                    type="number"
                    min="1"
                    max="50"
                    value={formData.pairsMaxInterval}
                    onChange={(e) => 
                      setFormData(prev => ({ ...prev, pairsMaxInterval: parseInt(e.target.value) || 8 }))
                    }
                    className="w-24"
                  />
                </div>
                
                <div className="text-xs text-purple-600">
                  Pairs will appear randomly within this vote interval range to add variety
                </div>
              </div>
            )}
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

          {/* Email Campaign Defaults */}
          <div className="space-y-2 border-t pt-6">
            <h3 className="text-lg font-semibold">Email Marketing Defaults</h3>
            <p className="text-sm text-gray-500">Used as defaults for new campaigns and the marketing email footer.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="campaignFromName">From name</Label>
              <Input
                id="campaignFromName"
                value={formData.campaignFromName}
                onChange={(e) => setFormData(prev => ({ ...prev, campaignFromName: e.target.value }))}
                placeholder="Cascadia Oceanic"
                data-testid="input-campaign-from-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignFromEmail">From email</Label>
              <Input
                id="campaignFromEmail"
                value={formData.campaignFromEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, campaignFromEmail: e.target.value }))}
                placeholder="cascadia@chrismcnulty.net"
                data-testid="input-campaign-from-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignReplyTo">Reply-to email</Label>
              <Input
                id="campaignReplyTo"
                value={formData.campaignReplyTo}
                onChange={(e) => setFormData(prev => ({ ...prev, campaignReplyTo: e.target.value }))}
                placeholder="cascadia@chrismcnulty.net"
                data-testid="input-campaign-reply-to"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignMailingAddress">Mailing address (CAN-SPAM)</Label>
              <Input
                id="campaignMailingAddress"
                value={formData.campaignMailingAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, campaignMailingAddress: e.target.value }))}
                placeholder="Cascadia Oceanic LLC, City, State"
                data-testid="input-campaign-address"
              />
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
      
      {/* Photo Storage (SharePoint Embedded) */}
      <Card className="mt-6 border-blue-300">
        <Collapsible open={isSpeSectionOpen} onOpenChange={setIsSpeSectionOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="hover:bg-blue-50 cursor-pointer">
              <CardTitle className="flex items-center justify-between text-blue-800">
                <div className="flex items-center gap-2">
                  📁 Photo Storage (SharePoint Embedded)
                </div>
                {isSpeSectionOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
              {/* Container info */}
              <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 space-y-2">
                <Label className="font-semibold text-blue-900">Container ID</Label>
                <p className="text-sm text-blue-800 font-mono break-all">
                  {(window as any).__SPE_CONTAINER_ID__ || "Set via SPE_CONTAINER_ID environment variable"}
                </p>
                <p className="text-xs text-blue-700">
                  New file uploads go to this container. Use the Test button to verify the connection.
                </p>
              </div>

              {/* Test connection */}
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSpeTest}
                  disabled={speTestLoading}
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  {speTestLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing…</> : "Test Connection"}
                </Button>
                {speTestResult && (
                  <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${speTestResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                    {speTestResult.ok
                      ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                    <span>{speTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* Migration */}
              <div className="space-y-4 border-t pt-4">
                <div>
                  <Label className="font-semibold text-blue-900">Migrate Photos to SharePoint</Label>
                  <p className="text-sm text-blue-700 mt-1">
                    Migrates all Wix-hosted and database-stored photos to SharePoint Embedded.
                    Three size variants (thumb/mid/full) are generated for each photo.
                    Progress is shown below; the page stays live during migration.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleStartMigration}
                  disabled={migrationStatus?.running === true}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {migrationStatus?.running ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Migrating…</> : "Start Migration"}
                </Button>

                {migrationStatus && (
                  <div className="space-y-3">
                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm font-medium">
                        <span>{migrationStatus.done} done / {migrationStatus.total} total · {migrationStatus.failed} failed</span>
                        {!migrationStatus.running && <span className="text-green-700">Complete</span>}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: migrationStatus.total ? `${Math.round(((migrationStatus.done + migrationStatus.failed) / migrationStatus.total) * 100)}%` : "0%" }}
                        />
                      </div>
                    </div>

                    {/* Per-photo status list */}
                    <div className="max-h-64 overflow-y-auto border rounded-lg divide-y text-xs">
                      {migrationStatus.items.map(item => (
                        <div key={item.id} className={`flex items-center gap-2 px-3 py-1.5 ${item.status === "done" ? "bg-green-50" : item.status === "failed" ? "bg-red-50" : "bg-white"}`}>
                          {item.status === "done" && <CheckCircle className="w-3 h-3 text-green-600 shrink-0" />}
                          {item.status === "failed" && <XCircle className="w-3 h-3 text-red-600 shrink-0" />}
                          {item.status === "pending" && <Loader2 className="w-3 h-3 text-gray-400 shrink-0" />}
                          <span className="truncate flex-1">{item.title}</span>
                          {item.error && <span className="text-red-600 truncate max-w-xs">{item.error}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Collapsed Database Management Section */}
      <Card className="mt-6 border-orange-300">
        <Collapsible open={isDatabaseSectionOpen} onOpenChange={setIsDatabaseSectionOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="hover:bg-orange-50 cursor-pointer">
              <CardTitle className="flex items-center justify-between text-orange-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  Advanced Database Operations
                </div>
                {isDatabaseSectionOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="p-4 border-2 border-orange-200 rounded-lg bg-orange-50">
                <div className="space-y-2">
                  <Label className="text-lg font-semibold text-orange-900">⚠️ Database Management</Label>
                  <p className="text-sm text-orange-800">
                    <strong>Warning:</strong> These operations can affect your entire database. Use with caution.
                    Your development and production environments share the same Neon database.
                  </p>
                  <div className="text-xs text-orange-700 bg-orange-100 p-2 rounded">
                    Current status: Database shared between environments
                  </div>
                </div>
                
                <div className="flex gap-3 mt-4">
                  <Button
                    type="button"
                    onClick={() => migrateToProductionMutation.mutate()}
                    disabled={migrateToProductionMutation.isPending}
                    variant="outline"
                    className="border-orange-600 text-orange-600 hover:bg-orange-50"
                  >
                    {migrateToProductionMutation.isPending ? "Checking..." : "Verify Database Sync"}
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={() => initDatabaseMutation.mutate()}
                    disabled={initDatabaseMutation.isPending}
                    variant="outline"
                    className="border-orange-600 text-orange-600 hover:bg-orange-50"
                  >
                    {initDatabaseMutation.isPending ? "Initializing..." : "Quick Initialize"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </form>
  );
}