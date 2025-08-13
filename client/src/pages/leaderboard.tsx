import { useQuery } from "@tanstack/react-query";
import { Photo, Settings } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Vote, Crown, Medal, Award, ArrowLeft, Home, TrendingUp, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

type LeaderboardType = 'votes' | 'winrate';

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('votes');

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const { data: topByVotes, isLoading: loadingVotes } = useQuery<Photo[]>({
    queryKey: ['/api/leaderboard/votes'],
    enabled: true,
  });

  const { data: topByWins, isLoading: loadingWins } = useQuery<Photo[]>({
    queryKey: ['/api/leaderboard/wins'],
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
            <div className="bg-gray-100 p-1 rounded-lg">
              <Button
                variant={activeTab === 'votes' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('votes')}
                className={`mr-1 ${
                  activeTab === 'votes' 
                    ? 'bg-white shadow-sm' 
                    : 'hover:bg-gray-200'
                }`}
              >
                <Vote className="w-4 h-4 mr-2" />
                Most Votes
              </Button>
              <Button
                variant={activeTab === 'winrate' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('winrate')}
                className={`${
                  activeTab === 'winrate' 
                    ? 'bg-white shadow-sm' 
                    : 'hover:bg-gray-200'
                }`}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Best Win Rate
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-3">
              {activeTab === 'votes' 
                ? 'Showing photos ranked by total number of votes received'
                : 'Showing photos ranked by win percentage (wins ÷ comparisons)'}
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
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                      {/* Mobile Layout: Top Row */}
                      <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                        {/* Rank */}
                        <div className="flex items-center justify-center">
                          <div className="text-center">
                            <div className="flex justify-center mb-1">
                              {getRankIcon(rank)}
                            </div>
                            <div className="font-bold text-lg text-gray-700">
                              #{rank}
                            </div>
                          </div>
                        </div>

                        {/* Photo Thumbnail */}
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          <img
                            src={photo.imageUrl}
                            alt={photo.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>

                        {/* Photo Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base sm:text-lg text-gray-900 font-epilogue truncate">
                            {photo.title}
                          </h3>
                          {photo.description && (
                            <p className="text-gray-600 text-xs sm:text-sm mt-1 line-clamp-2">
                              {photo.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 sm:mt-3">
                            <Badge variant="outline" className="text-xs">
                              {photo.category}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Statistics - Desktop: Right Side, Mobile: Bottom */}
                      <div className="text-right flex-shrink-0 mt-4 sm:mt-0 w-full sm:w-auto">
                        <div className="flex sm:block justify-between items-center sm:space-y-2">
                          <div className="text-left sm:text-right">
                            <div className="text-xl sm:text-2xl font-bold text-cascadia-green">
                              {activeTab === 'votes' ? photo.votes.toLocaleString() : `${winRate}%`}
                            </div>
                            <div className="text-xs text-gray-500">
                              {activeTab === 'votes' ? 'Total Votes' : 'Win Rate'}
                            </div>
                          </div>
                          <div className="border-l sm:border-l-0 sm:border-t pl-4 sm:pl-0 sm:pt-2">
                            <div className="text-sm">
                              <span className="text-gray-600">Votes: </span>
                              <span className="font-semibold text-gray-900">{photo.votes.toLocaleString()}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600">Win Rate: </span>
                              <span className="font-semibold text-cascadia-green">{winRate}%</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {photo.comparisons.toLocaleString()} matches
                            </div>
                            {showPurchaseButton && (
                              <a
                                href={photo.customPurchaseUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-cascadia-green text-white text-xs rounded-md hover:bg-green-700 transition-colors"
                              >
                                <ShoppingCart className="w-3 h-3" />
                                Purchase
                              </a>
                            )}
                          </div>
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