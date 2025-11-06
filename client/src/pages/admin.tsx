import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminSettings from "@/components/admin-settings";
import PhotoManager from "@/components/photo-manager";
import AdminLogin from "@/components/admin-login";
import AdminAnalytics from "@/components/admin-analytics";
import UserManagement from "@/components/admin/user-management";
import ContestSettings from "@/components/admin/contest-settings";
import ContestReport from "@/components/admin/contest-report";
import AnnouncementSettings from "@/components/admin/announcement-settings";
import NewsManagement from "@/components/admin/news-management";
import { PairsManagement } from "@/components/admin/pairs-management";
import { ArrowLeft, BarChart3, Settings, Download, ImageIcon, LogOut, Users, Trophy, Bell, MessageSquare, Link2 } from "lucide-react";
import { Link } from "wouter";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import cascadiaLogoPath from "@assets/Cascadia-TP-Small_1754529731679.png";

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"analytics" | "photos" | "pairs" | "users" | "communication" | "settings">("analytics");
  const { logout, isAuthenticated, sessionId } = useAuth();

  const { data: stats } = useQuery<{
    totalVotes: number;
    uniqueVoters: number;
    avgVotesPerUser: number;
    topPhotos: any[];
  }>({
    queryKey: ["/api/stats"],
    enabled: false, // Always disabled - this was causing the console errors
  });

  const handleExportData = async () => {
    try {
      const sessionId = localStorage.getItem('admin-session-id');
      const response = await fetch("/api/export", {
        headers: sessionId ? { 'x-session-id': sessionId } : {},
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cascadia-oceanic-voting-data.json";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to export data:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <a 
                href="https://www.chrismcnulty.net" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                <img 
                  src={cascadiaLogoPath} 
                  alt="Cascadia Oceanic" 
                  className="h-10 w-10 object-contain"
                />
              </a>
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              {sessionId && (
                <span className="text-sm text-gray-600">
                  Logged in as: {sessionId === 'chris-master-admin-121365' ? 'Chris McNulty (Master Admin)' : 'Admin'}
                </span>
              )}
              <Button onClick={handleExportData} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
              <Button onClick={logout} variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Summary Cards */}
        {stats && (
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-700">{stats.totalVotes}</div>
                <div className="text-sm text-gray-600">Total Votes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-700">{stats.uniqueVoters}</div>
                <div className="text-sm text-gray-600">Unique Voters</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-700">{stats.avgVotesPerUser}</div>
                <div className="text-sm text-gray-600">Avg Votes/User</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs - Reorganized into logical groups with responsive design */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            variant={activeTab === "analytics" ? "default" : "outline"}
            onClick={() => setActiveTab("analytics")}
            className="flex items-center text-sm"
            size="sm"
          >
            <BarChart3 className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Analytics</span>
            <span className="sm:hidden">Data</span>
          </Button>
          <Button
            variant={activeTab === "photos" ? "default" : "outline"}
            onClick={() => setActiveTab("photos")}
            className="flex items-center text-sm"
            size="sm"
          >
            <ImageIcon className="w-4 h-4 mr-1 sm:mr-2" />
            Photos
          </Button>
          <Button
            variant={activeTab === "pairs" ? "default" : "outline"}
            onClick={() => setActiveTab("pairs")}
            className="flex items-center text-sm"
            size="sm"
          >
            <Link2 className="w-4 h-4 mr-1 sm:mr-2" />
            Pairs
          </Button>
          <Button
            variant={activeTab === "users" ? "default" : "outline"}
            onClick={() => setActiveTab("users")}
            className="flex items-center text-sm"
            size="sm"
          >
            <Users className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">User Management</span>
            <span className="sm:hidden">Users</span>
          </Button>
          <Button
            variant={activeTab === "communication" ? "default" : "outline"}
            onClick={() => setActiveTab("communication")}
            className="flex items-center text-sm"
            size="sm"
          >
            <MessageSquare className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Communication</span>
            <span className="sm:hidden">Comm</span>
          </Button>
          <Button
            variant={activeTab === "settings" ? "default" : "outline"}
            onClick={() => setActiveTab("settings")}
            className="flex items-center text-sm"
            size="sm"
          >
            <Settings className="w-4 h-4 mr-1 sm:mr-2" />
            Settings
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "analytics" && <AdminAnalytics />}
        {activeTab === "photos" && <PhotoManager />}
        {activeTab === "pairs" && <PairsManagement />}
        {activeTab === "users" && <UserManagement />}
        {activeTab === "communication" && (
          <div className="space-y-6">
            <ContestReport />
            <ContestSettings />
            <AnnouncementSettings />
            <NewsManagement />
          </div>
        )}
        {activeTab === "settings" && <AdminSettings />}
      </div>
    </div>
  );
}

function AuthenticatedAdmin() {
  const { isAuthenticated, sessionId, login } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const headers: Record<string, string> = {};
        
        // Check for JWT token first (regular user login)
        const authToken = localStorage.getItem('auth-token');
        console.log('[Admin Auth] Auth token present:', !!authToken);
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
          console.log('[Admin Auth] Added Authorization header');
        }
        
        // Also check for admin session ID
        console.log('[Admin Auth] Session ID present:', !!sessionId);
        if (sessionId) {
          headers['x-session-id'] = sessionId;
          console.log('[Admin Auth] Added session ID header');
        }
        
        // If no authentication credentials at all, show login
        if (!authToken && !sessionId) {
          console.log('[Admin Auth] No credentials found, showing login');
          setIsAdmin(false);
          setCheckingAuth(false);
          return;
        }
        
        console.log('[Admin Auth] Making admin-status request with headers:', Object.keys(headers));
        const response = await fetch('/api/auth/admin-status', { headers });
        console.log('[Admin Auth] Response status:', response.status);
        const data = await response.json();
        console.log('[Admin Auth] Response data:', data);
        setIsAdmin(data.isAdmin || false);
        
        console.log('Admin auth check result:', data);
      } catch (error) {
        console.error('Admin auth check failed:', error);
        setIsAdmin(false);
      }
      setCheckingAuth(false);
    };
    checkAdminAuth();
  }, [sessionId]); // Only re-run when sessionId changes, not on every tab switch
  
  if (checkingAuth) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Checking authorization...</div>
    </div>;
  }
  
  // Check if user has valid JWT admin access OR admin session
  const authToken = localStorage.getItem('auth-token');
  if (isAdmin && (authToken || (isAuthenticated && sessionId))) {
    return <AdminDashboard />;
  }
  
  return <AdminLogin onAuthenticated={login} />;
}

export default function Admin() {
  return (
    <AuthProvider>
      <AuthenticatedAdmin />
    </AuthProvider>
  );
}
