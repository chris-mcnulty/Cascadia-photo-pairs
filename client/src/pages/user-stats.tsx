import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Trophy, Calendar, TrendingUp, Star, Gift, Clock } from "lucide-react";

interface UserStatsData {
  totalVotes: number;
  monthlyVotes: number;
  quarterlyVotes: number;
  lastVoteAt: string | null;
  currentStreak: number;
  longestStreak: number;
  favoritePhotos: string[];
  purchasedPhotos: string[];
  monthlyRank?: number;
  quarterlyRank?: number;
  totalUsers?: number;
}

interface ContestStatus {
  monthlyContestEnabled: boolean;
  monthlyContestActive: boolean;
  monthlyContestText: string;
  quarterlyContestEnabled: boolean;
  quarterlyContestActive: boolean;
  quarterlyContestText: string;
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

  // Fetch user stats
  const { data: stats, isLoading: statsLoading } = useQuery<UserStatsData>({
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

  // Fetch contest status
  const { data: contestStatus } = useQuery<ContestStatus>({
    queryKey: ["/api/contest-status"],
    queryFn: async () => {
      const response = await fetch("/api/contest-status");
      if (!response.ok) {
        // If endpoint doesn't exist or fails, return default values
        return {
          monthlyContestEnabled: false,
          monthlyContestActive: false,
          monthlyContestText: "",
          quarterlyContestEnabled: false,
          quarterlyContestActive: false,
          quarterlyContestText: "",
        };
      }
      return response.json();
    }
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getProgressColor = (votes: number) => {
    if (votes >= 100) return "bg-green-600";
    if (votes >= 50) return "bg-blue-600";
    if (votes >= 25) return "bg-yellow-600";
    return "bg-gray-600";
  };

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading your statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">No statistics available</div>
      </div>
    );
  }

  // Determine whether to show "Monthly" or "Monthly Contest"
  const monthlyLabel = contestStatus?.monthlyContestActive ? "Monthly Contest" : "Monthly";
  const quarterlyLabel = contestStatus?.quarterlyContestActive ? "Quarterly Contest" : "Quarterly";

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
            <Link href="/profile">
              <Button variant="outline" size="sm">
                View Profile
              </Button>
            </Link>
          </div>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Your Voting Statistics
            </h1>
            <p className="text-gray-600">
              Track your voting activity and competition standings
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Contest Alerts */}
        {contestStatus?.monthlyContestActive && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <Trophy className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Monthly Contest Active!</strong> {contestStatus.monthlyContestText}
            </AlertDescription>
          </Alert>
        )}
        
        {contestStatus?.quarterlyContestActive && (
          <Alert className="border-purple-200 bg-purple-50">
            <Trophy className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-purple-800">
              <strong>Quarterly Contest Active!</strong> {contestStatus.quarterlyContestText}
            </AlertDescription>
          </Alert>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                Total Votes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.totalVotes}</div>
              <Progress 
                value={Math.min(stats.totalVotes, 100)} 
                className="mt-2" 
              />
              <p className="text-sm text-gray-600 mt-1">
                {stats.totalVotes >= 100 ? "Expert Voter!" : `${100 - stats.totalVotes} votes to Expert`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                {monthlyLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.monthlyVotes}</div>
              {stats.monthlyRank && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-blue-600 border-blue-600">
                    Rank #{stats.monthlyRank} of {stats.totalUsers}
                  </Badge>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-1">
                This month's activity
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                {quarterlyLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.quarterlyVotes}</div>
              {stats.quarterlyRank && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Rank #{stats.quarterlyRank} of {stats.totalUsers}
                  </Badge>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-1">
                This quarter's total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Voting Activity</CardTitle>
            <CardDescription>Your voting patterns and achievements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Vote</span>
                  <span className="text-sm font-medium">{formatDate(stats.lastVoteAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current Streak</span>
                  <span className="text-sm font-medium">{stats.currentStreak} days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Longest Streak</span>
                  <span className="text-sm font-medium">{stats.longestStreak} days</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Favorite Photos</span>
                  <span className="text-sm font-medium">{stats.favoritePhotos?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Purchased Photos</span>
                  <span className="text-sm font-medium">{stats.purchasedPhotos?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg Daily Votes</span>
                  <span className="text-sm font-medium">
                    {stats.currentStreak > 0 ? Math.round(stats.totalVotes / Math.max(stats.currentStreak, 1)) : 0}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card>
          <CardHeader>
            <CardTitle>Achievements</CardTitle>
            <CardDescription>Milestones you've reached</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`text-center p-4 rounded-lg ${stats.totalVotes >= 10 ? 'bg-green-50' : 'bg-gray-50'}`}>
                <Star className={`w-8 h-8 mx-auto mb-2 ${stats.totalVotes >= 10 ? 'text-green-600' : 'text-gray-400'}`} />
                <p className="text-sm font-medium">Beginner</p>
                <p className="text-xs text-gray-600">10 votes</p>
              </div>
              
              <div className={`text-center p-4 rounded-lg ${stats.totalVotes >= 50 ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <Trophy className={`w-8 h-8 mx-auto mb-2 ${stats.totalVotes >= 50 ? 'text-blue-600' : 'text-gray-400'}`} />
                <p className="text-sm font-medium">Regular</p>
                <p className="text-xs text-gray-600">50 votes</p>
              </div>
              
              <div className={`text-center p-4 rounded-lg ${stats.totalVotes >= 100 ? 'bg-purple-50' : 'bg-gray-50'}`}>
                <Gift className={`w-8 h-8 mx-auto mb-2 ${stats.totalVotes >= 100 ? 'text-purple-600' : 'text-gray-400'}`} />
                <p className="text-sm font-medium">Expert</p>
                <p className="text-xs text-gray-600">100 votes</p>
              </div>
              
              <div className={`text-center p-4 rounded-lg ${stats.totalVotes >= 500 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                <Clock className={`w-8 h-8 mx-auto mb-2 ${stats.totalVotes >= 500 ? 'text-yellow-600' : 'text-gray-400'}`} />
                <p className="text-sm font-medium">Master</p>
                <p className="text-xs text-gray-600">500 votes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center space-y-4">
          <p className="text-gray-600">Keep voting to climb the leaderboard!</p>
          <div className="flex justify-center gap-4">
            <Link href="/">
              <Button className="bg-green-700 hover:bg-green-800">
                Continue Voting
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button variant="outline">
                View Leaderboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}