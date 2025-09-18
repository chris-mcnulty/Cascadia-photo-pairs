import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Plus, Edit2, Trash2, ExternalLink, Newspaper, Rss } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface NewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  publishDate: string;
  expiryDate: string | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

interface NewsFormData {
  title: string;
  description: string;
  link: string;
  publishDate: Date | null;
  expiryDate: Date | null;
  priority: number;
  isActive: boolean;
}

export default function NewsManagement() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [formData, setFormData] = useState<NewsFormData>({
    title: "",
    description: "",
    link: "",
    publishDate: new Date(),
    expiryDate: null,
    priority: 0,
    isActive: true,
  });

  // RSS Configuration state
  const [rssSettings, setRSSSettings] = useState({
    newsSource: "internal",
    rssEnabled: false,
    rssUrl: "https://www.chrismcnulty.net/creative-writing?format=rss",
    rssTag: "photography",
    rssDaysLimit: 90,
    rssMaxItems: 3,
  });

  // Fetch news items
  const { data: newsItems = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ["/api/admin/news"]
    // Using default queryFn which includes auth headers automatically
  });

  // Fetch RSS settings
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    }
  });

  // Update RSS settings when settings load
  useEffect(() => {
    if (settings) {
      setRSSSettings({
        newsSource: (settings as any).newsSource || "internal",
        rssEnabled: (settings as any).rssEnabled || false,
        rssUrl: (settings as any).rssUrl || "https://www.chrismcnulty.net/creative-writing?format=rss",
        rssTag: (settings as any).rssTag || "photography",
        rssDaysLimit: (settings as any).rssDaysLimit || 90,
        rssMaxItems: (settings as any).rssMaxItems || 3,
      });
    }
  }, [settings]);

  // Create/Update news item
  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editingItem ? `/api/admin/news/${editingItem.id}` : "/api/admin/news";
      const method = editingItem ? "PUT" : "POST";
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Include proper authentication headers
      const sessionId = localStorage.getItem('admin-session-id');
      if (sessionId) {
        headers['X-Session-Id'] = sessionId;
      }
      const authToken = localStorage.getItem('auth-token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          link: formData.link,
          publishDate: formData.publishDate?.toISOString(),
          expiryDate: formData.expiryDate?.toISOString() || null,
          priority: formData.priority,
          isActive: formData.isActive,
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save news item");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: editingItem ? "News updated" : "News created",
        description: "The news item has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete news item
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers: Record<string, string> = {};
      
      // Include proper authentication headers
      const sessionId = localStorage.getItem('admin-session-id');
      if (sessionId) {
        headers['X-Session-Id'] = sessionId;
      }
      const authToken = localStorage.getItem('auth-token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(`/api/admin/news/${id}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete news item");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "News deleted",
        description: "The news item has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Save RSS settings mutation
  const saveRSSMutation = useMutation({
    mutationFn: async () => {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await apiRequest("PUT", "/api/settings", rssSettings, sessionId ? { 'x-session-id': sessionId } : undefined);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({
        title: "RSS settings updated",
        description: "Your RSS configuration has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "There was an error updating the RSS settings.",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (item?: NewsItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        description: item.description,
        link: item.link,
        publishDate: new Date(item.publishDate),
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        priority: item.priority,
        isActive: item.isActive,
      });
    } else {
      setEditingItem(null);
      setFormData({
        title: "",
        description: "",
        link: "",
        publishDate: new Date(),
        expiryDate: null,
        priority: 0,
        isActive: true,
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingItem(null);
    setFormData({
      title: "",
      description: "",
      link: "",
      publishDate: new Date(),
      expiryDate: null,
      priority: 0,
      isActive: true,
    });
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.description.trim() || !formData.link.trim()) {
      toast({
        title: "Invalid form",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.link.startsWith("http://") && !formData.link.startsWith("https://")) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL starting with http:// or https://",
        variant: "destructive",
      });
      return;
    }
    
    saveMutation.mutate();
  };

  const getStatusBadge = (item: NewsItem) => {
    const now = new Date();
    const publishDate = new Date(item.publishDate);
    const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
    
    if (!item.isActive) {
      return <Badge variant="outline" className="text-gray-600">Inactive</Badge>;
    }
    
    if (now < publishDate) {
      return <Badge variant="outline" className="text-blue-600 border-blue-600">Scheduled</Badge>;
    }
    
    if (expiryDate && now > expiryDate) {
      return <Badge variant="outline" className="text-red-600 border-red-600">Expired</Badge>;
    }
    
    return <Badge className="bg-green-100 text-green-800">Active</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">Loading news items...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* RSS Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rss className="w-5 h-5" />
            RSS Feed Configuration
          </CardTitle>
          <CardDescription>
            Configure RSS feed settings for automatic news updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* RSS Mode Toggle */}
          <div className="flex items-center justify-between p-4 border border-purple-300 bg-purple-50 rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base font-medium text-purple-900">RSS Feed Mode</Label>
              <div className="text-sm text-purple-700">
                Pull news from your blog's RSS feed instead of managing internally
              </div>
              <div className="text-xs text-purple-600 mt-1">
                Automatically shows photography posts from your creative writing blog
              </div>
            </div>
            <Switch
              checked={rssSettings.newsSource === 'rss' && rssSettings.rssEnabled}
              onCheckedChange={(checked) => 
                setRSSSettings(prev => ({ 
                  ...prev, 
                  newsSource: checked ? 'rss' : 'internal',
                  rssEnabled: checked 
                }))
              }
              className="data-[state=checked]:bg-purple-600"
            />
          </div>

          {/* RSS Configuration - Only show when RSS is enabled */}
          {rssSettings.newsSource === 'rss' && rssSettings.rssEnabled && (
            <div className="space-y-4 p-4 border border-gray-200 bg-gray-50 rounded-lg">
              <div className="text-base font-medium text-gray-900">RSS Feed Settings</div>
              
              {/* RSS URL */}
              <div className="space-y-2">
                <Label htmlFor="rssUrl" className="text-sm font-medium">RSS Feed URL</Label>
                <Input
                  id="rssUrl"
                  type="url"
                  placeholder="https://www.chrismcnulty.net/creative-writing?format=rss"
                  value={rssSettings.rssUrl}
                  onChange={(e) => 
                    setRSSSettings(prev => ({ ...prev, rssUrl: e.target.value }))
                  }
                  className="w-full"
                />
              </div>

              {/* Tag Filter */}
              <div className="space-y-2">
                <Label htmlFor="rssTag" className="text-sm font-medium">Tag Filter</Label>
                <Input
                  id="rssTag"
                  placeholder="photography"
                  value={rssSettings.rssTag}
                  onChange={(e) => 
                    setRSSSettings(prev => ({ ...prev, rssTag: e.target.value }))
                  }
                  className="w-full"
                />
                <div className="text-xs text-gray-500">
                  Only show posts tagged with this word (leave blank for all posts)
                </div>
              </div>

              {/* Days Limit and Max Items */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rssDaysLimit" className="text-sm font-medium">Days Limit</Label>
                  <Input
                    id="rssDaysLimit"
                    type="number"
                    min="1"
                    max="365"
                    value={rssSettings.rssDaysLimit}
                    onChange={(e) => 
                      setRSSSettings(prev => ({ ...prev, rssDaysLimit: parseInt(e.target.value) || 90 }))
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500">Posts from last N days</div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rssMaxItems" className="text-sm font-medium">Max Items</Label>
                  <Input
                    id="rssMaxItems"
                    type="number"
                    min="1"
                    max="10"
                    value={rssSettings.rssMaxItems}
                    onChange={(e) => 
                      setRSSSettings(prev => ({ ...prev, rssMaxItems: parseInt(e.target.value) || 3 }))
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500">Maximum posts to show</div>
                </div>
              </div>
            </div>
          )}

          {/* Save RSS Settings Button */}
          <Button 
            onClick={() => saveRSSMutation.mutate()}
            disabled={saveRSSMutation.isPending}
            className="w-full"
          >
            {saveRSSMutation.isPending ? "Saving..." : "Save RSS Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Internal News Management - Only show when not using RSS */}
      {rssSettings.newsSource === 'internal' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-gray-600" />
                  Internal News Management
                </CardTitle>
                <CardDescription>
                  Manage internal news items and announcements
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenDialog()} className="bg-green-700 hover:bg-green-800">
                <Plus className="w-4 h-4 mr-2" />
                Add News Item
              </Button>
            </div>
          </CardHeader>
        <CardContent>
          {newsItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No news items yet. Click "Add News Item" to create your first announcement.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Publish Date</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newsItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-sm text-gray-500 line-clamp-1">{item.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(item)}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(item.publishDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(item.link, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDialog(item)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit News Item" : "Add News Item"}</DialogTitle>
            <DialogDescription>
              Create a news item that will appear on the main voting page
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter news title..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the news..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link">Link URL *</Label>
              <Input
                id="link"
                type="url"
                value={formData.link}
                onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                placeholder="https://www.chrismcnulty.net/blog/..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Publish Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.publishDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.publishDate ? format(formData.publishDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.publishDate || undefined}
                      onSelect={(date) => setFormData(prev => ({ ...prev, publishDate: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Expiry Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.expiryDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.expiryDate ? format(formData.expiryDate, "PPP") : "No expiry"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.expiryDate || undefined}
                      onSelect={(date) => setFormData(prev => ({ ...prev, expiryDate: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500">Higher priority items appear first</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="active">Status</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="active" className="font-normal">Active</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-green-700 hover:bg-green-800"
            >
              {saveMutation.isPending ? "Saving..." : editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}