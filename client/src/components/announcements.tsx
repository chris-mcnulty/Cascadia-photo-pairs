import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Trophy, Calendar, ExternalLink, Info, AlertCircle, CheckCircle } from "lucide-react";
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
}

export default function Announcements() {
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

  const getAnnouncementStyle = (type: string) => {
    switch (type) {
      case "warning":
        return "border-amber-200 bg-amber-50 text-amber-800";
      case "success":
        return "border-green-200 bg-green-50 text-green-800";
      case "contest":
        return "border-purple-200 bg-purple-50 text-purple-800";
      default:
        return "border-blue-200 bg-blue-50 text-blue-800";
    }
  };

  const formatContestDates = (startDate: string | null, endDate: string | null) => {
    if (!startDate || !endDate) return "";
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    
    if (now < start) {
      const daysUntil = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return `Starts in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;
    } else if (now > end) {
      return "Contest ended";
    } else {
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`;
    }
  };

  // Don't render if no announcements or news
  if (!announcement?.announcementEnabled && 
      !announcement?.monthlyContestActive && 
      !announcement?.quarterlyContestActive && 
      newsItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Master Announcement */}
      {announcement?.announcementEnabled && announcement.announcementText && (
        <Alert className={getAnnouncementStyle(announcement.announcementType)}>
          {getAnnouncementIcon(announcement.announcementType)}
          <AlertDescription className="ml-2">
            <strong>Announcement:</strong> {announcement.announcementText}
          </AlertDescription>
        </Alert>
      )}

      {/* Contest Announcements */}
      {announcement?.monthlyContestActive && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Trophy className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="ml-2 text-yellow-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>Monthly Contest Active!</strong> {announcement.monthlyContestText}
              </div>
              <Badge variant="outline" className="text-yellow-600 border-yellow-600 ml-4">
                {formatContestDates(announcement.monthlyContestStartDate, announcement.monthlyContestEndDate)}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {announcement?.quarterlyContestActive && (
        <Alert className="border-purple-200 bg-purple-50">
          <Trophy className="h-4 w-4 text-purple-600" />
          <AlertDescription className="ml-2 text-purple-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>Quarterly Contest Active!</strong> {announcement.quarterlyContestText}
              </div>
              <Badge variant="outline" className="text-purple-600 border-purple-600 ml-4">
                {formatContestDates(announcement.quarterlyContestStartDate, announcement.quarterlyContestEndDate)}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* News Feed */}
      {newsItems.length > 0 && (
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Latest News & Updates</h3>
            </div>
            <div className="space-y-3">
              {newsItems.map((item) => (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 hover:text-green-700 transition-colors">
                          {item.title}
                        </h4>
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {format(new Date(item.publishDate), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}