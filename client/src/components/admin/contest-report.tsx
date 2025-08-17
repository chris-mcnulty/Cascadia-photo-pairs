import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Download, Calendar, Users, TrendingUp, Award, Medal, Crown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ContestEntry {
  userId: string;
  email: string;
  displayName: string;
  voteCount: number;
  contestPeriod: string;
  enteredAt: string;
  isWinner: boolean;
}

interface ContestStats {
  totalParticipants: number;
  totalVotes: number;
  averageVotes: number;
  topVoters: ContestEntry[];
}

export default function ContestReport() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("2025-Q3");
  const [contestType, setContestType] = useState<"monthly" | "quarterly">("quarterly");

  // Fetch contest data
  const { data: contestData, isLoading, refetch } = useQuery<ContestStats>({
    queryKey: [`/api/admin/contest-report?contestType=${contestType}&contestPeriod=${selectedPeriod}`],
  });

  const handleMarkWinner = async (userId: string) => {
    try {
      await apiRequest("POST", "/api/admin/contest-winner", {
        userId,
        contestPeriod: selectedPeriod,
        contestType
      });
      toast({
        title: "Winner Marked",
        description: "The contest winner has been successfully marked.",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark winner. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    if (!contestData?.topVoters) return;

    const csvContent = [
      ["Rank", "Name", "Email", "Votes", "Entry Date"],
      ...contestData.topVoters.map((entry, index) => [
        index + 1,
        entry.displayName,
        entry.email,
        entry.voteCount,
        new Date(entry.enteredAt).toLocaleDateString()
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contest-report-${selectedPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Contest Report</h2>
          <p className="text-gray-600 mt-1">
            View and manage contest participants and winners
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline" disabled={!contestData}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Contest Selection */}
      <div className="flex gap-4">
        <Select value={contestType} onValueChange={(value: "monthly" | "quarterly") => setContestType(value)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly Contest</SelectItem>
            <SelectItem value="quarterly">Quarterly Contest</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {contestType === "quarterly" ? (
              <>
                <SelectItem value="2025-Q3">Q3 2025 (Jul-Sep)</SelectItem>
                <SelectItem value="2025-Q2">Q2 2025 (Apr-Jun)</SelectItem>
                <SelectItem value="2025-Q1">Q1 2025 (Jan-Mar)</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="2025-08">August 2025</SelectItem>
                <SelectItem value="2025-07">July 2025</SelectItem>
                <SelectItem value="2025-06">June 2025</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold">
                {contestData?.totalParticipants || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Votes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">
                {contestData?.totalVotes || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Average Votes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold">
                {contestData?.averageVotes?.toFixed(1) || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Contest Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading contest data...</div>
          ) : contestData?.topVoters && contestData.topVoters.length > 0 ? (
            <div className="space-y-3">
              {contestData.topVoters.map((entry, index) => {
                const rank = index + 1;
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      rank === 1 ? "border-yellow-400 bg-yellow-50" :
                      rank === 2 ? "border-gray-400 bg-gray-50" :
                      rank === 3 ? "border-amber-400 bg-amber-50" :
                      "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-600">#{rank}</span>
                        {getRankIcon(rank)}
                      </div>
                      <div>
                        <div className="font-semibold">{entry.displayName}</div>
                        <div className="text-sm text-gray-600">{entry.email}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-cascadia-green">
                          {entry.voteCount}
                        </div>
                        <div className="text-xs text-gray-500">votes</div>
                      </div>
                      
                      {entry.isWinner ? (
                        <Badge className="bg-gold-500">Winner</Badge>
                      ) : rank === 1 ? (
                        <Button
                          size="sm"
                          onClick={() => handleMarkWinner(entry.userId)}
                          className="bg-cascadia-green hover:bg-green-700"
                        >
                          Mark as Winner
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No contest entries found for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contest Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Contest Rules & Prizes</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800">
          <p className="mb-2">
            <strong>Q3 2025 Quarterly Contest</strong> runs from July 1 - September 30, 2025
          </p>
          <p className="mb-2">
            <strong>Prize:</strong> Winner's choice of a 12" print or 20% off any metal print
          </p>
          <p>
            <strong>Rules:</strong> Users must be registered and logged in. The person with the most votes by the deadline wins.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}