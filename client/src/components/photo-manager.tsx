import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Photo, InsertPhoto, Collection } from "@shared/schema";
import { Plus, Trash2, ExternalLink, Upload, Link2, Eye, EyeOff, Edit, Globe, ArrowUpDown, Tag, CheckSquare, Square, ShoppingCart, AlertCircle, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Max file size accepted by the upload form (200 MB). */
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

/** Files larger than this go through the chunked SPE upload-session path. */
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;

/**
 * Upload `file` in chunks directly to a pre-authenticated SPE uploadUrl.
 * `onProgress` receives 0–100 as each chunk is acknowledged.
 */
async function uploadChunksToSpe(
  uploadUrl: string,
  file: File,
  chunkSize: number,
  onProgress: (pct: number) => void
): Promise<void> {
  const totalSize = file.size;

  for (let start = 0; start < totalSize; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, totalSize - 1);
    const chunk = file.slice(start, end + 1);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Length", chunk.size.toString());
      xhr.setRequestHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      xhr.setRequestHeader("Content-Type", file.type || "image/jpeg");

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = ((start + ev.loaded) / totalSize) * 90; // 0–90% for upload phase
          onProgress(Math.round(pct));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 202 || xhr.status === 200 || xhr.status === 201) {
          const pct = ((end + 1) / totalSize) * 90;
          onProgress(Math.round(pct));
          resolve();
        } else {
          reject(new Error(`Chunk upload failed (HTTP ${xhr.status}): ${xhr.responseText}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during chunk upload"));
      xhr.send(chunk);
    });
  }
}

export default function PhotoManager() {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [convertingPhoto, setConvertingPhoto] = useState<Photo | null>(null);
  const [uploadMethod, setUploadMethod] = useState<"url" | "file">("url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"uploading" | "processing" | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "votes" | "created">("name");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [bulkCollectionId, setBulkCollectionId] = useState<string>("none");
  const [confirmSaleAction, setConfirmSaleAction] = useState<{ open: boolean; action: 'forSale' | 'notForSale' | null }>({ open: false, action: null });
  const [saleStatusFilter, setSaleStatusFilter] = useState<"all" | "forSale" | "notForSale">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<InsertPhoto & { neverForSale?: boolean }>({
    title: "",
    description: "",
    imageUrl: "",
    customPurchaseUrl: "",
    category: "",
    collectionId: null,
    neverForSale: true, // Default to not for sale
  });

  const { data: collections } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
  });

  const { data: photos, isLoading, error } = useQuery<Photo[]>({
    queryKey: ["/api/photos"],
    enabled: true,
    queryFn: async () => {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await fetch("/api/photos", {
        headers: {
          'x-admin-request': 'true',
          ...(sessionId ? { 'x-session-id': sessionId } : {})
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  // Log any errors for debugging
  if (error) {
    console.error('Photo query error:', error);
  }

  const addPhotoMutation = useMutation({
    mutationFn: async (data: InsertPhoto) => {
      console.log('Adding photo with data:', data);
      try {
        const sessionId = localStorage.getItem('admin-session-id');
        const response = await apiRequest("POST", "/api/photos", data, sessionId ? { 'x-session-id': sessionId } : undefined);
        
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
        const sessionId = localStorage.getItem('admin-session-id');
        const response = await apiRequest("PUT", `/api/photos/${photoId}`, data, sessionId ? { 'x-session-id': sessionId } : undefined);
        
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
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("DELETE", `/api/photos/${photoId}`, undefined, sessionId ? { 'x-session-id': sessionId } : undefined);
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
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("PUT", `/api/photos/${photoId}/visibility`, { hidden }, sessionId ? { 'x-session-id': sessionId } : undefined);
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

  const bulkUpdateCategoryMutation = useMutation({
    mutationFn: async ({ photoIds, category }: { photoIds: string[]; category: string }) => {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("PUT", "/api/photos/bulk-category", { photoIds, category }, sessionId ? { 'x-session-id': sessionId } : undefined);
      if (!response.ok) {
        throw new Error("Failed to update photo categories");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      setSelectedPhotos(new Set());
      setShowBulkActions(false);
      setBulkCategory("");
      toast({
        title: "Categories updated",
        description: "Selected photos have been assigned to the new category.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to update categories",
        description: "Could not update photo categories. Please try again.",
        variant: "destructive",
      });
    },
  });

  const bulkUpdateCollectionMutation = useMutation({
    mutationFn: async ({ photoIds, collectionId }: { photoIds: string[]; collectionId: string | null }) => {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("PUT", "/api/photos/bulk-collection", { photoIds, collectionId }, sessionId ? { 'x-session-id': sessionId } : undefined);
      if (!response.ok) throw new Error("Failed to update photo collections");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      setSelectedPhotos(new Set());
      setBulkCollectionId("none");
      toast({ title: "Collections updated", description: "Selected photos have been assigned to the collection." });
    },
    onError: () => {
      toast({ title: "Failed to update collections", variant: "destructive" });
    },
  });

  const bulkUpdateSaleMutation = useMutation({
    mutationFn: async ({ photoIds, neverForSale }: { photoIds: string[]; neverForSale: boolean }) => {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("PUT", "/api/photos/bulk-sale", { photoIds, neverForSale }, sessionId ? { 'x-session-id': sessionId } : undefined);
      if (!response.ok) {
        throw new Error("Failed to update photo sale status");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      setSelectedPhotos(new Set());
      setShowBulkActions(false);
      setConfirmSaleAction({ open: false, action: null });
      toast({
        title: "Sale status updated",
        description: `${selectedPhotos.size} photo${selectedPhotos.size > 1 ? 's have' : ' has'} been marked as ${variables.neverForSale ? 'not for sale' : 'available for sale'}.`,
      });
    },
    onError: () => {
      setConfirmSaleAction({ open: false, action: null });
      toast({
        title: "Failed to update sale status",
        description: "Could not update photo sale status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaleStatusConfirm = () => {
    if (confirmSaleAction.action === 'forSale') {
      bulkUpdateSaleMutation.mutate({ 
        photoIds: Array.from(selectedPhotos), 
        neverForSale: false 
      });
    } else if (confirmSaleAction.action === 'notForSale') {
      bulkUpdateSaleMutation.mutate({ 
        photoIds: Array.from(selectedPhotos), 
        neverForSale: true 
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      imageUrl: "",
      customPurchaseUrl: "",
      category: "",
      collectionId: null,
      neverForSale: true,
    });
    setShowAddForm(false);
    setEditingPhoto(null);
    setConvertingPhoto(null);
    setSelectedFile(null);
    setPreviewUrl("");
    setUploadProgress(null);
    setUploadPhase(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    const newSelection = new Set(selectedPhotos);
    if (newSelection.has(photoId)) {
      newSelection.delete(photoId);
    } else {
      newSelection.add(photoId);
    }
    setSelectedPhotos(newSelection);
    setShowBulkActions(newSelection.size > 0);
    console.log('Photo selection toggled:', photoId, 'Total selected:', newSelection.size);
  };

  const selectAllPhotos = () => {
    if (photos) {
      const allPhotoIds = new Set(photos.map(p => p.id));
      setSelectedPhotos(allPhotoIds);
      setShowBulkActions(true);
    }
  };

  const clearSelection = () => {
    setSelectedPhotos(new Set());
    setShowBulkActions(false);
    setBulkCategory("");
  };

  const handleBulkCategoryUpdate = () => {
    if (selectedPhotos.size === 0 || !bulkCategory.trim()) {
      toast({
        title: "Invalid selection",
        description: "Please select photos and enter a category name.",
        variant: "destructive",
      });
      return;
    }

    bulkUpdateCategoryMutation.mutate({
      photoIds: Array.from(selectedPhotos),
      category: bulkCategory.trim(),
    });
  };

  const startEdit = (photo: Photo) => {
    setEditingPhoto(photo);
    setFormData({
      title: photo.title,
      description: photo.description || "",
      imageUrl: photo.imageUrl.startsWith('data:') ? "" : photo.imageUrl,
      customPurchaseUrl: photo.customPurchaseUrl || "",
      category: photo.category || "",
      collectionId: photo.collectionId || null,
      neverForSale: photo.neverForSale || false,
    });
    setShowAddForm(false);
  };

  const startConvertToUrl = (photo: Photo) => {
    setConvertingPhoto(photo);
    setFormData({
      title: photo.title,
      description: photo.description || "",
      imageUrl: "",
      customPurchaseUrl: photo.customPurchaseUrl || "",
      category: photo.category || "",
      collectionId: photo.collectionId || null,
      neverForSale: photo.neverForSale || false,
    });
    setEditingPhoto(null);
    setShowAddForm(false);
  };

  /** Returns the proxy URL for a photo at a given size */
  const photoImageUrl = (id: string, size: "thumb" | "mid" | "full" = "mid") =>
    `/api/photos/${id}/image?size=${size}`;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: "File too large",
          description: `Please select an image smaller than ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
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
      // Edit mode - preserve original imageUrl if it's base64 and no new URL provided
      const updateData = {
        ...formData,
        imageUrl: editingPhoto.imageUrl.startsWith('data:') && !formData.imageUrl 
          ? editingPhoto.imageUrl 
          : formData.imageUrl
      };
      
      editPhotoMutation.mutate({
        photoId: editingPhoto.id,
        data: updateData,
      });
      return;
    }

    if (convertingPhoto) {
      // Convert mode - replace base64 with URL
      if (!formData.imageUrl.trim()) {
        toast({
          title: "Missing URL",
          description: "Please provide a URL to replace the uploaded image.",
          variant: "destructive",
        });
        return;
      }

      editPhotoMutation.mutate({
        photoId: convertingPhoto.id,
        data: formData,
      });
      return;
    }

    // Add mode
    if (uploadMethod === "file" && selectedFile) {
      const sessionId = localStorage.getItem('admin-session-id');
      const token = localStorage.getItem('auth-token');
      const authHeaders: Record<string, string> = {};
      if (sessionId) authHeaders['x-session-id'] = sessionId;
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;

      try {
        if (selectedFile.size > LARGE_FILE_THRESHOLD) {
          // ── Chunked upload-session path (large files) ──
          // Step 1: Create pending DB record + SPE upload session URL
          setUploadPhase("uploading");
          setUploadProgress(0);

          const sessionRes = await fetch("/api/photos/upload-session", {
            method: "POST",
            headers: { ...authHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({
              title: formData.title.trim(),
              description: formData.description || "",
              collectionId: formData.collectionId || null,
              category: formData.category || "",
              neverForSale: formData.neverForSale ?? true,
              customPurchaseUrl: formData.customPurchaseUrl || "",
            }),
          });

          if (!sessionRes.ok) {
            const err = await sessionRes.json();
            throw new Error(err.message || "Failed to create upload session");
          }

          const { uploadUrl, photoId, chunkSize } = await sessionRes.json();

          // Step 2: Upload chunks directly to SPE (no server round-trip per chunk)
          await uploadChunksToSpe(uploadUrl, selectedFile, chunkSize, (pct) => {
            setUploadProgress(pct);
          });

          // Step 3: Finalize — server downloads original, generates variants
          setUploadPhase("processing");
          setUploadProgress(95);

          const finalizeRes = await fetch(`/api/photos/${photoId}/finalize`, {
            method: "POST",
            headers: authHeaders,
          });

          if (!finalizeRes.ok) {
            const err = await finalizeRes.json();
            throw new Error(err.message || "Finalize failed");
          }

          const result = await finalizeRes.json();
          queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
          resetForm();
          toast({ title: "Photo uploaded to SharePoint", description: result.title });
        } else {
          // ── Small-file path: single multipart POST (unchanged) ──
          setUploadPhase("uploading");
          setUploadProgress(0);

          const fd = new FormData();
          fd.append("file", selectedFile);
          fd.append("title", formData.title.trim());
          if (formData.description) fd.append("description", formData.description);
          if (formData.collectionId) fd.append("collectionId", formData.collectionId);
          if (formData.category) fd.append("category", formData.category);
          fd.append("neverForSale", String(formData.neverForSale ?? true));
          if (formData.customPurchaseUrl) fd.append("customPurchaseUrl", formData.customPurchaseUrl);

          const xhr = new XMLHttpRequest();
          const result = await new Promise<any>((resolve, reject) => {
            xhr.open("POST", "/api/photos", true);
            Object.entries(authHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 90));
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
              } else {
                try { reject(new Error(JSON.parse(xhr.responseText).message || "Upload failed")); }
                catch { reject(new Error(`Upload failed (HTTP ${xhr.status})`)); }
              }
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(fd);
          });

          queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
          resetForm();
          toast({ title: "Photo uploaded to SharePoint", description: result.title });
        }
      } catch (error) {
        setUploadProgress(null);
        setUploadPhase(null);
        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Could not upload file.",
          variant: "destructive",
        });
      }
      return;
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
      imageUrl: formData.imageUrl,
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
                      JPG, PNG, WebP or other image file — up to {MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.
                      Files over 5 MB are uploaded in chunks directly to SharePoint.
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
                      {selectedFile && selectedFile.size > LARGE_FILE_THRESHOLD && (
                        <p className="text-xs text-blue-600 font-medium">
                          Large file ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB) — will use chunked upload
                        </p>
                      )}
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

              <div className="space-y-2">
                <Label htmlFor="collection">Collection (Portfolio / Store)</Label>
                <Select
                  value={formData.collectionId || "none"}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, collectionId: v === "none" ? null : v }))}
                >
                  <SelectTrigger id="collection"><SelectValue placeholder="No collection" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No collection</SelectItem>
                    {(collections || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-sm text-gray-500">Controls where this photo appears in the Portfolio and Store.</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Voting category</Label>
                <Input
                  id="category"
                  placeholder="e.g., Seascapes, Landscapes (optional)"
                  value={formData.category || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                />
                <div className="text-sm text-gray-500">
                  Used for leaderboard grouping in the voting/pairs system.
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="neverForSale"
                    checked={formData.neverForSale || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, neverForSale: checked as boolean }))}
                  />
                  <Label htmlFor="neverForSale" className="text-sm font-medium">
                    Never for sale
                  </Label>
                </div>
                <p className="text-sm text-gray-500">
                  If checked, this photo will never show purchase links regardless of global settings
                </p>
              </div>

              {/* Upload progress bar (shown for file uploads > 5 MB) */}
              {uploadPhase !== null && uploadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>
                      {uploadPhase === "uploading"
                        ? "Uploading to SharePoint…"
                        : "Generating size variants…"}
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  className="bg-green-700 hover:bg-green-800"
                  disabled={addPhotoMutation.isPending || uploadPhase !== null}
                >
                  {uploadPhase === "uploading"
                    ? "Uploading…"
                    : uploadPhase === "processing"
                    ? "Processing…"
                    : addPhotoMutation.isPending
                    ? "Adding..."
                    : "Add Photo"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={resetForm}
                  disabled={uploadPhase !== null}
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
          {/* Sorting and Bulk Action Controls */}
          {photos && photos.length > 0 && (
            <div className="space-y-4 mb-4 pb-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    <span className="text-sm font-medium">Sort by:</span>
                    <Select value={sortBy} onValueChange={(value: "name" | "votes" | "created") => setSortBy(value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                        <SelectItem value="votes">Total Votes</SelectItem>
                        <SelectItem value="created">Date Added</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Sale:</span>
                    <Select value={saleStatusFilter} onValueChange={(value: "all" | "forSale" | "notForSale") => setSaleStatusFilter(value)}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Photos</SelectItem>
                        <SelectItem value="forSale">For Sale</SelectItem>
                        <SelectItem value="notForSale">Not For Sale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Collection:</span>
                    <Select value={collectionFilter} onValueChange={setCollectionFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {(collections || []).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600">
                    {photos.filter(p => {
                      if (saleStatusFilter === "forSale") return !p.neverForSale;
                      if (saleStatusFilter === "notForSale") return p.neverForSale;
                      return true;
                    }).filter(p => {
                      if (collectionFilter === "none") return !p.collectionId;
                      if (collectionFilter !== "all") return p.collectionId === collectionFilter;
                      return true;
                    }).length} photos {(saleStatusFilter !== "all" || collectionFilter !== "all") && "shown"}
                  </div>
                  {selectedPhotos.size > 0 && (
                    <div className="text-sm text-blue-600 font-medium">
                      {selectedPhotos.size} selected
                    </div>
                  )}
                </div>
              </div>

              {/* Bulk Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectedPhotos.size === photos.length ? clearSelection : selectAllPhotos}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {selectedPhotos.size === photos.length ? (
                    <>
                      <Square className="w-4 h-4 mr-1" />
                      Clear All
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4 mr-1" />
                      Select All
                    </>
                  )}
                </Button>
                
                {selectedPhotos.size > 0 && (
                  <>
                    {/* Bulk Category */}
                    <Tag className="w-4 h-4 text-blue-600 ml-4" />
                    <span className="text-sm font-medium">Category:</span>
                    <Input
                      type="text"
                      placeholder="Enter category name"
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      className="w-36 h-8"
                    />
                    <Button
                      size="sm"
                      onClick={handleBulkCategoryUpdate}
                      disabled={bulkUpdateCategoryMutation.isPending || !bulkCategory.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {bulkUpdateCategoryMutation.isPending ? "Updating…" : "Apply"}
                    </Button>

                    {/* Bulk Collection */}
                    <span className="text-sm font-medium ml-3">Collection:</span>
                    <Select value={bulkCollectionId} onValueChange={setBulkCollectionId}>
                      <SelectTrigger className="w-40 h-8">
                        <SelectValue placeholder="Pick collection…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (remove)</SelectItem>
                        {(collections || []).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (selectedPhotos.size === 0) return;
                        bulkUpdateCollectionMutation.mutate({
                          photoIds: Array.from(selectedPhotos),
                          collectionId: bulkCollectionId === "none" ? null : bulkCollectionId,
                        });
                      }}
                      disabled={bulkUpdateCollectionMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {bulkUpdateCollectionMutation.isPending ? "Updating…" : "Apply"}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
              
              
              {/* Bulk Sale Status - Directly below bulk actions */}
              {selectedPhotos.size > 0 ? (
                <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#d1fae5', borderRadius: '8px', border: '2px solid #10b981' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <strong>Sale Status ({selectedPhotos.size} selected):</strong>
                    <button
                      onClick={() => setConfirmSaleAction({ open: true, action: 'forSale' })}
                      style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                    >
                      Mark for Sale
                    </button>
                    <button
                      onClick={() => setConfirmSaleAction({ open: true, action: 'notForSale' })}
                      style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                    >
                      Mark Not for Sale
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">Loading photos...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              Error loading photos: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : photos && photos.length > 0 ? (
            <div className="grid gap-4">
              {[...photos]
                .filter(photo => {
                  if (saleStatusFilter === "forSale") return !photo.neverForSale;
                  if (saleStatusFilter === "notForSale") return photo.neverForSale;
                  return true;
                })
                .filter(photo => {
                  if (collectionFilter === "none") return !photo.collectionId;
                  if (collectionFilter !== "all") return photo.collectionId === collectionFilter;
                  return true;
                })
                .sort((a, b) => {
                  if (sortBy === "name") {
                    return a.title.localeCompare(b.title);
                  } else if (sortBy === "votes") {
                    return b.votes - a.votes; // Higher votes first
                  } else { // created
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Newest first
                  }
                })
                .map((photo) => (
                <div key={photo.id} className="space-y-4">
                  {/* Photo display row */}
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <Checkbox
                      checked={selectedPhotos.has(photo.id)}
                      onCheckedChange={() => togglePhotoSelection(photo.id)}
                      className="flex-shrink-0"
                    />
                    <img 
                      src={photoImageUrl(photo.id, "thumb")} 
                      alt={photo.title}
                      className="w-20 h-14 object-cover rounded bg-gray-100"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA4MCA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjU2IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAyOEwzNiAyMEw0NCAyOEw0MCAzMkgzMlYzNkwyOCAzMloiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2Zz4K';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{photo.title}</h4>
                        {photo.hidden && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            Hidden
                          </span>
                        )}
                        {photo.neverForSale && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                            Never for Sale
                          </span>
                        )}
                      </div>
                      {photo.description && (
                        <p className="text-sm text-gray-600 truncate max-w-lg">{photo.description}</p>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Votes: {photo.votes} | Win Rate: {photo.comparisons > 0 ? Math.round((photo.wins / photo.comparisons) * 100) : 0}%
                        {photo.hidden && " (Hidden from voting)"}
                      </div>
                      <div className="text-xs mt-1 flex flex-wrap gap-2">
                        {(photo as any).storageProvider === 'sharepoint_embedded' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-blue-600 bg-blue-100">
                            SharePoint
                          </span>
                        ) : photo.imageUrl.startsWith('data:') || (photo as any).storageProvider === 'base64' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-orange-600 bg-orange-100">
                            DB Stored
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-green-600 bg-green-100">
                            URL Based
                          </span>
                        )}
                        {photo.category && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-blue-700 bg-blue-100 dark:text-blue-200 dark:bg-blue-900">
                            {photo.category}
                          </span>
                        )}
                        {photo.collectionId && collections && (() => {
                          const col = collections.find(c => c.id === photo.collectionId);
                          return col ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-purple-700 bg-purple-100">
                              {col.name}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
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
                      {photo.imageUrl.startsWith('data:') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startConvertToUrl(photo)}
                          disabled={showAddForm || editingPhoto !== null || convertingPhoto !== null}
                          className="text-purple-600 hover:text-purple-800"
                          title="Convert to URL for better performance"
                        >
                          <Globe className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(photo)}
                        disabled={showAddForm || editingPhoto !== null || convertingPhoto !== null}
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
                          {/* Only show URL field if it's not a base64 image */}
                          {!editingPhoto.imageUrl.startsWith('data:') && (
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
                          )}
                          
                          {/* Show info for base64 images */}
                          {editingPhoto.imageUrl.startsWith('data:') && (
                            <div className="space-y-2">
                              <Label>Image Source</Label>
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-800">
                                  This photo was uploaded as a file and is stored directly in the database. 
                                  To change the image, you'll need to delete this photo and add a new one.
                                </p>
                              </div>
                            </div>
                          )}
                          
                          <div className="space-y-2">
                            <Label>Current Image Preview</Label>
                            <div className="border rounded-lg p-2 bg-gray-50">
                              <img 
                                src={photoImageUrl(editingPhoto.id, "mid")} 
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

                          <div className="space-y-2">
                            <Label htmlFor="editCollection">Collection (Portfolio / Store)</Label>
                            <Select
                              value={formData.collectionId || "none"}
                              onValueChange={(v) => setFormData(prev => ({ ...prev, collectionId: v === "none" ? null : v }))}
                            >
                              <SelectTrigger id="editCollection"><SelectValue placeholder="No collection" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No collection</SelectItem>
                                {(collections || []).map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="text-sm text-gray-500">Controls where this photo appears in the Portfolio and Store.</div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="editCategory">Voting category</Label>
                            <Input
                              id="editCategory"
                              placeholder="e.g., Seascapes, Landscapes (optional)"
                              value={formData.category || ""}
                              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                            />
                            <div className="text-sm text-gray-500">
                              Used for leaderboard grouping in the voting/pairs system.
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="editNeverForSale"
                                checked={formData.neverForSale || false}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, neverForSale: checked as boolean }))}
                              />
                              <Label htmlFor="editNeverForSale" className="text-sm font-medium">
                                Never for sale
                              </Label>
                            </div>
                            <p className="text-sm text-gray-500">
                              If checked, this photo will never show purchase links regardless of global settings
                            </p>
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

                  {/* Inline convert to URL form - appears below the selected photo */}
                  {convertingPhoto?.id === photo.id && (
                    <Card className="ml-6 border-l-4 border-l-purple-500">
                      <CardHeader>
                        <CardTitle className="text-lg">Convert to URL: {convertingPhoto.title}</CardTitle>
                        <p className="text-sm text-gray-600">
                          Replace this uploaded image with a URL for better database performance
                        </p>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Current Image (Database)</Label>
                            <div className="border rounded-lg p-2 bg-gray-50">
                              <img 
                                src={`/api/photos/${convertingPhoto.id}/image?size=mid`}
                                alt={convertingPhoto.title} 
                                className="max-w-full max-h-32 object-contain mx-auto rounded"
                              />
                            </div>
                            <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                              This image is currently stored as base64 data in the database, which can slow performance.
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="convertImageUrl">New Image URL *</Label>
                            <Input
                              id="convertImageUrl"
                              type="url"
                              placeholder="https://static.wixstatic.com/media/cf00bd_...png"
                              value={formData.imageUrl}
                              onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                              required
                            />
                            <p className="text-sm text-green-700">
                              Enter the URL where this image is hosted online. This will replace the database-stored image.
                            </p>
                          </div>

                          {formData.imageUrl && (
                            <div className="space-y-2">
                              <Label>Preview New URL</Label>
                              <div className="border rounded-lg p-2 bg-gray-50">
                                <img 
                                  src={formData.imageUrl} 
                                  alt="URL Preview" 
                                  className="max-w-full max-h-32 object-contain mx-auto rounded"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRkZFNkU2Ii8+CjxwYXRoIGQ9Ik01MCA3MEw0MCA1MEw2MCA1MEw1MCA3MFoiIGZpbGw9IiNGRjAwMDAiLz4KPHR5cG0+PHRzcGFuIGZpbGw9IiNGRjAwMDAiPkVycm9yIGxvYWRpbmcgaW1hZ2U8L3RzcGFuPjwvdGV4dD4KPC9zdmc+';
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="convertTitle">Title *</Label>
                            <Input
                              id="convertTitle"
                              placeholder="Enter photo title"
                              value={formData.title}
                              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="convertDescription">Description</Label>
                            <Textarea
                              id="convertDescription"
                              placeholder="Optional description of the photo"
                              value={formData.description || ""}
                              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button 
                              type="submit" 
                              className="bg-purple-700 hover:bg-purple-800"
                              disabled={editPhotoMutation.isPending || !formData.imageUrl.trim()}
                            >
                              {editPhotoMutation.isPending ? "Converting..." : "Convert to URL"}
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
              <div className="text-sm mt-2">
                Debug: isLoading={String(isLoading)}, photos length={photos?.length || 0}, hasError={String(!!error)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modal for Sale Status Changes */}
      <AlertDialog open={confirmSaleAction.open} onOpenChange={(open) => !open && setConfirmSaleAction({ open: false, action: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Confirm Sale Status Change
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to change the sale status for <strong>{selectedPhotos.size} photo{selectedPhotos.size > 1 ? 's' : ''}</strong>.
              </p>
              {confirmSaleAction.action === 'forSale' ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Mark for Sale:</strong> These photos will be available for purchase when the store is enabled. 
                    Make sure each photo has appropriate pricing or custom purchase URLs configured.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Mark Not for Sale:</strong> These photos will never show purchase links, 
                    regardless of global store settings. This action will remove them from commerce features.
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-2">
                This action can be reversed by selecting the photos again and changing their status.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmSaleAction({ open: false, action: null })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSaleStatusConfirm}
              className={confirmSaleAction.action === 'forSale' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {bulkUpdateSaleMutation.isPending ? 'Updating...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}