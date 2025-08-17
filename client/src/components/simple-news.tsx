import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ExternalLink, Calendar } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  link: string;
  contentSnippet?: string;
  pubDate?: string;
  creator?: string;
  thumbnail?: string;
}

export default function SimpleNews() {
  const { data: news = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ['/api/news'],
  });

  if (isLoading || news.length === 0) {
    return null;
  }

  // Only show the first 2 news items on mobile
  const mobileNews = news.slice(0, 2);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 px-1">Latest Updates</h3>
      {mobileNews.map((item) => (
        <Card key={item.id} className="p-3 hover:shadow-md transition-shadow">
          <a 
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <div className="flex gap-3">
              {item.thumbnail && (
                <div className="flex-shrink-0">
                  <img 
                    src={item.thumbnail} 
                    alt=""
                    className="w-16 h-16 object-cover rounded"
                  />
                </div>
              )}
              <div className="flex-grow min-w-0">
                <h4 className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">
                  {item.title}
                </h4>
                {item.contentSnippet && (
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {item.contentSnippet}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {item.pubDate && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.pubDate).toLocaleDateString()}
                    </span>
                  )}
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </div>
              </div>
            </div>
          </a>
        </Card>
      ))}
    </div>
  );
}