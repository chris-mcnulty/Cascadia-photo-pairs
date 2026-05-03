import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

interface DryRunRow {
  rowIndex: number;
  platform: "instagram" | "facebook";
  caption: string;
  mediaUrls: string[];
  link?: string;
  scheduledAt: string;
  utmCampaign?: string;
  firstComment?: string;
  accountId: string;
  accountName: string;
  errors: string[];
  warnings: string[];
}
interface DryRun {
  filename: string;
  rows: DryRunRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

const SAMPLE_CSV = `platform,caption,image_url,additional_image_urls,link,scheduled_at,utm_campaign,first_comment,account
instagram,"New print drop! Find it at {{link}}",https://example.com/img1.jpg,,https://chrismcnulty.net/store/sample,2026-05-04T10:00:00Z,spring2026,#cascadiaoceanic,
facebook,"Now shipping. {{link}}",https://example.com/img1.jpg,,https://chrismcnulty.net/store,now,spring2026,,
instagram,"Triptych carousel",https://example.com/a.jpg,https://example.com/b.jpg;https://example.com/c.jpg,https://chrismcnulty.net/portfolio,2026-05-05T15:00:00Z,spring2026,,`;

export default function SocialImport() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [skipImageValidation, setSkipImageValidation] = useState(false);
  const [dryRun, setDryRun] = useState<DryRun | null>(null);

  const dryMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pick a CSV first");
      const fd = new FormData();
      fd.append("file", file);
      if (skipImageValidation) fd.append("skipImageValidation", "true");
      const sessionId = localStorage.getItem("admin-session-id");
      const authToken = localStorage.getItem("auth-token");
      const headers: Record<string, string> = {};
      if (sessionId) headers["x-session-id"] = sessionId;
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      const res = await fetch("/api/admin/social/csv/dry-run", {
        method: "POST",
        body: fd,
        headers,
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as DryRun;
    },
    onSuccess: (data) => setDryRun(data),
    onError: (e: any) =>
      toast({ title: "Dry-run failed", description: e.message, variant: "destructive" }),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pick a CSV first");
      const fd = new FormData();
      fd.append("file", file);
      if (campaignName) fd.append("campaignName", campaignName);
      if (skipImageValidation) fd.append("skipImageValidation", "true");
      const sessionId = localStorage.getItem("admin-session-id");
      const authToken = localStorage.getItem("auth-token");
      const headers: Record<string, string> = {};
      if (sessionId) headers["x-session-id"] = sessionId;
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      const res = await fetch("/api/admin/social/csv/commit", {
        method: "POST",
        body: fd,
        headers,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Queued",
        description: `${data.inserted} posts queued; ${data.skipped} rows skipped`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/imports"] });
      setDryRun(null);
      setFile(null);
    },
    onError: (e: any) =>
      toast({ title: "Commit failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import CSV → Social Posts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>CSV file</Label>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setDryRun(null);
              }}
              data-testid="input-social-csv"
            />
          </div>
          <div>
            <Label>Campaign name (default UTM)</Label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. spring2026"
            />
          </div>
          <div className="flex items-end">
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={skipImageValidation}
                onChange={(e) => setSkipImageValidation(e.target.checked)}
              />
              Skip image-URL HEAD check (faster, less safe)
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => dryMutation.mutate()}
            disabled={!file || dryMutation.isPending}
            variant="outline"
            data-testid="button-social-dry-run"
          >
            <Upload className="w-4 h-4 mr-2" />
            {dryMutation.isPending ? "Validating…" : "Dry-run"}
          </Button>
          <Button
            onClick={() => commitMutation.mutate()}
            disabled={!dryRun || dryRun.validRows === 0 || commitMutation.isPending}
            data-testid="button-social-commit"
          >
            Queue {dryRun?.validRows ?? 0} posts
          </Button>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer flex items-center gap-2 text-gray-600">
            <FileText className="w-4 h-4" /> View sample CSV
          </summary>
          <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto mt-2">
            {SAMPLE_CSV}
          </pre>
          <p className="text-xs text-gray-500 mt-2">
            Columns: platform, caption, image_url, additional_image_urls
            (semicolon-separated for IG carousels), link, scheduled_at (ISO or
            "now"), utm_campaign, first_comment, account. Use{" "}
            <code>{"{{link}}"}</code> in caption to insert the tracked URL.
          </p>
        </details>

        {dryRun && (
          <div>
            <div className="flex gap-3 mb-2 text-sm">
              <Badge variant="outline">{dryRun.totalRows} total</Badge>
              <Badge className="bg-green-600">{dryRun.validRows} valid</Badge>
              {dryRun.invalidRows > 0 && (
                <Badge variant="destructive">{dryRun.invalidRows} with errors</Badge>
              )}
            </div>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Platform</th>
                    <th className="p-2 text-left">Account</th>
                    <th className="p-2 text-left">Caption</th>
                    <th className="p-2 text-left">Media</th>
                    <th className="p-2 text-left">Scheduled</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dryRun.rows.map((r) => (
                    <tr
                      key={r.rowIndex}
                      className={r.errors.length ? "bg-red-50" : ""}
                      data-testid={`row-dryrun-${r.rowIndex}`}
                    >
                      <td className="p-2">{r.rowIndex}</td>
                      <td className="p-2">{r.platform}</td>
                      <td className="p-2">{r.accountName}</td>
                      <td className="p-2 max-w-xs truncate">{r.caption}</td>
                      <td className="p-2">
                        {r.mediaUrls.length > 1
                          ? `${r.mediaUrls.length} (carousel)`
                          : "1"}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {new Date(r.scheduledAt).toLocaleString()}
                      </td>
                      <td className="p-2">
                        {r.errors.length ? (
                          <span className="text-red-700 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 mt-0.5" />
                            <span>{r.errors.join("; ")}</span>
                          </span>
                        ) : (
                          <span className="text-green-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> ok
                            {r.warnings.length > 0 && (
                              <span className="text-amber-700 ml-1">
                                ({r.warnings.join("; ")})
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
