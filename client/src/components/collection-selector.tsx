import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Palette, Folder } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Collection, InsertCollection } from "@shared/schema";

interface CollectionSelectorProps {
  selectedCollectionId?: string | null;
  onCollectionSelect: (collectionId: string | null) => void;
  showManagement?: boolean;
}

export default function CollectionSelector({ 
  selectedCollectionId, 
  onCollectionSelect, 
  showManagement = false 
}: CollectionSelectorProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<InsertCollection>({
    name: "",
    description: "",
    color: "#3B82F6",
  });

  const { data: collections, isLoading } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
    enabled: showManagement,
  });

  const createCollectionMutation = useMutation({
    mutationFn: async (data: InsertCollection) => {
      return apiRequest("POST", "/api/collections", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      setShowAddForm(false);
      setFormData({ name: "", description: "", color: "#3B82F6" });
      toast({
        title: "Collection created",
        description: "Your new photo collection has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to create collection",
        description: "Could not create the collection. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Missing name",
        description: "Please provide a name for the collection.",
        variant: "destructive",
      });
      return;
    }
    createCollectionMutation.mutate(formData);
  };

  if (!showManagement) {
    // Simple collection filter for voting interface
    return (
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCollectionId === null ? "default" : "outline"}
            size="sm"
            onClick={() => onCollectionSelect(null)}
            className="flex items-center gap-2"
          >
            <Folder className="w-4 h-4" />
            All Photos
          </Button>
          {collections?.map((collection) => (
            <Button
              key={collection.id}
              variant={selectedCollectionId === collection.id ? "default" : "outline"}
              size="sm"
              onClick={() => onCollectionSelect(collection.id)}
              className="flex items-center gap-2"
              style={{ 
                backgroundColor: selectedCollectionId === collection.id ? collection.color : undefined,
                borderColor: collection.color 
              }}
            >
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: collection.color }}
              />
              {collection.name}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Full management interface for admin
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Photo Collections
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">Loading collections...</div>
        ) : (
          <>
            {collections && collections.length > 0 ? (
              <div className="space-y-3">
                {collections.map((collection) => (
                  <div key={collection.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: collection.color }}
                      />
                      <div>
                        <h4 className="font-medium">{collection.name}</h4>
                        {collection.description && (
                          <p className="text-sm text-gray-600">{collection.description}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {/* Photo count would go here */}
                      Collection
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No collections yet. Create your first collection to organize your photos.
              </div>
            )}

            {showAddForm ? (
              <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <div className="space-y-2">
                  <Label htmlFor="collectionName">Collection Name *</Label>
                  <Input
                    id="collectionName"
                    placeholder="e.g., Landscapes, Portraits, Abstract"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collectionDescription">Description</Label>
                  <Input
                    id="collectionDescription"
                    placeholder="Optional description of this collection"
                    value={formData.description || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collectionColor">Color Theme</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="collectionColor"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      className="w-12 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      placeholder="#3B82F6"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={createCollectionMutation.isPending}
                  >
                    {createCollectionMutation.isPending ? "Creating..." : "Create Collection"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setFormData({ name: "", description: "", color: "#3B82F6" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button onClick={() => setShowAddForm(true)} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add New Collection
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}