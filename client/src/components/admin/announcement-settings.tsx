import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AnnouncementSettings {
  announcementEnabled: boolean;
  announcementText: string;
  announcementType: string;
}

export default function AnnouncementSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AnnouncementSettings>({
    announcementEnabled: false,
    announcementText: "",
    announcementType: "info",
  });

  // Fetch current settings
  const { data: currentSettings, isLoading } = useQuery<AnnouncementSettings>({
    queryKey: ["/api/settings/announcement"],
    queryFn: async () => {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error("Failed to fetch settings");
      const data = await response.json();
      return {
        announcementEnabled: data.announcementEnabled || false,
        announcementText: data.announcementText || "",
        announcementType: data.announcementType || "info",
      };
    }
  });

  // Update local state when settings load
  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [currentSettings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("PUT", "/api/settings", settings);
      
      if (!response.ok) {
        throw new Error("Failed to save settings");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Announcement saved",
        description: "Your announcement settings have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    if (settings.announcementEnabled && !settings.announcementText.trim()) {
      toast({
        title: "Invalid announcement",
        description: "Please enter announcement text before enabling.",
        variant: "destructive",
      });
      return;
    }
    
    saveSettingsMutation.mutate();
  };

  const getPreviewStyle = () => {
    switch (settings.announcementType) {
      case "warning":
        return "border-amber-200 bg-amber-50 text-amber-800";
      case "success":
        return "border-green-200 bg-green-50 text-green-800";
      case "contest":
        return "border-purple-200 bg-purple-50 text-purple-800";
      default:
        return "border-blue-200 bg-blue-50 text-blue-800";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">Loading announcement settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          Master Announcement
        </CardTitle>
        <CardDescription>
          Configure the main announcement that appears at the top of the voting page
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="announcement-enabled" className="text-base">Enable Announcement</Label>
            <p className="text-sm text-gray-500">Show the announcement on the main page</p>
          </div>
          <Switch
            id="announcement-enabled"
            checked={settings.announcementEnabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, announcementEnabled: checked }))}
          />
        </div>

        {/* Announcement Type */}
        <div className="space-y-2">
          <Label htmlFor="announcement-type">Announcement Type</Label>
          <Select 
            value={settings.announcementType} 
            onValueChange={(value) => setSettings(prev => ({ ...prev, announcementType: value }))}
          >
            <SelectTrigger id="announcement-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  Information
                </div>
              </SelectItem>
              <SelectItem value="warning">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  Warning
                </div>
              </SelectItem>
              <SelectItem value="success">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Success
                </div>
              </SelectItem>
              <SelectItem value="contest">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  Contest
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Announcement Text */}
        <div className="space-y-2">
          <Label htmlFor="announcement-text">Announcement Text</Label>
          <Textarea
            id="announcement-text"
            value={settings.announcementText}
            onChange={(e) => setSettings(prev => ({ ...prev, announcementText: e.target.value }))}
            placeholder="Enter your announcement message..."
            rows={3}
          />
          <p className="text-xs text-gray-500">
            This message will be displayed prominently on the main voting page
          </p>
        </div>

        {/* Preview */}
        {settings.announcementText && (
          <div className="space-y-2">
            <Label>Preview</Label>
            <Alert className={getPreviewStyle()}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="ml-2">
                <strong>Announcement:</strong> {settings.announcementText}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Info */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The master announcement appears at the top of the voting page for all users. 
            Use it for important updates, maintenance notices, or special events.
          </AlertDescription>
        </Alert>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            disabled={saveSettingsMutation.isPending}
            className="bg-green-700 hover:bg-green-800"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveSettingsMutation.isPending ? "Saving..." : "Save Announcement"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}