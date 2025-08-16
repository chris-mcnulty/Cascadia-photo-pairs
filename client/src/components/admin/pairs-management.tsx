import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Eye, Archive, AlertTriangle, Activity } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Photo {
  id: string;
  title: string;
  imageUrl: string;
  hidden: boolean;
  archived: boolean;
  category?: string;
}

interface PhotoPair {
  id: string;
  photo1Id: string;
  photo2Id: string;
  description?: string;
  createdAt: string;
  createdBy?: string;
}

interface PairStats {
  photo1Wins: number;
  photo2Wins: number;
  totalVotes: number;
  photo1WinRate: number;
  photo2WinRate: number;
  photo1VsOthers: { wins: number; total: number; winRate: number };
  photo2VsOthers: { wins: number; total: number; winRate: number };
  headToHeadAllTime: { photo1Wins: number; photo2Wins: number; totalVotes: number };
}

export function PairsManagement() {
  const [selectedPhoto1, setSelectedPhoto1] = useState<string>("");
  const [selectedPhoto2, setSelectedPhoto2] = useState<string>("");
  const [description, setDescription] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [showFrequencyDialog, setShowFrequencyDialog] = useState(false);
  const [selectedPairId, setSelectedPairId] = useState<string>("");
  const [minInterval, setMinInterval] = useState(10);
  const [maxInterval, setMaxInterval] = useState(15);
  const [minIntervalInput, setMinIntervalInput] = useState("10");
  const [maxIntervalInput, setMaxIntervalInput] = useState("15");
  const [showOverviewDialog, setShowOverviewDialog] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch settings for frequency configuration
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
  });

  // Sync input states with loaded settings
  useEffect(() => {
    if (settings) {
      const minValue = settings.pairsMinInterval || 10;
      const maxValue = settings.pairsMaxInterval || 15;
      setMinInterval(minValue);
      setMaxInterval(maxValue);
      setMinIntervalInput(minValue.toString());
      setMaxIntervalInput(maxValue.toString());
    }
  }, [settings]);

  // Fetch photo performance matrix for overview
  const { data: photoPerformances = [], isLoading: performanceLoading } = useQuery<any[]>({
    queryKey: ["/api/photos/performance-matrix"],
    enabled: showOverviewDialog,
  });

  // Update frequency settings mutation
  const updateFrequencyMutation = useMutation({
    mutationFn: async (data: { pairsMinInterval: number; pairsMaxInterval: number }) => {
      const sessionId = localStorage.getItem('admin-session-id');
      if (!sessionId) {
        throw new Error('No admin session found');
      }
      
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update frequency settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setShowFrequencyDialog(false);
      toast({
        title: "Success",
        description: "Pairs frequency settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update frequency settings",
        variant: "destructive",
      });
    },
  });

  // Fetch all photos (sorted by title for easier selection)
  const { data: allPhotos = [], isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos"],
  });
  
  // Filter and sort photos for selection
  const photos = allPhotos
    .filter(photo => !photo.archived)
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  // Fetch all pairs
  const { data: pairs = [], isLoading: pairsLoading } = useQuery<PhotoPair[]>({
    queryKey: ["/api/pairs"],
    queryFn: async () => {
      const sessionId = localStorage.getItem('admin-session-id');
      if (!sessionId) {
        throw new Error('No admin session found');
      }
      
      const response = await fetch("/api/pairs", {
        headers: {
          'x-session-id': sessionId,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch pairs");
      }
      return response.json();
    },
  });

  // Fetch pair stats
  const { data: pairStats } = useQuery<PairStats>({
    queryKey: ["/api/pairs", selectedPairId, "stats"],
    enabled: !!selectedPairId && showStatsDialog,
    queryFn: async () => {
      const response = await fetch(`/api/pairs/${selectedPairId}/stats`);
      if (!response.ok) {
        throw new Error("Failed to fetch pair stats");
      }
      return response.json();
    },
  });

  // Create pair mutation
  const createPairMutation = useMutation({
    mutationFn: async (data: { photo1Id: string; photo2Id: string; description?: string }) => {
      // Get the actual session ID from localStorage
      const sessionId = localStorage.getItem('admin-session-id');
      console.log('Creating pair with sessionId:', sessionId);
      
      if (!sessionId) {
        throw new Error('No admin session found. Please refresh and log in again.');
      }
      
      const response = await fetch("/api/pairs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'x-session-id': sessionId,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Pair creation failed:', response.status, errorText);
        throw new Error(`Failed to create pair: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pairs"] });
      setShowCreateDialog(false);
      setSelectedPhoto1("");
      setSelectedPhoto2("");
      setDescription("");
      toast({
        title: "Success",
        description: "Photo pair created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create pair",
        variant: "destructive",
      });
    },
  });

  // Delete pair mutation
  const deletePairMutation = useMutation({
    mutationFn: async (pairId: string) => {
      const sessionId = localStorage.getItem('admin-session-id');
      if (!sessionId) {
        throw new Error('No admin session found');
      }
      
      const response = await fetch(`/api/pairs/${pairId}`, {
        method: "DELETE",
        headers: {
          'x-session-id': sessionId,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete pair");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pairs"] });
      toast({
        title: "Success",
        description: "Photo pair deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete pair",
        variant: "destructive",
      });
    },
  });

  // Archive photo mutation
  const archivePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const sessionId = localStorage.getItem('admin-session-id');
      if (!sessionId) {
        throw new Error('No admin session found');
      }
      
      const response = await fetch(`/api/photos/${photoId}/archive`, {
        method: "POST",
        headers: {
          'x-session-id': sessionId,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to archive photo");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pairs"] });
      toast({
        title: "Success",
        description: "Photo archived successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive photo",
        variant: "destructive",
      });
    },
  });

  const availablePhotos = photos.filter(photo => !photo.hidden && !photo.archived);
  const photo1Options = availablePhotos.filter(photo => photo.id !== selectedPhoto2);
  const photo2Options = availablePhotos.filter(photo => photo.id !== selectedPhoto1);

  const getPhotoById = (id: string) => photos.find(p => p.id === id);

  const handleCreatePair = () => {
    if (!selectedPhoto1 || !selectedPhoto2) {
      toast({
        title: "Error",
        description: "Please select both photos",
        variant: "destructive",
      });
      return;
    }

    createPairMutation.mutate({
      photo1Id: selectedPhoto1,
      photo2Id: selectedPhoto2,
      description: description || undefined,
    });
  };

  const handleDeletePair = (pairId: string) => {
    if (confirm("Are you sure you want to delete this pair? This will remove all associated voting data.")) {
      deletePairMutation.mutate(pairId);
    }
  };

  const handleArchivePhoto = (photoId: string) => {
    if (confirm("Are you sure you want to archive this photo? This may affect existing pairs.")) {
      archivePhotoMutation.mutate(photoId);
    }
  };

  const handleViewStats = (pairId: string) => {
    setSelectedPairId(pairId);
    setShowStatsDialog(true);
  };

  const handleUpdateFrequency = () => {
    if (minInterval >= maxInterval) {
      toast({
        title: "Error",
        description: "Minimum interval must be less than maximum interval",
        variant: "destructive",
      });
      return;
    }
    
    updateFrequencyMutation.mutate({
      pairsMinInterval: minInterval,
      pairsMaxInterval: maxInterval,
    });
  };

  // Initialize frequency values when settings load
  React.useEffect(() => {
    if (settings) {
      setMinInterval(settings.pairsMinInterval || 10);
      setMaxInterval(settings.pairsMaxInterval || 15);
    }
  }, [settings]);

  if (photosLoading || pairsLoading) {
    return <div className="flex justify-center p-8">Loading pairs management...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Pairs Management</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage photo pairs for direct comparison voting
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={() => setShowOverviewDialog(true)}
            disabled={performanceLoading}
            className="w-full sm:w-auto text-sm"
          >
            <Eye className="w-4 h-4 mr-2" />
            View All Matchups
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowFrequencyDialog(true)}
            className="w-full sm:w-auto text-sm"
          >
            <Activity className="w-4 h-4 mr-2" />
            Configure Frequency
          </Button>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Pair
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Photo Pair</DialogTitle>
              <DialogDescription>
                Select two photos to create a comparison pair
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="photo1">First Photo</Label>
                  <Select value={selectedPhoto1} onValueChange={setSelectedPhoto1}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select first photo" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {photo1Options.map((photo) => (
                        <SelectItem key={photo.id} value={photo.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{photo.title}</span>
                            <span className="text-xs text-gray-500">{photo.category || 'Uncategorized'}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPhoto1 && (
                    <div className="mt-2">
                      <img 
                        src={getPhotoById(selectedPhoto1)?.imageUrl} 
                        alt="Selected photo 1"
                        className="w-full h-32 object-cover rounded"
                      />
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="photo2">Second Photo</Label>
                  <Select value={selectedPhoto2} onValueChange={setSelectedPhoto2}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select second photo" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {photo2Options.map((photo) => (
                        <SelectItem key={photo.id} value={photo.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{photo.title}</span>
                            <span className="text-xs text-gray-500">{photo.category || 'Uncategorized'}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPhoto2 && (
                    <div className="mt-2">
                      <img 
                        src={getPhotoById(selectedPhoto2)?.imageUrl} 
                        alt="Selected photo 2"
                        className="w-full h-32 object-cover rounded"
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe this comparison (e.g., 'Color vs Black & White version')"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>


            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreatePair}
                disabled={createPairMutation.isPending || !selectedPhoto1 || !selectedPhoto2}
              >
                {createPairMutation.isPending ? "Creating..." : "Create Pair"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Frequency Configuration Dialog */}
        <Dialog open={showFrequencyDialog} onOpenChange={setShowFrequencyDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configure Pairs Frequency</DialogTitle>
              <DialogDescription>
                Set how often pairs appear between regular voting rounds
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="minInterval">Minimum Interval (rounds)</Label>
                <Input
                  id="minInterval"
                  type="number"
                  min="1"
                  max="50"
                  value={minIntervalInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMinIntervalInput(value);
                    const parsed = parseInt(value);
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
                      setMinInterval(parsed);
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseInt(minIntervalInput);
                    if (isNaN(parsed) || parsed < 1 || parsed > 50) {
                      setMinIntervalInput(minInterval.toString());
                    }
                  }}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum rounds between pair appearances</p>
              </div>
              <div>
                <Label htmlFor="maxInterval">Maximum Interval (rounds)</Label>
                <Input
                  id="maxInterval"
                  type="number"
                  min="1"
                  max="100"
                  value={maxIntervalInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMaxIntervalInput(value);
                    const parsed = parseInt(value);
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
                      setMaxInterval(parsed);
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseInt(maxIntervalInput);
                    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
                      setMaxIntervalInput(maxInterval.toString());
                    }
                  }}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum rounds between pair appearances</p>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFrequencyDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateFrequency}
                disabled={updateFrequencyMutation.isPending}
              >
                {updateFrequencyMutation.isPending ? "Updating..." : "Update Settings"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* All Matchups Overview Dialog */}
        <Dialog open={showOverviewDialog} onOpenChange={setShowOverviewDialog}>
          <DialogContent className="max-w-7xl w-[95vw] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">All Photo Matchups Overview</DialogTitle>
              <DialogDescription className="text-sm">
                View performance data for all photo pairs across all voting types
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {performanceLoading ? (
                <div className="text-center py-8">Loading performance data...</div>
              ) : photoPerformances.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No pairs created yet</p>
              ) : (
                <div className="space-y-6">
                  {/* Summary Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 p-4 rounded-lg">
                    <h4 className="text-lg font-semibold mb-2">Individual Photo Performance</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      How each photo performs against all opponents across all voting types
                    </p>
                  </div>

                  {/* Individual Photo Performance Cards */}
                  {photoPerformances.map((photoPerf) => (
                    <Card key={photoPerf.photoId} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
                          <img
                            src={photoPerf.photoImageUrl}
                            alt={photoPerf.photoTitle}
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded mx-auto sm:mx-0"
                          />
                          <div className="flex-1">
                            <CardTitle className="text-lg sm:text-xl mb-2 text-center sm:text-left">{photoPerf.photoTitle}</CardTitle>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded text-center">
                                <div className="font-semibold text-green-700 dark:text-green-400 text-xs">Overall Performance</div>
                                <div className="text-xs">{photoPerf.totalWins} wins / {photoPerf.totalVotes} total</div>
                                <div className="text-lg font-bold text-green-600">{photoPerf.winRate.toFixed(1)}%</div>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-center">
                                <div className="font-semibold text-blue-700 dark:text-blue-400 text-xs">Paired Opponents</div>
                                <div className="text-lg font-bold">{photoPerf.opponents.length}</div>
                              </div>
                              <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded text-center">
                                <div className="font-semibold text-purple-700 dark:text-purple-400 text-xs">Avg vs Opponents</div>
                                <div className="text-lg font-bold text-purple-600">
                                  {photoPerf.opponents.length > 0 
                                    ? (photoPerf.opponents.reduce((sum: number, opp: any) => sum + opp.winRateAgainstOpponent, 0) / photoPerf.opponents.length).toFixed(1)
                                    : '0'}%
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <h5 className="font-semibold text-gray-700 dark:text-gray-300 text-sm sm:text-base">Head-to-Head Performance:</h5>
                          <div className="space-y-2">
                            {photoPerf.opponents.map((opponent: any) => (
                              <div key={opponent.opponentId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded space-y-2 sm:space-y-0">
                                <div className="flex items-center space-x-3">
                                  <img
                                    src={opponent.opponentImageUrl}
                                    alt={opponent.opponentTitle}
                                    className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded flex-shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-sm truncate">{opponent.opponentTitle}</div>
                                    <div className="text-xs text-gray-500">vs {photoPerf.photoTitle}</div>
                                  </div>
                                </div>
                                <div className="text-left sm:text-right pl-11 sm:pl-0">
                                  <div className="font-semibold text-sm">
                                    {opponent.winsAgainstOpponent} - {opponent.lossesToOpponent}
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-600">
                                    {opponent.winRateAgainstOpponent.toFixed(1)}% ({opponent.totalMatchups} total)
                                  </div>
                                  <div className="text-xs space-y-1">
                                    {opponent.regularVotes.total > 0 && (
                                      <div className="text-gray-500">
                                        Regular: {opponent.regularVotes.wins}-{opponent.regularVotes.losses}
                                      </div>
                                    )}
                                    {opponent.directPairVotes.total > 0 && (
                                      <div className="text-blue-600">
                                        Direct: {opponent.directPairVotes.wins}-{opponent.directPairVotes.losses}
                                      </div>
                                    )}
                                    {opponent.pairIds.length > 1 && (
                                      <div className="text-purple-600 font-medium">
                                        {opponent.pairIds.length} pairs
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOverviewDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Pairs allow direct photo comparisons. Each pair shows two specific photos for head-to-head voting.
          Ensure both photos are visible and not archived before creating pairs.
          <br />
          <strong>Frequency:</strong> Pairs appear every {settings?.pairsMinInterval || 10}-{settings?.pairsMaxInterval || 15} regular voting rounds.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {pairs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">No photo pairs created yet</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Pair
              </Button>
            </CardContent>
          </Card>
        ) : (
          pairs.map((pair) => {
            const photo1 = getPhotoById(pair.photo1Id);
            const photo2 = getPhotoById(pair.photo2Id);
            
            return (
              <Card key={pair.id}>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg truncate">
                        {photo1?.title} vs {photo2?.title}
                      </CardTitle>
                      {pair.description && (
                        <CardDescription className="truncate">{pair.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewStats(pair.id)}
                        className="text-xs px-2 py-1 flex-1 sm:flex-none"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Stats
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePair(pair.id)}
                        disabled={deletePairMutation.isPending}
                        className="text-xs px-2 py-1 flex-1 sm:flex-none"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <img
                        src={photo1?.imageUrl}
                        alt={photo1?.title}
                        className="w-full h-32 sm:h-48 object-cover rounded"
                      />
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm truncate flex-1">{photo1?.title}</span>
                        {(photo1?.hidden || photo1?.archived) && (
                          <Badge variant="destructive" className="text-xs ml-2">
                            {photo1.archived ? "Archived" : "Hidden"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <img
                        src={photo2?.imageUrl}
                        alt={photo2?.title}
                        className="w-full h-32 sm:h-48 object-cover rounded"
                      />
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm truncate flex-1">{photo2?.title}</span>
                        {(photo2?.hidden || photo2?.archived) && (
                          <Badge variant="destructive" className="text-xs ml-2">
                            {photo2.archived ? "Archived" : "Hidden"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-xs sm:text-sm text-muted-foreground">
                    <span>Created: {new Date(pair.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Stats Dialog */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pair Voting Statistics</DialogTitle>
          </DialogHeader>
          {pairStats && selectedPairId && (
            <div className="space-y-4">
              {(() => {
                const pair = pairs.find(p => p.id === selectedPairId);
                const photo1 = getPhotoById(pair?.photo1Id || "");
                const photo2 = getPhotoById(pair?.photo2Id || "");
                const total = pairStats.totalVotes;
                const photo1Rate = total > 0 ? (pairStats.photo1Wins / total * 100).toFixed(1) : 0;
                const photo2Rate = total > 0 ? (pairStats.photo2Wins / total * 100).toFixed(1) : 0;
                
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {pairStats.photo1Wins}
                            </div>
                            <div className="text-sm text-muted-foreground">wins</div>
                            <div className="text-lg font-semibold">{photo1Rate}%</div>
                            <div className="text-sm">{photo1?.title}</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {pairStats.photo2Wins}
                            </div>
                            <div className="text-sm text-muted-foreground">wins</div>
                            <div className="text-lg font-semibold">{photo2Rate}%</div>
                            <div className="text-sm">{photo2?.title}</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    {/* Head-to-Head All Time Statistics */}
                    <div className="text-center mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                        All-Time Head-to-Head Record
                      </h4>
                      <div className="text-lg font-semibold">
                        Total Historic Votes: {pairStats.headToHeadAllTime.totalVotes}
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {pairStats.headToHeadAllTime.photo1Wins}
                          </div>
                          <div className="text-sm text-gray-600">{photo1?.title} wins</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {pairStats.headToHeadAllTime.photo2Wins}
                          </div>
                          <div className="text-sm text-gray-600">{photo2?.title} wins</div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Includes all votes between these photos from regular voting and pair comparisons
                      </p>
                    </div>

                    <div className="text-center mb-4">
                      <div className="text-lg font-semibold">
                        Direct Pair Votes: {pairStats.totalVotes}
                      </div>
                    </div>
                    
                    {/* Detailed match breakdown */}
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">Performance vs All Opponents</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h5 className="font-medium text-green-600">{photo1?.title}</h5>
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span>In this pair:</span>
                              <span>{pairStats.photo1Wins}/{pairStats.totalVotes} ({photo1Rate}%)</span>
                            </div>
                            {pairStats.photo1VsOthers && (
                              <div className="flex justify-between">
                                <span>vs All photos:</span>
                                <span>{pairStats.photo1VsOthers.wins}/{pairStats.photo1VsOthers.total} ({pairStats.photo1VsOthers.winRate.toFixed(1)}%)</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h5 className="font-medium text-blue-600">{photo2?.title}</h5>
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span>In this pair:</span>
                              <span>{pairStats.photo2Wins}/{pairStats.totalVotes} ({photo2Rate}%)</span>
                            </div>
                            {pairStats.photo2VsOthers && (
                              <div className="flex justify-between">
                                <span>vs All photos:</span>
                                <span>{pairStats.photo2VsOthers.wins}/{pairStats.photo2VsOthers.total} ({pairStats.photo2VsOthers.winRate.toFixed(1)}%)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowStatsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}