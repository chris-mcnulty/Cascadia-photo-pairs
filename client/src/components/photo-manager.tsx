import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Photo, InsertPhoto } from "@shared/schema";
import { Plus, Trash2, ExternalLink, Upload, Link2, Eye, EyeOff, Edit } from "lucide-react";

export default function PhotoManager() {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [uploadMethod, setUploadMethod] = useState<"url" | "file">("url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<InsertPhoto>({
    title: "",
    description: "",
    imageUrl: "",
    customPurchaseUrl: "",
  });

  const { data: photos, isLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos"],
    enabled: true,
  });

  const addPhotoMutation = useMutation({
    mutationFn: async (data: InsertPhoto) => {
      console.log('Adding photo with data:', data);
      try {
        const response = await apiRequest("POST", "/api/photos", data);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add photo');
        }
        
        const result = await response.json();
        console.log('Photo added successfully:', result);
        return result;
      } catch (error) {
        console.error('Failed to add photo:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      resetForm();
      toast({
        title: "Photo added successfully",
        description: "The photo has been added to the collection.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add photo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editPhotoMutation = useMutation({
    mutationFn: async ({ photoId, data }: { photoId: string; data: Partial<InsertPhoto> }) => {
      console.log('Updating photo with ID:', photoId, 'Data:', data);
      try {
        const response = await apiRequest("PUT", `/api/photos/${photoId}`, data);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update photo');
        }
        
        const result = await response.json();
        console.log('Photo updated successfully:', result);
        return result;
      } catch (error) {
        console.error('Failed to update photo:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      setEditingPhoto(null);
      resetForm();
      toast({
        title: "Photo updated successfully",
        description: "The photo details have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update photo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const response = await apiRequest("DELETE", `/api/photos/${photoId}`);
      if (!response.ok) {
        throw new Error("Failed to delete photo");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      toast({
        title: "Photo deleted",
        description: "The photo has been removed from the collection.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete photo",
        description: "Could not delete the photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const togglePhotoVisibilityMutation = useMutation({
    mutationFn: async ({ photoId, hidden }: { photoId: string; hidden: boolean }) => {
      const response = await apiRequest("PUT", `/api/photos/${photoId}/visibility`, { hidden });
      if (!response.ok) {
        throw new Error("Failed to update photo visibility");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      toast({
        title: "Photo visibility updated",
        description: "The photo visibility has been changed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to update visibility",
        description: "Could not update photo visibility. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      imageUrl: "",
      customPurchaseUrl: "",
    });
    setShowAddForm(false);
    setEditingPhoto(null);
    setSelectedFile(null);
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startEdit = (photo: Photo) => {
    setEditingPhoto(photo);
    setFormData({
      title: photo.title,
      description: photo.description || "",
      imageUrl: photo.imageUrl,
      customPurchaseUrl: photo.customPurchaseUrl || "",
    });
    setShowAddForm(false);
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDeletePhoto = (photoId: string, photoTitle: string) => {
    if (confirm(`Are you sure you want to delete "${photoTitle}"? This action cannot be undone.`)) {
      deletePhotoMutation.mutate(photoId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: "Missing title",
        description: "Please provide a title for the photo.",
        variant: "destructive",
      });
      return;
    }

    if (editingPhoto) {
      // Edit mode
      editPhotoMutation.mutate({
        photoId: editingPhoto.id,
        data: formData,
      });
      return;
    }

    // Add mode
    let imageUrl = formData.imageUrl;

    if (uploadMethod === "file" && selectedFile) {
      try {
        imageUrl = await convertFileToBase64(selectedFile);
      } catch (error) {
        toast({
          title: "File processing failed",
          description: "Could not process the selected file.",
          variant: "destructive",
        });
        return;
      }
    } else if (uploadMethod === "url" && !formData.imageUrl) {
      toast({
        title: "Missing image URL",
        description: "Please provide an image URL.",
        variant: "destructive",
      });
      return;
    } else if (uploadMethod === "file" && !selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select an image file to upload.",
        variant: "destructive",
      });
      return;
    }

    addPhotoMutation.mutate({
      ...formData,
      imageUrl,
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12">Loading photos...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Add Photo Button/Form */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Photo Management</CardTitle>
          {!showAddForm && !editingPhoto && (
            <Button 
              onClick={() => setShowAddForm(true)}
              className="bg-green-700 hover:bg-green-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Photo
            </Button>
          )}
        </CardHeader>
        
        {showAddForm && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Tabs value={uploadMethod} onValueChange={(value) => setUploadMethod(value as "url" | "file")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="url" className="flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    URL
                  </TabsTrigger>
                  <TabsTrigger value="file" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Upload File
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="url" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="imageUrl">Image URL *</Label>
                    <Input
                      id="imageUrl"
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                    />
                    <p className="text-sm text-gray-500">
                      Paste the direct URL to an image (JPG, PNG, WebP, etc.)
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="file" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fileUpload">Select Image File *</Label>
                    <Input
                      id="fileUpload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      ref={fileInputRef}
                      className="cursor-pointer"
                    />
                    <p className="text-sm text-gray-500">
                      Select a JPG, PNG, WebP or other image file from your computer
                    </p>
                  </div>
                  
                  {previewUrl && (
                    <div className="space-y-2">
                      <Label>Preview</Label>
                      <div className="border rounded-lg p-2 bg-gray-50">
                        <img 
                          src={previewUrl} 
                          alt="Preview" 
                          className="max-w-full max-h-48 object-contain mx-auto rounded"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter photo title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description of the photo"
                  value={formData.description || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customPurchaseUrl">Custom Purchase URL</Label>
                <Input
                  id="customPurchaseUrl"
                  type="url"
                  placeholder="https://example.com/buy-this-print (optional)"
                  value={formData.customPurchaseUrl || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, customPurchaseUrl: e.target.value }))}
                />
                <div className="text-sm text-gray-500">
                  Leave blank to use the default store URL
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  className="bg-green-700 hover:bg-green-800"
                  disabled={addPhotoMutation.isPending}
                >
                  {addPhotoMutation.isPending ? "Adding..." : "Add Photo"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Photos List */}
      <Card>
        <CardHeader>
          <CardTitle>Current Photos ({photos?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {photos && photos.length > 0 ? (
            <div className="grid gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="space-y-4">
                  {/* Photo display row */}
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <img 
                      src={photo.imageUrl} 
                      alt={photo.title}
                      className="w-20 h-14 object-cover rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{photo.title}</h4>
                        {photo.hidden && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            Hidden
                          </span>
                        )}
                      </div>
                      {photo.description && (
                        <p className="text-sm text-gray-600 truncate">{photo.description}</p>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Votes: {photo.votes} | Win Rate: {photo.comparisons > 0 ? Math.round((photo.wins / photo.comparisons) * 100) : 0}%
                        {photo.hidden && " (Hidden from voting)"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {photo.customPurchaseUrl && (
                        <a 
                          href={photo.customPurchaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(photo)}
                        disabled={showAddForm || editingPhoto !== null}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit photo details"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePhotoVisibilityMutation.mutate({ photoId: photo.id, hidden: !photo.hidden })}
                        disabled={togglePhotoVisibilityMutation.isPending}
                        className={photo.hidden ? "text-green-600 hover:text-green-800" : "text-orange-600 hover:text-orange-800"}
                        title={photo.hidden ? "Show photo in voting" : "Hide photo from voting"}
                      >
                        {photo.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePhoto(photo.id, photo.title)}
                        disabled={deletePhotoMutation.isPending}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Inline edit form - appears below the selected photo */}
                  {editingPhoto?.id === photo.id && (
                    <Card className="ml-6 border-l-4 border-l-blue-500">
                      <CardHeader>
                        <CardTitle className="text-lg">Edit Photo: {editingPhoto.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="editImageUrl">Image URL *</Label>
                            <Input
                              id="editImageUrl"
                              type="url"
                              placeholder="https://example.com/photo.jpg"
                              value={formData.imageUrl}
                              onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                            />
                            <p className="text-sm text-gray-500">
                              You can update the image URL to change the photo
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Current Image Preview</Label>
                            <div className="border rounded-lg p-2 bg-gray-50">
                              <img 
                                src={formData.imageUrl} 
                                alt={editingPhoto.title} 
                                className="max-w-full max-h-48 object-contain mx-auto rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = editingPhoto.imageUrl;
                                }}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="editTitle">Title *</Label>
                            <Input
                              id="editTitle"
                              placeholder="Enter photo title"
                              value={formData.title}
                              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="editDescription">Description</Label>
                            <Textarea
                              id="editDescription"
                              placeholder="Optional description of the photo"
                              value={formData.description || ""}
                              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="editCustomPurchaseUrl">Custom Purchase URL</Label>
                            <Input
                              id="editCustomPurchaseUrl"
                              type="url"
                              placeholder="https://example.com/buy-this-print (optional)"
                              value={formData.customPurchaseUrl || ""}
                              onChange={(e) => setFormData(prev => ({ ...prev, customPurchaseUrl: e.target.value }))}
                            />
                            <div className="text-sm text-gray-500">
                              Leave blank to use the default store URL
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button 
                              type="submit" 
                              className="bg-green-700 hover:bg-green-800"
                              disabled={editPhotoMutation.isPending}
                            >
                              {editPhotoMutation.isPending ? "Updating..." : "Update Photo"}
                            </Button>
                            <Button 
                              type="button" 
                              variant="outline"
                              onClick={resetForm}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No photos added yet. Click "Add Photo" to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}