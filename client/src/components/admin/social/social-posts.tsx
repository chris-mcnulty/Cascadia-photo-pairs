import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Trash2, ExternalLink } from "lucide-react";

interface SocialPost {
  id: string;
  accountId: string;
  platform: "instagram" | "facebook";
  caption: string;
  mediaUrls: string[];
  linkUrl: string | null;
  trackedSlug: string | null;
  scheduledAt: string;
  status: "draft" | "scheduled" | "posting" | "posted" | "failed";
  externalPostId: string | null;
  externalPermalink: string | null;
  errorMessage: string | null;
  attemptCount: number;
  postedAt: string | null;
  clickCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-400",
  scheduled: "bg-blue-500",
  posting: "bg-yellow-500",
  posted: "bg-green-600",
  failed: "bg-red-600",
};

export default function SocialPostsList() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: quota = {} } = useQuery<
    Record<string, { used: number; cap: number; remaining: number }>
  >({ queryKey: ["/api/admin/social/quota"], refetchInterval: 60_000 });

  const { data: posts = [], isLoading } = useQuery<SocialPost[]>({
    queryKey: ["/api/admin/social/posts", statusFilter],
    queryFn: async () => {
      const url =
        statusFilter && statusFilter !== "all"
          ? `/api/admin/social/posts?status=${statusFilter}`
          : "/api/admin/social/posts";
      const r = await apiRequest("GET", url);
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const retry = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/admin/social/posts/${id}/retry`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/posts"] });
      toast({ title: "Retry queued" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/admin/social/posts/${id}`);
      return r.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/posts"] }),
    onError: (e: any) =>
      toast({ title: "Could not delete", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Social Post Queue</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="posting">Posting</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["/api/admin/social/posts"] })
            }
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {Object.keys(quota).length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {Object.entries(quota).map(([id, q]) => (
              <Badge
                key={id}
                variant={q.remaining < 5 ? "destructive" : "outline"}
                data-testid={`badge-quota-${id}`}
              >
                IG {id.slice(0, 6)}: {q.remaining}/{q.cap} remaining
              </Badge>
            ))}
          </div>
        )}
        {isLoading ? (
          <p>Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-500">No posts yet.</p>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <div
                key={p.id}
                className="border rounded p-3 flex gap-3"
                data-testid={`row-social-post-${p.id}`}
              >
                {p.mediaUrls[0] && (
                  <img
                    src={p.mediaUrls[0]}
                    alt=""
                    className="w-20 h-20 object-cover rounded flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className={STATUS_COLORS[p.status]}>{p.status}</Badge>
                    <Badge variant="outline">{p.platform}</Badge>
                    {p.mediaUrls.length > 1 && (
                      <Badge variant="secondary">
                        Carousel ({p.mediaUrls.length})
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500">
                      {p.status === "posted" && p.postedAt
                        ? `Posted ${new Date(p.postedAt).toLocaleString()}`
                        : `Scheduled ${new Date(p.scheduledAt).toLocaleString()}`}
                    </span>
                    <span className="text-xs text-gray-500">
                      · {p.clickCount} click{p.clickCount === 1 ? "" : "s"}
                    </span>
                    {p.attemptCount > 0 && (
                      <span className="text-xs text-gray-500">
                        · attempt {p.attemptCount}
                      </span>
                    )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap line-clamp-3">
                    {p.caption}
                  </div>
                  {p.linkUrl && p.trackedSlug && (
                    <div className="text-xs text-gray-600 mt-1">
                      Tracked link:{" "}
                      <a
                        href={`/go/${p.trackedSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        /go/{p.trackedSlug}
                      </a>{" "}
                      → {p.linkUrl}
                    </div>
                  )}
                  {p.errorMessage && (
                    <div className="text-xs text-red-700 mt-1">
                      Error: {p.errorMessage}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {p.externalPermalink && (
                    <a
                      href={p.externalPermalink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 underline flex items-center gap-1"
                    >
                      View live <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {p.status === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retry.mutate(p.id)}
                    >
                      Retry
                    </Button>
                  )}
                  {p.status !== "posted" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Delete this queued post?")) remove.mutate(p.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
