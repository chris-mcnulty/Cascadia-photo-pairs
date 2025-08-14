import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Trophy, CalendarIcon, Clock, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ContestSettings {
  monthlyContestText: string;
  quarterlyContestText: string;
  monthlyContestEnabled: boolean;
  monthlyContestStartDate: string | null;
  monthlyContestEndDate: string | null;
  quarterlyContestEnabled: boolean;
  quarterlyContestStartDate: string | null;
  quarterlyContestEndDate: string | null;
}

export default function ContestSettings() {
  const { toast } = useToast();
  const [monthlySettings, setMonthlySettings] = useState({
    text: "",
    enabled: false,
    startDate: null as Date | null,
    endDate: null as Date | null,
  });
  
  const [quarterlySettings, setQuarterlySettings] = useState({
    text: "",
    enabled: false,
    startDate: null as Date | null,
    endDate: null as Date | null,
  });

  // Fetch current settings
  const { data: settings, isLoading } = useQuery<ContestSettings>({
    queryKey: ["/api/settings/contests"],
    queryFn: async () => {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error("Failed to fetch settings");
      const data = await response.json();
      return {
        monthlyContestText: data.monthlyContestText || "",
        quarterlyContestText: data.quarterlyContestText || "",
        monthlyContestEnabled: data.monthlyContestEnabled || false,
        monthlyContestStartDate: data.monthlyContestStartDate,
        monthlyContestEndDate: data.monthlyContestEndDate,
        quarterlyContestEnabled: data.quarterlyContestEnabled || false,
        quarterlyContestStartDate: data.quarterlyContestStartDate,
        quarterlyContestEndDate: data.quarterlyContestEndDate,
      };
    }
  });

  // Update local state when settings load
  useEffect(() => {
    if (settings) {
      setMonthlySettings({
        text: settings.monthlyContestText,
        enabled: settings.monthlyContestEnabled,
        startDate: settings.monthlyContestStartDate ? new Date(settings.monthlyContestStartDate) : null,
        endDate: settings.monthlyContestEndDate ? new Date(settings.monthlyContestEndDate) : null,
      });
      setQuarterlySettings({
        text: settings.quarterlyContestText,
        enabled: settings.quarterlyContestEnabled,
        startDate: settings.quarterlyContestStartDate ? new Date(settings.quarterlyContestStartDate) : null,
        endDate: settings.quarterlyContestEndDate ? new Date(settings.quarterlyContestEndDate) : null,
      });
    }
  }, [settings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("PUT", "/api/settings", {
        monthlyContestText: monthlySettings.text,
        quarterlyContestText: quarterlySettings.text,
        monthlyContestEnabled: monthlySettings.enabled,
        monthlyContestStartDate: monthlySettings.startDate?.toISOString() || null,
        monthlyContestEndDate: monthlySettings.endDate?.toISOString() || null,
        quarterlyContestEnabled: quarterlySettings.enabled,
        quarterlyContestStartDate: quarterlySettings.startDate?.toISOString() || null,
        quarterlyContestEndDate: quarterlySettings.endDate?.toISOString() || null,
      });
      
      if (!response.ok) {
        throw new Error("Failed to save settings");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contest settings saved",
        description: "Your contest configurations have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
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
    // Validate dates if contests are enabled
    if (monthlySettings.enabled && (!monthlySettings.startDate || !monthlySettings.endDate)) {
      toast({
        title: "Invalid dates",
        description: "Please set both start and end dates for the monthly contest.",
        variant: "destructive",
      });
      return;
    }
    
    if (quarterlySettings.enabled && (!quarterlySettings.startDate || !quarterlySettings.endDate)) {
      toast({
        title: "Invalid dates",
        description: "Please set both start and end dates for the quarterly contest.",
        variant: "destructive",
      });
      return;
    }
    
    saveSettingsMutation.mutate();
  };

  const isContestActive = (startDate: Date | null, endDate: Date | null, enabled: boolean) => {
    if (!enabled || !startDate || !endDate) return false;
    const now = new Date();
    return now >= startDate && now <= endDate;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">Loading contest settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monthly Contest */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                Monthly Contest
              </CardTitle>
              <CardDescription>
                Configure monthly voting competitions
              </CardDescription>
            </div>
            {isContestActive(monthlySettings.startDate, monthlySettings.endDate, monthlySettings.enabled) && (
              <div className="flex items-center gap-2 text-green-600">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Active Now</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="monthly-enabled" className="text-base">Enable Monthly Contest</Label>
            <Switch
              id="monthly-enabled"
              checked={monthlySettings.enabled}
              onCheckedChange={(checked) => setMonthlySettings(prev => ({ ...prev, enabled: checked }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly-text">Contest Description</Label>
            <Textarea
              id="monthly-text"
              value={monthlySettings.text}
              onChange={(e) => setMonthlySettings(prev => ({ ...prev, text: e.target.value }))}
              placeholder="Describe the monthly contest and prizes..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !monthlySettings.startDate && "text-muted-foreground"
                    )}
                    disabled={!monthlySettings.enabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {monthlySettings.startDate ? format(monthlySettings.startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={monthlySettings.startDate || undefined}
                    onSelect={(date) => setMonthlySettings(prev => ({ ...prev, startDate: date || null }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !monthlySettings.endDate && "text-muted-foreground"
                    )}
                    disabled={!monthlySettings.enabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {monthlySettings.endDate ? format(monthlySettings.endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={monthlySettings.endDate || undefined}
                    onSelect={(date) => setMonthlySettings(prev => ({ ...prev, endDate: date || null }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quarterly Contest */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-purple-600" />
                Quarterly Contest
              </CardTitle>
              <CardDescription>
                Configure quarterly championship competitions
              </CardDescription>
            </div>
            {isContestActive(quarterlySettings.startDate, quarterlySettings.endDate, quarterlySettings.enabled) && (
              <div className="flex items-center gap-2 text-green-600">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Active Now</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quarterly-enabled" className="text-base">Enable Quarterly Contest</Label>
            <Switch
              id="quarterly-enabled"
              checked={quarterlySettings.enabled}
              onCheckedChange={(checked) => setQuarterlySettings(prev => ({ ...prev, enabled: checked }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quarterly-text">Contest Description</Label>
            <Textarea
              id="quarterly-text"
              value={quarterlySettings.text}
              onChange={(e) => setQuarterlySettings(prev => ({ ...prev, text: e.target.value }))}
              placeholder="Describe the quarterly championship and rewards..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !quarterlySettings.startDate && "text-muted-foreground"
                    )}
                    disabled={!quarterlySettings.enabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {quarterlySettings.startDate ? format(quarterlySettings.startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={quarterlySettings.startDate || undefined}
                    onSelect={(date) => setQuarterlySettings(prev => ({ ...prev, startDate: date || null }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !quarterlySettings.endDate && "text-muted-foreground"
                    )}
                    disabled={!quarterlySettings.enabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {quarterlySettings.endDate ? format(quarterlySettings.endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={quarterlySettings.endDate || undefined}
                    onSelect={(date) => setQuarterlySettings(prev => ({ ...prev, endDate: date || null }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          When contests are enabled and active, the user statistics page will display "Monthly Contest" and "Quarterly Contest" 
          instead of regular "Monthly" and "Quarterly" labels. Users will see the contest descriptions to understand the competition.
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
          {saveSettingsMutation.isPending ? "Saving..." : "Save Contest Settings"}
        </Button>
      </div>
    </div>
  );
}