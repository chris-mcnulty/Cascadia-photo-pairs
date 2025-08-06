import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminStats from "@/components/admin-stats";
import AdminSettings from "@/components/admin-settings";
import PhotoManager from "@/components/photo-manager";
import AdminLogin from "@/components/admin-login";
import AdminAnalytics from "@/components/admin-analytics";
import { ArrowLeft, BarChart3, Settings, Download, ImageIcon, LogOut } from "lucide-react";
import { Link } from "wouter";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"analytics" | "stats" | "settings" | "photos">("analytics");
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
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex gap-2">
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

        {/* Tabs */}
        <div className="flex space-x-1 mb-8">
          <Button
            variant={activeTab === "analytics" ? "default" : "outline"}
            onClick={() => setActiveTab("analytics")}
            className="flex items-center"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          <Button
            variant={activeTab === "stats" ? "default" : "outline"}
            onClick={() => setActiveTab("stats")}
            className="flex items-center"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Statistics
          </Button>
          <Button
            variant={activeTab === "photos" ? "default" : "outline"}
            onClick={() => setActiveTab("photos")}
            className="flex items-center"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Photos
          </Button>
          <Button
            variant={activeTab === "settings" ? "default" : "outline"}
            onClick={() => setActiveTab("settings")}
            className="flex items-center"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "analytics" && <AdminAnalytics />}
        {activeTab === "stats" && <AdminStats />}
        {activeTab === "photos" && <PhotoManager />}
        {activeTab === "settings" && <AdminSettings />}
      </div>
    </div>
  );
}

function AuthenticatedAdmin() {
  const { isAuthenticated, sessionId, login } = useAuth();
  
  console.log('AuthenticatedAdmin - isAuthenticated:', isAuthenticated, 'sessionId:', sessionId);
  
  // Extra debugging to understand what's happening
  if (!isAuthenticated && !sessionId) {
    console.log('Showing AdminLogin because not authenticated');
  } else {
    console.log('Showing AdminDashboard because authenticated');
  }
  
  if (!isAuthenticated || !sessionId) {
    return <AdminLogin onAuthenticated={login} />;
  }
  
  return <AdminDashboard />;
}

export default function Admin() {
  return (
    <AuthProvider>
      <AuthenticatedAdmin />
    </AuthProvider>
  );
}
