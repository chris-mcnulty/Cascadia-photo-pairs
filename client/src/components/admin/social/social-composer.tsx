import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface SocialAccount {
  id: string;
  platform: "instagram" | "facebook";
  displayName: string;
  isActive: boolean;
}

export default function SocialComposer() {
  const { toast } = useToast();
  const { data: accounts = [] } = useQuery<SocialAccount[]>({
    queryKey: ["/api/admin/social/accounts"],
  });
  const { data: quota = {} } = useQuery<
    Record<string, { used: number; cap: number; remaining: number }>
  >({ queryKey: ["/api/admin/social/quota"], refetchInterval: 60_000 });

  const [accountId, setAccountId] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");
  const [link, setLink] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const acc = accounts.find((a) => a.id === accountId);
      if (!acc) throw new Error("Pick an account");
      const urls = mediaUrls
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!urls.length) throw new Error("At least one image URL is required");
      const r = await apiRequest("POST", "/api/admin/social/posts", {
        accountId,
        platform: acc.platform,
        caption,
        mediaUrls: urls,
        linkUrl: link || null,
        utmCampaign: utmCampaign || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Queued", description: "Post added to the queue" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/posts"] });
      setCaption("");
      setMediaUrls("");
      setLink("");
      setScheduledAt("");
    },
    onError: (e: any) =>
      toast({ title: "Failed to queue", description: e.message, variant: "destructive" }),
  });

  const activeAccounts = accounts.filter((a) => a.isActive);
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const accountQuota =
    selectedAccount?.platform === "instagram" ? quota[selectedAccount.id] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compose Single Post</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
              <SelectContent>
                {activeAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.platform} · {a.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accountQuota && (
              <p className="text-xs text-gray-600 mt-1">
                Instagram remaining today: {accountQuota.remaining}/{accountQuota.cap}
              </p>
            )}
          </div>
          <div>
            <Label>Schedule (leave blank for now)</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>Caption (use {"{{link}}"} to insert tracked URL)</Label>
          <Textarea
            rows={4}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={`New print drop — see it at {{link}}`}
            data-testid="textarea-composer-caption"
          />
        </div>
        <div>
          <Label>Image URLs (one per line; 2-10 = IG carousel)</Label>
          <Textarea
            rows={3}
            value={mediaUrls}
            onChange={(e) => setMediaUrls(e.target.value)}
            placeholder="https://example.com/photo.jpg"
          />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Destination link (optional)</Label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://chrismcnulty.net/store/sample"
            />
          </div>
          <div>
            <Label>UTM campaign (optional)</Label>
            <Input
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              placeholder="spring2026"
            />
          </div>
        </div>
        <Button
          onClick={() => create.mutate()}
          disabled={create.isPending || !accountId}
          data-testid="button-composer-queue"
        >
          {create.isPending ? "Queueing…" : "Queue post"}
        </Button>
      </CardContent>
    </Card>
  );
}
