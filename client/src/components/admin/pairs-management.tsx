import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Eye, Archive, AlertTriangle } from "lucide-react";
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
}

export function PairsManagement() {
  const [selectedPhoto1, setSelectedPhoto1] = useState<string>("");
  const [selectedPhoto2, setSelectedPhoto2] = useState<string>("");
  const [description, setDescription] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [selectedPairId, setSelectedPairId] = useState<string>("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all photos
  const { data: photos = [], isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos"],
  });

  // Fetch all pairs
  const { data: pairs = [], isLoading: pairsLoading } = useQuery<PhotoPair[]>({
    queryKey: ["/api/pairs"],
    queryFn: async () => {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await fetch("/api/pairs", {
        headers: {
          ...(sessionId && { 'x-session-id': sessionId }),
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
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await fetch("/api/pairs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionId && { 'x-session-id': sessionId }),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create pair");
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
      const response = await fetch(`/api/pairs/${pairId}`, {
        method: "DELETE",
        headers: {
          ...(sessionId && { 'x-session-id': sessionId }),
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
      const response = await fetch(`/api/photos/${photoId}/archive`, {
        method: "POST",
        headers: {
          ...(sessionId && { 'x-session-id': sessionId }),
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

  if (photosLoading || pairsLoading) {
    return <div className="flex justify-center p-8">Loading pairs management...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Pairs Management</h2>
          <p className="text-muted-foreground">
            Create and manage photo pairs for direct comparison voting
          </p>
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
                    <SelectContent>
                      {photo1Options.map((photo) => (
                        <SelectItem key={photo.id} value={photo.id}>
                          {photo.title}
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
                    <SelectContent>
                      {photo2Options.map((photo) => (
                        <SelectItem key={photo.id} value={photo.id}>
                          {photo.title}
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
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Pairs allow direct photo comparisons. Each pair shows two specific photos for head-to-head voting.
          Ensure both photos are visible and not archived before creating pairs.
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
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {photo1?.title} vs {photo2?.title}
                      </CardTitle>
                      {pair.description && (
                        <CardDescription>{pair.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewStats(pair.id)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Stats
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePair(pair.id)}
                        disabled={deletePairMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <img
                        src={photo1?.imageUrl}
                        alt={photo1?.title}
                        className="w-full h-48 object-cover rounded"
                      />
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{photo1?.title}</span>
                        {(photo1?.hidden || photo1?.archived) && (
                          <Badge variant="destructive">
                            {photo1.archived ? "Archived" : "Hidden"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <img
                        src={photo2?.imageUrl}
                        alt={photo2?.title}
                        className="w-full h-48 object-cover rounded"
                      />
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{photo2?.title}</span>
                        {(photo2?.hidden || photo2?.archived) && (
                          <Badge variant="destructive">
                            {photo2.archived ? "Archived" : "Hidden"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">
                    Created: {new Date(pair.createdAt).toLocaleDateString()}
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
                    <div className="text-center">
                      <div className="text-lg font-semibold">
                        Total Votes: {pairStats.totalVotes}
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