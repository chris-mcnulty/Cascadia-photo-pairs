import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertUrlRedirectSchema } from "@shared/schema";
import type { UrlRedirect, NotFoundLog } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ArrowRight, ExternalLink, CheckCircle, Eye, EyeOff, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const redirectFormSchema = insertUrlRedirectSchema.extend({
  sourcePath: z.string().min(1, "Source path is required").startsWith("/", "Must start with /"),
  targetPath: z.string().min(1, "Target path is required"),
  statusCode: z.coerce.number().int().refine((v) => v === 301 || v === 302, "Must be 301 or 302"),
  matchType: z.enum(["exact", "prefix"]).default("exact"),
});

type RedirectFormValues = z.infer<typeof redirectFormSchema>;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ────────────────────────────── Redirects Tab ──────────────────────────────

// ── Client-side matching logic (mirrors server/redirects.ts) ──────────────────

type ClientRule = {
  id: string;
  sourcePath: string;
  sourceHost: string | null;
  targetPath: string;
  statusCode: number;
  matchType: string;
  active: boolean;
};

function canonicalizePrefixPath(p: string): string {
  return p.endsWith("/*") ? p.slice(0, -2) : p;
}

type TestResult =
  | { matched: true; rule: ClientRule }
  | { matched: false };

function runClientMatch(
  testPath: string,
  testHost: string,
  rules: ClientRule[]
): TestResult {
  if (!testPath || !testPath.startsWith("/")) return { matched: false };

  const activeRules = rules.filter((r) => r.active);
  const exact = activeRules.filter((r) => r.matchType !== "prefix");
  const prefix = activeRules
    .filter((r) => r.matchType === "prefix")
    .map((r) => ({ ...r, sourcePath: canonicalizePrefixPath(r.sourcePath) }));

  const host = testHost.trim();

  for (const rule of exact) {
    const pathOk = rule.sourcePath === testPath;
    const hostOk = !rule.sourceHost || rule.sourceHost === host;
    if (pathOk && hostOk) return { matched: true, rule };
  }

  let best: ClientRule | null = null;
  for (const rule of prefix) {
    const hostOk = !rule.sourceHost || rule.sourceHost === host;
    if (!hostOk) continue;
    const pfx = rule.sourcePath.endsWith("/") ? rule.sourcePath : rule.sourcePath + "/";
    const pathOk = testPath === rule.sourcePath || testPath.startsWith(pfx);
    if (pathOk) {
      if (!best || rule.sourcePath.length > best.sourcePath.length) best = rule;
    }
  }
  if (best) return { matched: true, rule: best };

  return { matched: false };
}

// ─────────────────────────────────────────────────────────────────────────────

