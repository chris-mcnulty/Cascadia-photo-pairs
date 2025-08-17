import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Calendar, Trash2, TrendingUp, BarChart3, AlertTriangle, Download, ArrowUpDown, FilterIcon, ChevronDown, ChevronRight, Edit, Eye, EyeOff, Archive, ArchiveRestore } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface StatsData {
  totalVotes: number;
  uniqueVoters: number;
  avgVotesPerUser: number;
  topPhotos: Array<{
    id: string;
    title: string;
    imageUrl: string;
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
  const [sortBy, setSortBy] = useState<"votes" | "winRate">("votes");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedVoterType, setSelectedVoterType] = useState<string>("all");
  const [rankingLimit, setRankingLimit] = useState<number>(20);
  const [isPurgeSectionOpen, setIsPurgeSectionOpen] = useState(false);
  const [reverseSort, setReverseSort] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats", startDate, endDate, selectedCategory, selectedVoterType],
    enabled: true,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (selectedVoterType !== "all") params.append("voterType", selectedVoterType);
      
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await fetch(`/api/stats?${params.toString()}`, {
        credentials: "include",
        headers: sessionId ? { 'x-session-id': sessionId } : {},
      });
      
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  // Query for photo categories
  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const purgeTestDataMutation = useMutation({
    mutationFn: async (beforeDate: string) => {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("POST", "/api/admin/purge-test-data", { beforeDate }, sessionId ? { 'x-session-id': sessionId } : undefined);
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

  // Photo edit mutation
  const editPhotoMutation = useMutation({
    mutationFn: async (photoData: { id: string; hidden?: boolean; archived?: boolean; description?: string }) => {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("PUT", `/api/photos/${photoData.id}`, photoData, sessionId ? { 'x-session-id': sessionId } : undefined);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setShowEditDialog(false);
      setEditingPhoto(null);
      toast({
        title: "Photo updated",
        description: "Photo settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to update photo",
        description: "There was an error updating the photo.",
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

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (selectedVoterType !== "all") params.append("voterType", selectedVoterType);
      
      const response = await fetch(`/api/export/csv?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Failed to export CSV");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cascadia-oceanic-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "CSV exported",
        description: "All photo analytics data has been downloaded as CSV.",
      });
    } catch (error) {
      toast({
        title: "CSV export failed",
        description: "There was an error exporting the CSV data.",
        variant: "destructive",
      });
    }
  };

  const confirmPurge = () => {
    purgeTestDataMutation.mutate(purgeDate);
  };

  const handleEditPhoto = (photo: any) => {
    setEditingPhoto({
      ...photo,
      newDescription: photo.description || "",
      newHidden: photo.hidden || false,
      newArchived: photo.archived || false,
    });
    setShowEditDialog(true);
  };

  const handleSavePhotoEdit = () => {
    if (!editingPhoto) return;
    
    editPhotoMutation.mutate({
      id: editingPhoto.id,
      hidden: editingPhoto.newHidden,
      archived: editingPhoto.newArchived,
      description: editingPhoto.newDescription,
    });
  };

  // Sort photos based on selected criteria - use the filtered data from stats
  const sortedPhotos = stats?.topPhotos ? [...stats.topPhotos].sort((a, b) => {
    let comparison = 0;
    if (sortBy === "winRate") {
      const aWinRate = a.comparisons > 0 ? (a.wins / a.comparisons) : 0;
      const bWinRate = b.comparisons > 0 ? (b.wins / b.comparisons) : 0;
      comparison = bWinRate - aWinRate; // Higher win rate first
    } else {
      comparison = b.votes - a.votes; // Higher votes first (default)
    }
    // Apply reverse sort if enabled
    return reverseSort ? -comparison : comparison;
  }) : [];

  if (isLoading) {
    return <div className="flex justify-center py-12">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Advanced Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="w-5 h-5" />
            Advanced Analytics Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range Filter */}
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

          {/* Category and Voter Type Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Photo Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="voterType">Voter Type</Label>
              <Select value={selectedVoterType} onValueChange={setSelectedVoterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select voter type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Voters</SelectItem>
                  <SelectItem value="user">User Votes Only</SelectItem>
                  <SelectItem value="admin">Admin Votes Only</SelectItem>
                </SelectContent>
              </Select>
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

      {/* Export Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Analytics Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={handleExportCSV} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Export All Photos (CSV)
            </Button>
            <Button onClick={handleExportData} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Export Full Backup (JSON)
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            CSV export includes all photos with win rates and rankings. JSON backup includes complete database dump.
          </p>
        </CardContent>
      </Card>

      {/* Top Photos Rankings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {viewAll ? "All Photo Rankings" : `Top ${rankingLimit} Photo Rankings`}
                {reverseSort && " (Underperforming First)"}
              </CardTitle>
              <p className="text-sm text-gray-600">
                {stats?.dateRange ? "Rankings for selected date range" : "All-time rankings"}
                {selectedVoterType !== "all" && ` • ${selectedVoterType === "admin" ? "Admin" : "User"} votes only`}
                {selectedCategory !== "all" && ` • ${selectedCategory} category`}
                {reverseSort && " • Sorted reverse to show underperforming photos first"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-600">Show:</span>
                <Select value={viewAll ? "all" : rankingLimit.toString()} onValueChange={(value) => {
                  if (value === "all") {
                    setViewAll(true);
                  } else {
                    setViewAll(false);
                    setRankingLimit(Number(value));
                  }
                }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <ArrowUpDown className="w-4 h-4" />
                  <Select value={sortBy} onValueChange={(value: "votes" | "winRate") => setSortBy(value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="votes">Sort by Votes</SelectItem>
                      <SelectItem value="winRate">Sort by Win Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="reverse-sort"
                    checked={reverseSort}
                    onCheckedChange={setReverseSort}
                  />
                  <Label htmlFor="reverse-sort" className="text-sm text-gray-600">
                    Reverse
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedPhotos && sortedPhotos.length > 0 ? (
            <div className="space-y-2">
              {(viewAll ? sortedPhotos : sortedPhotos.slice(0, rankingLimit)).map((photo, index) => {
                const winRate = photo.comparisons > 0 ? Math.round((photo.wins / photo.comparisons) * 100) : 0;
                return (
                  <div key={photo.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="text-lg font-bold text-gray-500 min-w-[2rem]">
                      #{index + 1}
                    </div>
                    <img 
                      src={photo.imageUrl?.includes?.('[base64-truncated]') ? 
                        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA4MCA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjU2IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAyOEwzNiAyMEw0NCAyOEw0MCAzMkgzMlYzNkwyOCAzMloiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2Zz4K' 
                        : photo.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA4MCA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjU2IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAyOEwzNiAyMEw0NCAyOEw0MCAzMkgzMlYzNkwyOCAzMloiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2Zz4K'} 
                      alt={photo.title}
                      className="w-16 h-12 object-cover rounded bg-gray-100 flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA4MCA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjU2IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAyOEwzNiAyMEw0NCAyOEw0MCAzMkgzMlYzNkwyOCAzMloiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2Zz4K';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{photo.title}</h4>
                        {photo.hidden && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded flex-shrink-0">
                            Hidden
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {photo.votes} votes • {winRate}% win rate
                        {sortBy === "winRate" && (
                          <span className="ml-2 text-xs text-blue-600">
                            ({photo.wins}/{photo.comparisons} wins)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        {sortBy === "winRate" ? (
                          <div className="text-lg font-bold text-blue-600">{winRate}%</div>
                        ) : (
                          <div className="text-lg font-bold text-green-600">{photo.votes}</div>
                        )}
                        <div className="text-xs text-gray-500">
                          {sortBy === "winRate" ? "win rate" : "votes"}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPhoto(photo)}
                        className="text-xs px-2 py-1"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No photos found for the selected criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collapsed Test Data Purge Section */}
      <Card className="border-red-300">
        <Collapsible open={isPurgeSectionOpen} onOpenChange={setIsPurgeSectionOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="hover:bg-red-50 cursor-pointer">
              <CardTitle className="flex items-center justify-between text-red-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  ⚠️ Test Data Management
                </div>
                {isPurgeSectionOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
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
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Photo Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Photo Settings</DialogTitle>
            <DialogDescription>
              Manage photo visibility and settings for voting
            </DialogDescription>
          </DialogHeader>
          
          {editingPhoto && (
            <div className="space-y-6">
              {/* Photo Preview */}
              <div className="flex items-center gap-4">
                <img
                  src={editingPhoto.imageUrl?.includes?.('[base64-truncated]') ? 
                    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA4MCA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjU2IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAyOEwzNiAyMEw0NCAyOEw0MCAzMkgzMlYzNkwyOCAzMloiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2Zz4K' 
                    : editingPhoto.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA4MCA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjU2IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAyOEwzNiAyMEw0NCAyOEw0MCAzMkgzMlYzNkwyOCAzMloiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2Zz4K'}
                  alt={editingPhoto.title}
                  className="w-16 h-12 object-cover rounded bg-gray-100"
                />
                <div>
                  <h4 className="font-medium">{editingPhoto.title}</h4>
                  <p className="text-sm text-gray-600">
                    {editingPhoto.votes} votes • {editingPhoto.comparisons > 0 ? Math.round((editingPhoto.wins / editingPhoto.comparisons) * 100) : 0}% win rate
                  </p>
                </div>
              </div>

              {/* Edit Controls */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-gray-500" />
                    <Label htmlFor="hidden-toggle">Hide from voting</Label>
                  </div>
                  <Switch
                    id="hidden-toggle"
                    checked={editingPhoto.newHidden}
                    onCheckedChange={(checked) => 
                      setEditingPhoto(prev => ({ ...prev, newHidden: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Archive className="w-4 h-4 text-gray-500" />
                    <Label htmlFor="archived-toggle">Archive photo</Label>
                  </div>
                  <Switch
                    id="archived-toggle"
                    checked={editingPhoto.newArchived}
                    onCheckedChange={(checked) => 
                      setEditingPhoto(prev => ({ ...prev, newArchived: checked }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Add notes about this photo..."
                    value={editingPhoto.newDescription}
                    onChange={(e) => 
                      setEditingPhoto(prev => ({ ...prev, newDescription: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
              </div>

              {/* Status Explanation */}
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Hidden:</strong> Photo will not appear in voting but stays in database</p>
                <p><strong>Archived:</strong> Photo is marked as archived but kept for analytics</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSavePhotoEdit}
              disabled={editPhotoMutation.isPending}
            >
              {editPhotoMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}