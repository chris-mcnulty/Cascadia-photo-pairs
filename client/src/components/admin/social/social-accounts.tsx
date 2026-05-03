import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface SocialAccount {
  id: string;
  platform: "instagram" | "facebook";
  displayName: string;
  externalId: string;
  pageId: string | null;
  tokenLastFour: string | null;
  tokenExpiresAt: string | null;
  tokenConfigured: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function SocialAccounts() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    platform: "instagram" as "instagram" | "facebook",
    displayName: "",
    pageId: "",
    igUserId: "",
    accessToken: "",
  });
  const [validation, setValidation] = useState<{ ok: boolean; msg: string } | null>(null);
  const [savedDisplay, setSavedDisplay] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery<SocialAccount[]>({
    queryKey: ["/api/admin/social/accounts"],
  });

  const validate = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/social/accounts/validate", form);
      return r.json();
    },
    onSuccess: (data: any) => {
      if (data.ok) {
        setValidation({ ok: true, msg: `Found: ${data.displayName} (id ${data.externalId})` });
        if (!form.displayName) setForm((f) => ({ ...f, displayName: data.displayName }));
      } else {
        setValidation({ ok: false, msg: data.error || "Validation failed" });
      }
    },
    onError: (e: any) => setValidation({ ok: false, msg: e.message }),
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/social/accounts", form);
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/accounts"] });
      setSavedDisplay(data.displayName || "Account");
      toast({ title: "Account connected", description: data.displayName });
    },
    onError: (e: any) =>
      toast({ title: "Could not connect", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async (a: SocialAccount) => {
      const r = await apiRequest("PATCH", `/api/admin/social/accounts/${a.id}`, {
        isActive: !a.isActive,
      });
      return r.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/accounts"] }),
  });

  const remove = useMutation({
    mutationFn: async (a: SocialAccount) => {
      const r = await apiRequest("DELETE", `/api/admin/social/accounts/${a.id}`);
      return r.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/accounts"] }),
  });

  const reset = () => {
    setForm({
      platform: "instagram",
      displayName: "",
      pageId: "",
      igUserId: "",
      accessToken: "",
    });
    setValidation(null);
    setSavedDisplay(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Connected Social Accounts</CardTitle>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-connect-social">
              <Plus className="w-4 h-4 mr-2" /> Connect Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Connect Instagram or Facebook</DialogTitle>
            </DialogHeader>
            {savedDisplay ? (
              <div className="space-y-3">
                <p className="text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {savedDisplay} connected.
                </p>
                <p className="text-sm text-gray-700">
                  Your access token has been encrypted and stored in the
                  database. It survives restarts and is never returned by any
                  read endpoint. To rotate it, remove this account and connect
                  again with a fresh token.
                </p>
                <DialogFooter>
                  <Button onClick={() => setOpen(false)}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Platform</Label>
                  <Select
                    value={form.platform}
                    onValueChange={(v: any) => setForm((f) => ({ ...f, platform: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram Business</SelectItem>
                      <SelectItem value="facebook">Facebook Page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Display name</Label>
                  <Input
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    placeholder="Cascadia Oceanic"
                  />
                </div>
                {form.platform === "facebook" ? (
                  <div>
                    <Label>Facebook Page ID</Label>
                    <Input
                      value={form.pageId}
                      onChange={(e) => setForm({ ...form, pageId: e.target.value })}
                      placeholder="1234567890"
                    />
                  </div>
                ) : (
                  <div>
                    <Label>Instagram User ID</Label>
                    <Input
                      value={form.igUserId}
                      onChange={(e) => setForm({ ...form, igUserId: e.target.value })}
                      placeholder="17841400000000000"
                    />
                  </div>
                )}
                <div>
                  <Label>Long-lived Page Access Token</Label>
                  <Input
                    type="password"
                    value={form.accessToken}
                    onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                    placeholder="EAAB…"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Generated via Meta Graph Explorer. Token is never displayed
                    after saving and never returned by the API.
                  </p>
                </div>
                {validation && (
                  <p
                    className={`text-sm flex items-center gap-2 ${validation.ok ? "text-green-700" : "text-red-700"}`}
                  >
                    {validation.ok ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    {validation.msg}
                  </p>
                )}
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    disabled={validate.isPending || !form.accessToken}
                    onClick={() => validate.mutate()}
                  >
                    Test token
                  </Button>
                  <Button
                    disabled={create.isPending || !form.accessToken}
                    onClick={() => create.mutate()}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-gray-500">
            No social accounts connected yet. Use “Connect Account” to add an
            Instagram Business or Facebook Page.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between border rounded p-3"
                data-testid={`row-social-account-${a.id}`}
              >
                <div className="flex items-center gap-3">
                  <Badge variant={a.platform === "instagram" ? "default" : "secondary"}>
                    {a.platform}
                  </Badge>
                  <div>
                    <div className="font-medium">{a.displayName}</div>
                    <div className="text-xs text-gray-500">
                      ID {a.externalId} · token …{a.tokenLastFour || "????"}
                      {!a.tokenConfigured && (
                        <span className="text-red-600 ml-2">
                          (token missing — reconnect this account)
                        </span>
                      )}
                      {a.tokenExpiresAt && (
                        <span className="ml-2">
                          expires {new Date(a.tokenExpiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={a.isActive}
                    onCheckedChange={() => toggleActive.mutate(a)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Remove ${a.displayName}?`)) remove.mutate(a);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
