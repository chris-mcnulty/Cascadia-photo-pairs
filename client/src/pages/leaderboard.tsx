import { useQuery } from "@tanstack/react-query";
import { Photo, Settings } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trophy, Vote, Crown, Medal, Award, ArrowLeft, Home, TrendingUp, ShoppingCart, ChevronDown, ChevronUp, User } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";

type LeaderboardType = 'votes' | 'winrate';

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('votes');
  const [showUserOnly, setShowUserOnly] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Fetch settings first
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  // Check if user is logged in and if login features are enabled
  useEffect(() => {
    const checkAuth = async () => {
      // Only check auth if login features are enabled
      if (!settings?.userLoginEnabled) {
        setIsLoggedIn(false);
        return;
      }
      
      const token = localStorage.getItem('auth-token');
      if (token) {
        try {
          const response = await fetch('/api/auth/status', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await response.json();
          setIsLoggedIn(data.authenticated || false);
        } catch {
          setIsLoggedIn(false);
        }
      }
    };
    checkAuth();
  }, [settings]);

  const { data: topByVotes, isLoading: loadingVotes } = useQuery<Photo[]>({
    queryKey: showUserOnly ? ['/api/leaderboard/user/votes'] : ['/api/leaderboard/votes'],
    enabled: true,
  });

  const { data: topByWins, isLoading: loadingWins } = useQuery<Photo[]>({
    queryKey: showUserOnly ? ['/api/leaderboard/user/wins'] : ['/api/leaderboard/wins'],
    enabled: true,
  });

  // Sort by win rate when in winrate mode
  const getSortedData = () => {
    if (activeTab === 'votes') {
      return topByVotes;
    } else {
      // Sort by win rate
      return topByWins?.slice().sort((a, b) => {
        const aWinRate = a.comparisons > 0 ? (a.wins / a.comparisons) : 0;
        const bWinRate = b.comparisons > 0 ? (b.wins / b.comparisons) : 0;
        return bWinRate - aWinRate;
      });
    }
  };

  const currentData = getSortedData();
  const isLoading = activeTab === 'votes' ? loadingVotes : loadingWins;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <Trophy className="w-6 h-6 text-gray-600" />;
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-200";
      case 2:
        return "bg-gradient-to-r from-gray-100 to-gray-50 border-gray-200";
      case 3:
        return "bg-gradient-to-r from-amber-100 to-amber-50 border-amber-200";
      default:
        return "bg-white border-gray-200";
    }
  };

  const toggleDescription = (photoId: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Voting</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Home</span>
                </Button>
              </Link>
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2">
                  Admin
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 font-epilogue mb-2">
              Photo Leaderboard
            </h1>
            <p className="text-gray-600">
              Discover the most popular and highest-performing photographs in our collection
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-col items-center mt-6">
            <div className="bg-gray-100 p-1 rounded-lg inline-flex">
              <button
                onClick={() => setActiveTab('votes')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'votes' 
                    ? 'bg-cascadia-green text-white shadow-sm' 
                    : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Vote className="w-4 h-4" />
                Most Votes
              </button>
              <button
                onClick={() => setActiveTab('winrate')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'winrate' 
                    ? 'bg-cascadia-green text-white shadow-sm' 
                    : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Best Win Rate
              </button>
            </div>
            
            {/* User-specific toggle (only shown when logged in) */}
            {isLoggedIn && (
              <div className="flex items-center space-x-2 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <User className="w-4 h-4 text-blue-600" />
                <Label htmlFor="user-photos" className="text-sm font-medium text-blue-900">
                  Show only my voted photos
                </Label>
                <Switch
                  id="user-photos"
                  checked={showUserOnly}
                  onCheckedChange={setShowUserOnly}
                  className="data-[state=checked]:bg-cascadia-green"
                />
              </div>
            )}
            
            <p className="text-sm text-gray-600 mt-3 text-center px-4">
              <span className="font-medium">Currently viewing:</span>{' '}
              <span className="text-cascadia-green font-semibold">
                {showUserOnly ? 'Your Voted Photos - ' : ''}
                {activeTab === 'votes' ? 'Most Votes' : 'Best Win Rate'}
              </span>
              <br />
              <span className="text-xs">
                {activeTab === 'votes' 
                  ? 'Photos ranked by total number of votes received'
                  : 'Photos ranked by win percentage (wins ÷ comparisons)'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-6 h-6 bg-gray-300 rounded"></div>
                    <div className="w-20 h-20 bg-gray-300 rounded"></div>
                    <div className="flex-1">
                      <div className="h-6 bg-gray-300 rounded mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    </div>
                    <div className="text-right">
                      <div className="h-8 w-16 bg-gray-300 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : currentData && currentData.length > 0 ? (
          <div className="space-y-4">
            {currentData.map((photo, index) => {
              const rank = index + 1;
              const winRate = photo.comparisons > 0 ? ((photo.wins / photo.comparisons) * 100).toFixed(1) : '0.0';
              const statValue = activeTab === 'votes' ? photo.votes : parseFloat(winRate);
              const hasCustomPurchaseUrl = photo.customPurchaseUrl && photo.customPurchaseUrl.length > 0;
              const showPurchaseButton = settings?.purchaseEnabled && hasCustomPurchaseUrl && !photo.neverForSale;
              
              return (
                <Card key={photo.id} className={`transition-all duration-200 hover:shadow-lg ${getRankStyle(rank)}`}>
                  <CardContent className="p-4 sm:p-6">
                    {/* Mobile-first layout with grid for consistent alignment */}
                    <div className="grid grid-cols-12 gap-3 sm:gap-4 items-start">
                      {/* Rank - Always visible */}
                      <div className="col-span-2 sm:col-span-1 flex flex-col items-center">
                        <div className="flex justify-center mb-1">
                          {getRankIcon(rank)}
                        </div>
                        <div className="font-bold text-sm sm:text-base text-gray-700">
                          #{rank}
                        </div>
                      </div>

                      {/* Photo Thumbnail */}
                      <div className="col-span-3 sm:col-span-2">
                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 max-w-[80px] sm:max-w-[100px]">
                          <img
                            src={photo.imageUrl}
                            alt={photo.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      </div>

                      {/* Photo Info - Constrained width to prevent overflow */}
                      <div className="col-span-7 sm:col-span-6 min-w-0 pr-2">
                        <h3 className="font-bold text-sm sm:text-base text-gray-900 font-epilogue mb-1 truncate">
                          {photo.title}
                        </h3>
                        
                        {photo.category && (
                          <Badge variant="outline" className="text-xs mb-2">
                            {photo.category}
                          </Badge>
                        )}
                        
                        {photo.description && (
                          <div className="mt-1">
                            <p className={`text-gray-600 text-xs leading-tight ${
                              expandedDescriptions.has(photo.id) ? '' : 'line-clamp-3 sm:line-clamp-2'
                            }`}>
                              {photo.description}
                            </p>
                            {photo.description.length > 80 && (
                              <button
                                onClick={() => toggleDescription(photo.id)}
                                className="text-cascadia-green hover:text-green-700 text-xs font-medium mt-1 flex items-center gap-1"
                              >
                                {expandedDescriptions.has(photo.id) ? (
                                  <>
                                    <ChevronUp className="w-3 h-3" />
                                    Less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3" />
                                    More
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Statistics - Fixed width column */}
                      <div className="col-span-12 sm:col-span-3 mt-3 sm:mt-0">
                        <div className="bg-gray-50 rounded-lg p-3 sm:bg-transparent sm:p-0">
                          {/* Primary stat - large and prominent */}
                          <div className="text-center sm:text-right mb-2 sm:mb-3">
                            <div className="text-xl sm:text-2xl font-bold text-cascadia-green">
                              {activeTab === 'votes' ? photo.votes.toLocaleString() : `${winRate}%`}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">
                              {activeTab === 'votes' ? 'Win Rate' : 'Total Votes'}
                            </div>
                          </div>
                          
                          {/* Secondary stats - compact */}
                          <div className="text-xs space-y-1 sm:text-right">
                            <div>
                              <span className="text-gray-600">Votes: </span>
                              <span className="font-semibold text-gray-900">{photo.votes.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Win Rate: </span>
                              <span className="font-semibold text-cascadia-green">{winRate}%</span>
                            </div>
                            <div className="text-gray-400">
                              {photo.comparisons.toLocaleString()} matches
                            </div>
                          </div>
                          
                          {/* Purchase button */}
                          {showPurchaseButton && (
                            <div className="text-center sm:text-right mt-3">
                              <a
                                href={photo.customPurchaseUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-cascadia-green text-white text-xs rounded-md hover:bg-green-700 transition-colors"
                              >
                                <ShoppingCart className="w-3 h-3" />
                                Purchase
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Data Available</h3>
            <p className="text-gray-500">
              Leaderboard data will appear here once photos start receiving votes.
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="mt-12 bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 font-epilogue">How Rankings Work</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                <Vote className="w-4 h-4 text-cascadia-green" />
                Most Votes
              </h4>
              <p>Shows photos ranked by the total number of times they've been chosen as winners in head-to-head comparisons. Popular photos that are selected frequently appear at the top.</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cascadia-green" />
                Best Win Rate
              </h4>
              <p>Shows photos ranked by their winning percentage (wins ÷ comparisons). This identifies photos that consistently win when shown, regardless of how often they appear.</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>Note:</strong> Win rate provides a better measure of photo quality as it accounts for performance rather than just popularity. 
              A photo with 90% win rate (9 wins in 10 shows) ranks higher than one with 60% win rate (60 wins in 100 shows) in win rate mode.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}