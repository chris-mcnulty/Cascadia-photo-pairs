import { useQuery } from "@tanstack/react-query";
import { Photo } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Vote, Crown, Medal, Award } from "lucide-react";
import { useState } from "react";

type LeaderboardType = 'votes' | 'wins';

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('votes');

  const { data: topByVotes, isLoading: loadingVotes } = useQuery<Photo[]>({
    queryKey: ['/api/leaderboard/votes'],
    enabled: true,
  });

  const { data: topByWins, isLoading: loadingWins } = useQuery<Photo[]>({
    queryKey: ['/api/leaderboard/wins'],
    enabled: true,
  });

  const currentData = activeTab === 'votes' ? topByVotes : topByWins;
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
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 font-epilogue mb-2">
              Photo Leaderboard
            </h1>
            <p className="text-gray-600">
              Discover the most popular and highest-performing photographs in our collection
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center mt-6">
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
                Top by Total Votes
              </Button>
              <Button
                variant={activeTab === 'wins' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('wins')}
                className={`${
                  activeTab === 'wins' 
                    ? 'bg-white shadow-sm' 
                    : 'hover:bg-gray-200'
                }`}
              >
                <Crown className="w-4 h-4 mr-2" />
                Top by Wins
              </Button>
            </div>
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
              const statValue = activeTab === 'votes' ? photo.votes : photo.wins;
              const winRate = photo.comparisons > 0 ? ((photo.wins / photo.comparisons) * 100).toFixed(1) : '0.0';
              
              return (
                <Card key={photo.id} className={`transition-all duration-200 hover:shadow-lg ${getRankStyle(rank)}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-6">
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
                        <h3 className="font-bold text-lg text-gray-900 font-epilogue truncate">
                          {photo.title}
                        </h3>
                        {photo.description && (
                          <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                            {photo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-3">
                          <Badge variant="outline" className="text-xs">
                            {photo.category}
                          </Badge>
                          <div className="text-xs text-gray-500">
                            Win Rate: {winRate}%
                          </div>
                        </div>
                      </div>

                      {/* Statistics */}
                      <div className="text-right flex-shrink-0">
                        <div className="text-3xl font-bold text-cascadia-green">
                          {statValue.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500 capitalize">
                          {activeTab}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {photo.comparisons.toLocaleString()} comparisons
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
              <h4 className="font-medium text-gray-800 mb-2">Total Votes</h4>
              <p>Shows photos with the highest number of total votes received across all comparisons. This includes both winning and losing votes.</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Total Wins</h4>
              <p>Shows photos that have won the most head-to-head comparisons. A photo wins when users select it over another photo.</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>Win Rate:</strong> Calculated as (Total Wins / Total Comparisons) × 100. 
              A higher win rate indicates consistent performance across different matchups.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}