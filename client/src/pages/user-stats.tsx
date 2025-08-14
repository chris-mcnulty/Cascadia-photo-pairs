import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Trophy, BarChart3, Calendar, Target, TrendingUp, Vote, Award } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface UserStats {
  totalVotes: number;
  monthlyVotes: number;
  quarterlyVotes: number;
  favoritePhotos: string[];
  purchasedPhotos: string[];
  currentStreak: number;
  longestStreak: number;
  lastVoteAt: string | null;
  votedPhotos: Array<{
    id: string;
    title: string;
    wins: number;
    comparisons: number;
    userVoteCount: number;
  }>;
  monthlyRank?: number;
  quarterlyRank?: number;
  totalUsers?: number;
}

export default function UserStatsPage() {
  const [, setLocation] = useLocation();

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('auth-token');
    if (!token) {
      setLocation('/login');
    }
  }, [setLocation]);

  // Fetch user statistics
  const { data: stats, isLoading } = useQuery<UserStats>({
    queryKey: ["/api/user/stats"],
    queryFn: async () => {
      const token = localStorage.getItem('auth-token');
      if (!token) throw new Error("Not authenticated");
      
      const response = await fetch("/api/user/stats", {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      
      return response.json();
    },
    enabled: !!localStorage.getItem('auth-token')
  });

  const calculateProgress = (current: number, total: number) => {
    if (total === 0) return 0;
    return Math.min((current / total) * 100, 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading your statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">No statistics available yet. Start voting to see your stats!</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
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
              Your Voting Statistics
            </h1>
            <p className="text-gray-600">
              Track your voting activity and contest participation
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Vote className="w-5 h-5 text-green-600" />
                Total Votes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.totalVotes}</div>
              <p className="text-sm text-gray-500 mt-1">
                Last vote: {formatDate(stats.lastVoteAt)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Monthly Contest
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.monthlyVotes}</div>
              <Progress 
                value={calculateProgress(stats.monthlyVotes, 100)} 
                className="mt-2"
              />
              {stats.monthlyRank && (
                <p className="text-sm text-gray-500 mt-1">
                  Rank: #{stats.monthlyRank} of {stats.totalUsers}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                Quarterly Contest
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.quarterlyVotes}</div>
              <Progress 
                value={calculateProgress(stats.quarterlyVotes, 500)} 
                className="mt-2"
              />
              {stats.quarterlyRank && (
                <p className="text-sm text-gray-500 mt-1">
                  Rank: #{stats.quarterlyRank} of {stats.totalUsers}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Streaks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-600" />
                Current Streak
              </CardTitle>
              <CardDescription>
                Consecutive days with votes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stats.currentStreak} days
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-600" />
                Longest Streak
              </CardTitle>
              <CardDescription>
                Your personal record
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stats.longestStreak} days
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Voted Photos */}
        {stats.votedPhotos && stats.votedPhotos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                Your Top Voted Photos
              </CardTitle>
              <CardDescription>
                Photos you've voted for the most
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.votedPhotos.slice(0, 5).map((photo, index) => (
                  <div key={photo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-semibold text-gray-400">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{photo.title}</p>
                        <p className="text-sm text-gray-500">
                          Win rate: {photo.comparisons > 0 ? Math.round((photo.wins / photo.comparisons) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        {photo.userVoteCount} votes
                      </p>
                      <p className="text-xs text-gray-500">
                        {photo.wins}W / {photo.comparisons - photo.wins}L
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contest Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-600" />
              Contest Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Monthly Contest</h3>
                <p className="text-sm text-gray-600">
                  Vote on photos throughout the month to climb the leaderboard. 
                  The top voter each month wins a free print!
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Quarterly Contest</h3>
                <p className="text-sm text-gray-600">
                  Our quarterly contest runs for 3 months with bigger prizes. 
                  Stay consistent to maximize your chances!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}