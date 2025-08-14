import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, User, Mail, Calendar, Shield, Camera, Save, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface UserProfile {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  isAdmin: boolean;
}

export default function ProfilePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    profileImageUrl: ""
  });

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('auth-token');
    if (!token) {
      setLocation('/login');
    }
  }, [setLocation]);

  // Fetch user profile
  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const token = localStorage.getItem('auth-token');
      if (!token) throw new Error("Not authenticated");
      
      const response = await fetch("/api/auth/user", {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }
      
      return response.json();
    },
    enabled: !!localStorage.getItem('auth-token')
  });

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        username: profile.username || "",
        profileImageUrl: profile.profileImageUrl || ""
      });
    }
  }, [profile]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const token = localStorage.getItem('auth-token');
      if (!token) throw new Error("Not authenticated");
      
      const response = await apiRequest("PUT", "/api/user/profile", data);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Profile not found</div>
      </div>
    );
  }

  const initials = profile.firstName && profile.lastName
    ? `${profile.firstName[0]}${profile.lastName[0]}`
    : profile.email ? profile.email.substring(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Voting
              </Button>
            </Link>
          </div>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Your Profile
            </h1>
            <p className="text-gray-600">
              Manage your account information and preferences
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Summary */}
          <Card className="md:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <Avatar className="h-24 w-24 mb-4">
                  {profile.profileImageUrl && (
                    <AvatarImage src={profile.profileImageUrl} alt={profile.email} />
                  )}
                  <AvatarFallback className="bg-green-100 text-green-700 text-2xl font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                
                <h2 className="text-xl font-semibold text-gray-900">
                  {profile.firstName && profile.lastName 
                    ? `${profile.firstName} ${profile.lastName}`
                    : profile.username || 'User'}
                </h2>
                
                <p className="text-sm text-gray-500 mt-1">{profile.email}</p>
                
                {profile.isAdmin && (
                  <div className="mt-3 flex items-center gap-1 text-green-600">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm font-medium">Admin</span>
                  </div>
                )}
                
                <div className="mt-6 w-full space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Member since:</span>
                    <span className="font-medium">{formatDate(profile.createdAt)}</span>
                  </div>
                  {profile.lastLoginAt && (
                    <div className="flex items-center justify-between">
                      <span>Last login:</span>
                      <span className="font-medium">{formatDate(profile.lastLoginAt)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>Email verified:</span>
                    <span className={`font-medium ${profile.emailVerified ? 'text-green-600' : 'text-amber-600'}`}>
                      {profile.emailVerified ? 'Yes' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Details */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Profile Information</CardTitle>
                {!editMode ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditMode(true)}
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setEditMode(false);
                        // Reset form data
                        setFormData({
                          firstName: profile.firstName || "",
                          lastName: profile.lastName || "",
                          username: profile.username || "",
                          profileImageUrl: profile.profileImageUrl || ""
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleSubmit}
                      disabled={updateProfileMutation.isPending}
                      className="bg-green-700 hover:bg-green-800"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {updateProfileMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      disabled={!editMode}
                      placeholder="Enter first name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      disabled={!editMode}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    disabled={!editMode}
                    placeholder="Choose a username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">Email cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileImageUrl">Profile Image URL</Label>
                  <Input
                    id="profileImageUrl"
                    type="url"
                    value={formData.profileImageUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, profileImageUrl: e.target.value }))}
                    disabled={!editMode}
                    placeholder="https://example.com/avatar.jpg"
                  />
                  <p className="text-xs text-gray-500">Enter a URL for your profile picture</p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Additional Options */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/user-stats">
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View My Statistics
                </Button>
              </Link>
              <Link href="/reset-password">
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </Link>
              {!profile.emailVerified && (
                <Button variant="outline" className="w-full justify-start text-amber-600 border-amber-600 hover:bg-amber-50">
                  <Mail className="w-4 h-4 mr-2" />
                  Verify Email Address
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Tip:</strong> Use a strong, unique password and verify your email address to keep your account secure.
                </p>
              </div>
              <div className="text-sm text-gray-600">
                <p>• Password last changed: Never</p>
                <p>• Two-factor authentication: Not enabled</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}