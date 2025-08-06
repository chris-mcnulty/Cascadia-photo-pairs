import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Photo } from "@shared/schema";

interface StatsData {
  totalVotes: number;
  uniqueVoters: number;
  avgVotesPerUser: number;
  topPhotos: Photo[];
}

export default function AdminStats() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const sessionId = localStorage.getItem('admin-session-id');
      if (!sessionId) {
        throw new Error('No session ID found - please log in to admin');
      }
      
      const response = await fetch('/api/stats', {
        credentials: "include",
        headers: {
          'x-session-id': sessionId,
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('admin-session-id');
          throw new Error('Session expired - please log in again');
        }
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    },
    retry: false,
    enabled: !!localStorage.getItem('admin-session-id'),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12">Loading statistics...</div>;
  }

  if (!stats) {
    return <div className="text-center py-12 text-gray-500">No statistics available</div>;
  }

  return (
    <div>
      {/* Top 20 Rankings */}
      <Card>
        <CardHeader>
          <CardTitle>Top 20 Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Votes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.topPhotos.slice(0, 20).map((photo, index) => {
                  const winRate = photo.comparisons > 0 ? Math.round((photo.wins / photo.comparisons) * 100) : 0;
                  return (
                    <tr key={photo.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <img 
                          src={photo.imageUrl} 
                          alt={photo.title}
                          className="w-16 h-10 object-cover rounded" 
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{photo.title}</div>
                        {photo.description && (
                          <div className="text-gray-500 text-xs truncate max-w-xs">
                            {photo.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {photo.votes}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {winRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {stats.topPhotos.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No voting data available yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}