function RedirectDialog({
  open,
  onClose,
  existing,
  prefillPath,
}: {
  open: boolean;
  onClose: () => void;
  existing?: UrlRedirect;
  prefillPath?: string;
}) {
  const { toast } = useToast();
  const [testPath, setTestPath] = useState("");
  const [testHost, setTestHost] = useState("");

  const form = useForm<RedirectFormValues>({
    resolver: zodResolver(redirectFormSchema),
    defaultValues: {
      sourcePath: existing?.sourcePath ?? prefillPath ?? "/",
      sourceHost: existing?.sourceHost ?? "",
      targetPath: existing?.targetPath ?? "/",
      statusCode: existing?.statusCode ?? 301,
      matchType: (existing?.matchType as "exact" | "prefix") ?? "exact",
      active: existing?.active ?? true,
      notes: existing?.notes ?? "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: RedirectFormValues) =>
      apiRequest("POST", "/api/admin/redirects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects"] });
      toast({ title: "Redirect created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to create redirect", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: RedirectFormValues) =>
      apiRequest("PATCH", `/api/admin/redirects/${existing!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects"] });
      toast({ title: "Redirect updated" });
      onClose();
    },
    onError: () => toast({ title: "Failed to update redirect", variant: "destructive" }),
  });

  function onSubmit(data: RedirectFormValues) {
    const payload = { ...data, sourceHost: data.sourceHost || null };
    if (existing) updateMutation.mutate(payload as any);
    else createMutation.mutate(payload as any);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Watch all form fields reactively so the tester reflects unsaved edits
  const fv = useWatch({ control: form.control });
  const matchType = fv.matchType ?? "exact";

  // Fetch the saved redirect list (reads from TanStack cache — no extra request)
  const { data: savedRedirects = [] } = useQuery<UrlRedirect[]>({
    queryKey: ["/api/admin/redirects"],
    queryFn: async () => {
      const res = await fetch("/api/admin/redirects", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Build the effective rule set: saved rules (minus the one being edited) + current form values
  const effectiveRules: ClientRule[] = [
    ...savedRedirects
      .filter((r) => r.id !== existing?.id)
      .map((r) => ({
        id: r.id,
        sourcePath: r.sourcePath,
        sourceHost: r.sourceHost,
        targetPath: r.targetPath,
        statusCode: r.statusCode,
        matchType: r.matchType ?? "exact",
        active: r.active,
      })),
    {
      id: existing?.id ?? "__new__",
      sourcePath: fv.sourcePath ?? "/",
      sourceHost: fv.sourceHost || null,
      targetPath: fv.targetPath ?? "/",
      statusCode: fv.statusCode ?? 301,
      matchType: fv.matchType ?? "exact",
      active: fv.active ?? true,
    },
  ];

  const testResult: TestResult | null =
    testPath ? runClientMatch(testPath, testHost, effectiveRules) : null;

  // Detect whether any saved rule uses a host filter, to show the host test input
  const anyHostFiltered = effectiveRules.some((r) => r.sourceHost);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Redirect" : "Add Redirect"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sourcePath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Path</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={matchType === "prefix" ? "/product-page/*" : "/old-page"}
                      {...field}
                    />
                  </FormControl>
                  {matchType === "prefix" && (
                    <p className="text-xs text-gray-500">
                      Matches any path starting with this prefix. You can write{" "}
                      <code className="font-mono">/product-page/*</code> or just{" "}
                      <code className="font-mono">/product-page</code> — both work the same.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sourceHost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Host <span className="text-gray-400 font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="voting.chrismcnulty.net" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Path</FormLabel>
                  <FormControl>
                    <Input placeholder="/new-page or https://…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="statusCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status Code</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="301">301 — Permanent</SelectItem>
                      <SelectItem value="302">302 — Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="matchType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Match Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="exact">Exact — path must match exactly</SelectItem>
                      <SelectItem value="prefix">Prefix — matches any path starting with source</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes <span className="text-gray-400 font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormLabel className="mb-0">Active</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* ── Rule Tester ─────────────────────────────────────────── */}
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5" />
                Test this rule
              </p>
              <div className={`grid gap-2 ${anyHostFiltered ? "grid-cols-2" : "grid-cols-1"}`}>
                <Input
                  placeholder="/path-to-test"
                  value={testPath}
                  onChange={(e) => setTestPath(e.target.value)}
                  className="font-mono text-sm h-8"
                />
                {anyHostFiltered && (
                  <Input
                    placeholder="hostname (optional)"
                    value={testHost}
                    onChange={(e) => setTestHost(e.target.value)}
                    className="font-mono text-sm h-8"
                  />
                )}
              </div>
              {testResult === null && (
                <p className="text-xs text-gray-400">
                  Type a path above to see which rule would fire — includes your unsaved edits.
                </p>
              )}
              {testResult !== null && testResult.matched && (
                <div className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-600" />
                  <span>
                    Matched by{" "}
                    <code className="font-mono bg-green-100 px-0.5 rounded">
                      {testResult.rule.sourcePath}
                    </code>{" "}
                    <Badge variant="secondary" className="text-xs mx-0.5">
                      {testResult.rule.matchType}
                    </Badge>
                    {" → "}
                    <code className="font-mono bg-green-100 px-0.5 rounded">
                      {testResult.rule.targetPath}
                    </code>{" "}
                    <Badge className="text-xs">{testResult.rule.statusCode}</Badge>
                    {testResult.rule.id === "__new__" || testResult.rule.id === existing?.id ? (
                      <span className="ml-1 text-green-600 italic">(this rule)</span>
                    ) : null}
                  </span>
                </div>
              )}
              {testResult !== null && !testResult.matched && (
                <div className="flex items-center gap-2 rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-500">
                  No rule matches — this path would pass through unchanged.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : existing ? "Save Changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function RedirectsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UrlRedirect | undefined>();

  const { data: redirects = [], isLoading } = useQuery<UrlRedirect[]>({
    queryKey: ["/api/admin/redirects"],
    queryFn: async () => {
      const res = await fetch("/api/admin/redirects", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest("PATCH", `/api/admin/redirects/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects"] }),
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/redirects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects"] });
      toast({ title: "Redirect deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  function openAdd() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(r: UrlRedirect) {
    setEditing(r);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Redirect incoming paths to new destinations before the page loads.
        </p>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" /> Add Redirect
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
      ) : redirects.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">No redirects configured yet.</div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-16">Code</TableHead>
                <TableHead className="w-20">Hits</TableHead>
                <TableHead className="w-32">Last Hit</TableHead>
                <TableHead className="w-20">Active</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {redirects.map((r) => (
                <TableRow key={r.id} className={!r.active ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs">
                    {r.sourceHost && (
                      <span className="text-gray-400">{r.sourceHost}</span>
                    )}
                    {r.sourcePath}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                      {r.targetPath}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.matchType === "prefix" ? "outline" : "secondary"} className="text-xs">
                      {r.matchType === "prefix" ? "Prefix" : "Exact"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.statusCode === 301 ? "default" : "secondary"}>
                      {r.statusCode}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.hitCount.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-gray-500">{formatDate(r.lastHitAt)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={r.active}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, active: v })}
                      disabled={toggleMutation.isPending}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this redirect?")) deleteMutation.mutate(r.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RedirectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        existing={editing}
      />
    </div>
  );
}

// ────────────────────────────── 404 Log Tab ──────────────────────────────

function NotFoundLogTab({ onCreateRedirect }: { onCreateRedirect: (path: string) => void }) {
  const { toast } = useToast();
  const [showResolved, setShowResolved] = useState(false);

  const { data: entries = [], isLoading } = useQuery<NotFoundLog[]>({
    queryKey: ["/api/admin/404-log", showResolved],
    queryFn: async () => {
      const url = `/api/admin/404-log?resolved=${showResolved}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      apiRequest("PATCH", `/api/admin/404-log/${id}`, { resolved }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/404-log"] });
      toast({ title: "Entry updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Broken URLs visitors have hit, sorted by most traffic. Create a redirect to fix them.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowResolved((v) => !v)}
          className="flex items-center gap-2"
        >
          {showResolved ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showResolved ? "Hide Resolved" : "Show Resolved"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">
          {showResolved ? "No resolved entries." : "No unresolved 404s logged yet."}
        </div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead className="w-20">Hits</TableHead>
                <TableHead className="w-40">Last Referrer</TableHead>
                <TableHead className="w-28">First Seen</TableHead>
                <TableHead className="w-28">Last Seen</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id} className={e.resolved ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate">
                    <span title={e.path}>{e.path}</span>
                    {e.resolved && (
                      <Badge variant="secondary" className="ml-2 text-xs">resolved</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{e.hitCount.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-[160px] truncate">
                    {e.lastReferrer ? (
                      <span title={e.lastReferrer}>
                        {e.lastReferrer.replace(/^https?:\/\//, "")}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{formatDate(e.firstSeenAt)}</TableCell>
                  <TableCell className="text-xs text-gray-500">{formatDate(e.lastSeenAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => onCreateRedirect(e.path)}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Redirect
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title={e.resolved ? "Mark unresolved" : "Mark resolved"}
                        onClick={() =>
                          resolveMutation.mutate({ id: e.id, resolved: !e.resolved })
                        }
                      >
                        <CheckCircle
                          className={`w-4 h-4 ${e.resolved ? "text-green-500" : "text-gray-300"}`}
                        />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────── Main Component ──────────────────────────────

export default function SiteManagement() {
  const [activeTab, setActiveTab] = useState("redirects");
  const [redirectDialogOpen, setRedirectDialogOpen] = useState(false);
  const [prefillPath, setPrefillPath] = useState<string | undefined>();

  function handleCreateRedirectFrom404(path: string) {
    setPrefillPath(path);
    setActiveTab("redirects");
    setRedirectDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-medium text-gray-900">Site</h2>
        <p className="text-gray-500 text-sm mt-1">URL redirects and broken link tracking</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="redirects">Redirects</TabsTrigger>
          <TabsTrigger value="404-log">404 Log</TabsTrigger>
        </TabsList>

        <TabsContent value="redirects" className="mt-4">
          <RedirectsTab />
          <RedirectDialog
            open={redirectDialogOpen}
            onClose={() => {
              setRedirectDialogOpen(false);
              setPrefillPath(undefined);
            }}
            prefillPath={prefillPath}
          />
        </TabsContent>

        <TabsContent value="404-log" className="mt-4">
          <NotFoundLogTab onCreateRedirect={handleCreateRedirectFrom404} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
