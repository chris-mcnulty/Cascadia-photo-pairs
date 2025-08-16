import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Trophy, Calendar, ExternalLink, Info, AlertCircle, CheckCircle, X, ChevronDown, ChevronUp, Newspaper, Clock } from "lucide-react";
import { format } from "date-fns";

interface AnnouncementData {
  announcementEnabled: boolean;
  announcementText: string;
  announcementType: string;
  monthlyContestActive: boolean;
  quarterlyContestActive: boolean;
  monthlyContestText: string;
  quarterlyContestText: string;
  monthlyContestStartDate: string | null;
  monthlyContestEndDate: string | null;
  quarterlyContestStartDate: string | null;
  quarterlyContestEndDate: string | null;
}

interface NewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  publishDate: string;
  priority: number;
  imageUrl?: string;
}

export default function SimpleAnnouncements() {
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState(false);
  const [newsExpanded, setNewsExpanded] = useState(false);

  // Fetch announcement data
  const { data: announcement } = useQuery<AnnouncementData>({
    queryKey: ["/api/announcements"],
    queryFn: async () => {
      const response = await fetch("/api/announcements");
      if (!response.ok) {
        return {
          announcementEnabled: false,
          announcementText: "",
          announcementType: "info",
          monthlyContestActive: false,
          quarterlyContestActive: false,
          monthlyContestText: "",
          quarterlyContestText: "",
          monthlyContestStartDate: null,
          monthlyContestEndDate: null,
          quarterlyContestStartDate: null,
          quarterlyContestEndDate: null,
        };
      }
      return response.json();
    }
  });

  // Fetch news items
  const { data: newsItems = [] } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
    queryFn: async () => {
      const response = await fetch("/api/news");
      if (!response.ok) return [];
      return response.json();
    }
  });

  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertCircle className="h-4 w-4" />;
      case "success":
        return <CheckCircle className="h-4 w-4" />;
      case "contest":
        return <Trophy className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getAnnouncementVariant = (type: string): "default" | "destructive" => {
    return type === "warning" ? "destructive" : "default";
  };

  const calculateDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Sort news items by priority and date (reverse chronological order - newest first)
  const sortedNewsItems = newsItems.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime(); // Newer date first
  });

  return (
    <div className="space-y-6">
      {/* Dismissable Announcement Header Bar */}
      {announcement?.announcementEnabled && !dismissedAnnouncement && (
        <div className="bg-green-600 text-white px-4 py-3 relative shadow-sm">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              {getAnnouncementIcon(announcement.announcementType)}
              <span className="font-medium">
                <strong>Announcement:</strong> {announcement.announcementText}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-6 w-6 text-white hover:bg-green-700"
              onClick={() => setDismissedAnnouncement(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Collapsible News & Updates Section */}
      {(announcement?.monthlyContestActive || announcement?.quarterlyContestActive || sortedNewsItems.length > 0) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div onClick={() => setNewsExpanded(!newsExpanded)}>
            <Button
              variant="outline"
              className="w-full flex items-center justify-between p-4 h-auto border border-gray-300 bg-white/80 backdrop-blur-sm shadow-sm hover:border-gray-400 hover:bg-white/90 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-gray-600" />
                <span className="font-medium">News & Updates</span>
                {(announcement?.monthlyContestActive || announcement?.quarterlyContestActive) && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <Trophy className="h-3 w-3 mr-1" />
                    Contest Active
                  </Badge>
                )}
                {sortedNewsItems.length > 0 && (
                  <Badge variant="outline">
                    {sortedNewsItems.length} update{sortedNewsItems.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              {newsExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {newsExpanded && (
            <div className="space-y-6 mt-6 mb-12 bg-white/70 backdrop-blur-sm rounded-lg border border-gray-200 p-6 shadow-sm">
            {/* Contest Alerts */}
            {announcement?.monthlyContestActive && (
              <Alert className="bg-green-50 border-green-200">
                <Trophy className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-green-800">Monthly Contest Active!</strong>{" "}
                      {announcement.monthlyContestText}
                    </div>
                    {announcement.monthlyContestEndDate && (
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                        {calculateDaysRemaining(announcement.monthlyContestEndDate)} days remaining
                      </Badge>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {announcement?.quarterlyContestActive && (
              <Alert className="bg-blue-50 border-blue-200">
                <Trophy className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-blue-800">Quarterly Contest Active!</strong>{" "}
                      {announcement.quarterlyContestText}
                    </div>
                    {announcement.quarterlyContestEndDate && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                        {calculateDaysRemaining(announcement.quarterlyContestEndDate)} days remaining
                      </Badge>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* News Items */}
            {sortedNewsItems.length > 0 && (
              <div className="space-y-4">
                {sortedNewsItems.map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* News Content */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">
                              {item.title}
                              {item.link && (
                                <ExternalLink className="h-3 w-3 ml-1 inline" />
                              )}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            {format(new Date(item.publishDate), "MMM d, yyyy")}
                          </div>
                        </div>

                        {/* Optional Image Thumbnail */}
                        {item.imageUrl && (
                          <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover transition-opacity hover:opacity-90"
                              onError={(e) => {
                                // Hide image container if image fails to load
                                const target = e.target as HTMLImageElement;
                                const container = target.parentElement;
                                if (container) container.style.display = 'none';
                              }}
                              loading="lazy"
                            />
                          </div>
                        )}
                      </div>

                      {/* Link Button */}
                      {item.link && (
                        <div className="mt-3">
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 font-medium"
                          >
                            Read More
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}