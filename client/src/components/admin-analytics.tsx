import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Calendar, Trash2, TrendingUp, BarChart3, AlertTriangle, Download } from "lucide-react";

interface StatsData {
  totalVotes: number;
  uniqueVoters: number;
  avgVotesPerUser: number;
  topPhotos: Array<{
    id: string;
    title: string;
    votes: number;
    wins: number;
    comparisons: number;
    hidden: boolean;
  }>;
  dateRange: { startDate: string; endDate: string } | null;
}

export default function AdminAnalytics() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [purgeDate, setPurgeDate] = useState("");
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const { data: stats, isLoading, error, refetch } = useQuery<StatsData>({
    queryKey: ["/api/stats", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      
      const response = await apiRequest("GET", `/api/stats?${params.toString()}`);
      const data = await response.json();
      console.log('Analytics data received:', data);
      return data;
    },
    retry: false,
  });

  const purgeTestDataMutation = useMutation({
    mutationFn: async (beforeDate: string) => {
      const response = await apiRequest("POST", "/api/admin/purge-test-data", { beforeDate });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Test data purged",
        description: `Deleted ${data.votesDeleted} votes and reset photo statistics.`,
      });
      setPurgeDate("");
      setShowPurgeConfirm(false);
    },
    onError: () => {
      toast({
        title: "Failed to purge test data",
        description: "There was an error purging the test data.",
        variant: "destructive",
      });
    },
  });

  const handleDateFilter = () => {
    if (startDate && endDate && startDate > endDate) {
      toast({
        title: "Invalid date range",
        description: "Start date must be before end date.",
        variant: "destructive",
      });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
  };

  const handlePurgeTestData = () => {
    if (!purgeDate) {
      toast({
        title: "Date required",
        description: "Please select a date to purge data before.",
        variant: "destructive",
      });
      return;
    }
    setShowPurgeConfirm(true);
  };

  const handleExportData = async () => {
    try {
      const response = await fetch("/api/export", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to export data");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cascadia-oceanic-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Data exported",
        description: "Your data has been downloaded as a backup file.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error downloading your data.",
        variant: "destructive",
      });
    }
  };

  const confirmPurge = () => {
    purgeTestDataMutation.mutate(purgeDate);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Date Range Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleDateFilter} className="flex-1">
                Apply Filter
              </Button>
              {(startDate || endDate) && (
                <Button variant="outline" onClick={clearDateFilter}>
                  Clear
                </Button>
              )}
            </div>
          </div>
          
          {stats?.dateRange && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Showing data from {new Date(stats.dateRange.startDate).toLocaleDateString()} 
                {" "}to {new Date(stats.dateRange.endDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats?.totalVotes || 0}</p>
                <p className="text-sm text-gray-600">Total Votes</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats?.uniqueVoters || 0}</p>
                <p className="text-sm text-gray-600">Unique Voters</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats?.avgVotesPerUser || 0}</p>
                <p className="text-sm text-gray-600">Avg Votes/User</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Photos Rankings */}
      <Card>
        <CardHeader>
          <CardTitle>Top 20 Photo Rankings</CardTitle>
          <p className="text-sm text-gray-600">
            {stats?.dateRange ? "Rankings for selected date range" : "All-time rankings"}
          </p>
        </CardHeader>
        <CardContent>
          {stats?.topPhotos && stats.topPhotos.length > 0 ? (
            <div className="space-y-2">
              {stats.topPhotos.map((photo, index) => (
                <div key={photo.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="text-lg font-bold text-gray-500 min-w-[2rem]">
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{photo.title}</h4>
                      {photo.hidden && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                          Hidden
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {photo.votes} votes • {photo.comparisons > 0 ? Math.round((photo.wins / photo.comparisons) * 100) : 0}% win rate
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No photos found for the selected criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Data Purge */}
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="w-5 h-5" />
            Test Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-400">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                  ⚠️ IRREVERSIBLE ACTION
                </p>
                <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                  This will <strong>permanently delete</strong> all votes cast before the selected date 
                  and reset all photo statistics (votes, wins, comparisons) to zero. 
                  <strong>This action cannot be undone.</strong>
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleExportData}
                    variant="outline"
                    size="sm"
                    className="bg-white text-red-700 border-red-300 hover:bg-red-50"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Backup First
                  </Button>
                  <span className="text-xs text-red-700 dark:text-red-300">
                    Recommended before purging
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="purgeDate">Purge votes before this date</Label>
              <Input
                id="purgeDate"
                type="date"
                value={purgeDate}
                onChange={(e) => setPurgeDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button 
                variant="destructive" 
                onClick={handlePurgeTestData}
                disabled={purgeTestDataMutation.isPending || !purgeDate}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {purgeTestDataMutation.isPending ? "Purging..." : "Purge Test Data"}
              </Button>
            </div>
          </div>

          {showPurgeConfirm && (
            <div className="p-6 bg-red-100 dark:bg-red-900/30 border-2 border-red-300 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <div>
                  <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                    Final Confirmation Required
                  </h4>
                  <p className="text-red-800 dark:text-red-200 mb-3">
                    You are about to <strong>permanently delete</strong> all votes cast before{" "}
                    <strong>{new Date(purgeDate).toLocaleDateString()}</strong> and reset all photo statistics to zero.
                  </p>
                  <div className="bg-red-200 dark:bg-red-800 p-3 rounded mb-4">
                    <p className="text-red-900 dark:text-red-100 text-sm font-medium">
                      ⚠️ This action is <strong>IRREVERSIBLE</strong>
                    </p>
                    <p className="text-red-800 dark:text-red-200 text-sm mt-1">
                      Make sure you have downloaded a backup if you need to preserve this data.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleExportData}
                  variant="outline"
                  className="flex-1 bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Backup First
                </Button>
                <div className="flex gap-2 flex-1">
                  <Button 
                    variant="destructive" 
                    onClick={confirmPurge}
                    disabled={purgeTestDataMutation.isPending}
                    className="flex-1"
                  >
                    {purgeTestDataMutation.isPending ? "Purging..." : "Yes, Delete Forever"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPurgeConfirm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}