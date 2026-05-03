import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2,
  Plus,
  Trash2,
  Send,
  Mail,
  Users,
  RefreshCw,
  Upload,
  TestTube,
} from "lucide-react";

type Contact = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  source: string;
  marketingOptIn: boolean;
  unsubscribedAt: string | null;
  lastEmailedAt: string | null;
  tags: string[];
  listIds: string[];
  createdAt: string;
};
type ContactList = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
};
type Campaign = {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  bodyHtml: string;
  listId: string | null;
  status: string;
  sentCount: number;
  failedCount: number;
  unsubscribedCount: number;
  totalRecipients: number;
  scheduledFor: string | null;
  sentAt: string | null;
  createdAt: string;
};
type Recipient = {
  id: string;
  campaignId: string;
  contactId: string;
  email: string;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
};

type ContactCampaignHistory = {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignSubject: string;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
};

export default function EmailCampaigns() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Marketing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="campaigns">
          <TabsList>
            <TabsTrigger value="campaigns" data-testid="tab-campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="lists" data-testid="tab-lists">Lists</TabsTrigger>
            <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts</TabsTrigger>
          </TabsList>
          <TabsContent value="campaigns" className="pt-4">
            <CampaignsPanel />
          </TabsContent>
          <TabsContent value="lists" className="pt-4">
            <ListsPanel />
          </TabsContent>
          <TabsContent value="contacts" className="pt-4">
            <ContactsPanel />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// =================== CONTACTS ===================
function ContactsPanel() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [optIn, setOptIn] = useState<"all" | "in" | "out">("all");
  const [source, setSource] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [listFilter, setListFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [detail, setDetail] = useState<Contact | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/admin/contacts", search, optIn, source, tag, listFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (optIn !== "all") p.set("optIn", optIn);
      if (source !== "all") p.set("source", source);
      if (tag !== "all") p.set("tag", tag);
      if (listFilter !== "all") p.set("listId", listFilter);
      const r = await fetch(`/api/admin/contacts?${p.toString()}`, {
        credentials: "include",
        headers: authHeaders(),
      });
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
  });

  const { data: tagOptions = [] } = useQuery<string[]>({ queryKey: ["/api/admin/contacts/tags"] });
  const { data: lists = [] } = useQuery<ContactList[]>({ queryKey: ["/api/admin/contact-lists"] });

  const bulkOptInMut = useMutation({
    mutationFn: async (optInValue: boolean) =>
      apiRequest("POST", "/api/admin/contacts/bulk-opt-in", {
        contactIds: Array.from(selected),
        optIn: optInValue,
      }),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: "Updated", description: `${data.updated} contacts updated.` });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
    },
    onError: (e: Error) => toast({ title: "Bulk update failed", description: e.message, variant: "destructive" }),
  });

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(contacts.map((c) => c.id)) : new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const backfillMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/contacts/backfill"),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({
        title: "Backfill complete",
        description: `Added ${data.created} new contacts (${data.skipped} already existed).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
    },
    onError: (e: Error) => toast({ title: "Backfill failed", description: e.message, variant: "destructive" }),
  });

  const optInMut = useMutation({
    mutationFn: async ({ id, optIn }: { id: string; optIn: boolean }) =>
      apiRequest("POST", `/api/admin/contacts/${id}/opt-in`, { optIn }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/contacts/${id}`),
    onSuccess: () => {
      toast({ title: "Contact deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
    },
  });

  const importMut = useMutation({
    mutationFn: async () => {
      const rows = parseCsv(importText);
      return apiRequest("POST", "/api/admin/contacts/import", { rows });
    },
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: "Import complete", description: `Created ${data.created}, skipped ${data.skipped}.` });
      setShowImport(false);
      setImportText("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
    },
    onError: (e: Error) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
          data-testid="input-contacts-search"
        />
        <Select
          value={optIn}
          onValueChange={(v) => setOptIn(v === "in" || v === "out" ? v : "all")}
        >
          <SelectTrigger className="w-40" data-testid="select-optin">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All contacts</SelectItem>
            <SelectItem value="in">Opted in</SelectItem>
            <SelectItem value="out">Opted out</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-40" data-testid="select-source"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any source</SelectItem>
            <SelectItem value="user">User signup</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="csv">CSV import</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="w-40" data-testid="select-tag"><SelectValue placeholder="Any tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any tag</SelectItem>
            {tagOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={listFilter} onValueChange={setListFilter}>
          <SelectTrigger className="w-44" data-testid="select-list-filter"><SelectValue placeholder="Any list" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any list</SelectItem>
            {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => backfillMut.mutate()}
            disabled={backfillMut.isPending}
            data-testid="button-backfill"
          >
            {backfillMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Backfill from users/customers
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)} data-testid="button-import">
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-contact">
            <Plus className="w-4 h-4 mr-2" />
            Add contact
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded">
          <span className="text-sm">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkOptInMut.mutate(true)} disabled={bulkOptInMut.isPending} data-testid="button-bulk-opt-in">Opt in</Button>
          <Button size="sm" variant="outline" onClick={() => bulkOptInMut.mutate(false)} disabled={bulkOptInMut.isPending} data-testid="button-bulk-opt-out">Opt out</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : (
        <div className="border rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2 w-8"><input type="checkbox" checked={contacts.length > 0 && selected.size === contacts.length} onChange={(e) => toggleAll(e.target.checked)} data-testid="checkbox-all" /></th>
                <th className="p-2">Email</th>
                <th className="p-2">Name</th>
                <th className="p-2">Source</th>
                <th className="p-2">Status</th>
                <th className="p-2">Last emailed</th>
                <th className="p-2">Tags</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-gray-500">No contacts.</td></tr>
              )}
              {contacts.map((c) => (
                <tr key={c.id} className="border-t" data-testid={`row-contact-${c.id}`}>
                  <td className="p-2"><input type="checkbox" checked={selected.has(c.id)} onChange={(e) => toggleOne(c.id, e.target.checked)} data-testid={`checkbox-${c.id}`} /></td>
                  <td className="p-2 font-mono text-xs">
                    <button className="text-cascadia-blue hover:underline" onClick={() => setDetail(c)} data-testid={`button-detail-${c.id}`}>{c.email}</button>
                  </td>
                  <td className="p-2">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                  <td className="p-2"><Badge variant="secondary">{c.source}</Badge></td>
                  <td className="p-2">
                    {c.unsubscribedAt || !c.marketingOptIn ? (
                      <Badge variant="destructive">Opted out</Badge>
                    ) : (
                      <Badge className="bg-green-600">Opted in</Badge>
                    )}
                  </td>
                  <td className="p-2 text-xs whitespace-nowrap">{c.lastEmailedAt ? new Date(c.lastEmailedAt).toLocaleDateString() : "—"}</td>
                  <td className="p-2 text-xs">{(c.tags || []).join(", ")}</td>
                  <td className="p-2 text-right space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(c)}
                      data-testid={`button-edit-contact-${c.id}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => optInMut.mutate({ id: c.id, optIn: !(c.marketingOptIn && !c.unsubscribedAt) })}
                      data-testid={`button-toggle-${c.id}`}
                    >
                      Toggle
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete ${c.email}?`)) deleteMut.mutate(c.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">{contacts.length} contact(s) shown.</p>

      <AddContactDialog open={showAdd} onOpenChange={setShowAdd} />
      {editing && <EditContactDialog contact={editing} onClose={() => setEditing(null)} />}
      {detail && <ContactDetailDialog contact={detail} onClose={() => setDetail(null)} />}

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import contacts (CSV)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>CSV with header row: email, firstName, lastName, tags</Label>
            <Textarea
              rows={10}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="email,firstName,lastName,tags
jane@example.com,Jane,Doe,vip;newsletter"
              data-testid="textarea-import"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
            <Button onClick={() => importMut.mutate()} disabled={!importText.trim() || importMut.isPending} data-testid="button-import-submit">
              {importMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddContactDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [optIn, setOptIn] = useState(true);

  const mut = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/admin/contacts", {
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        source: "manual",
        marketingOptIn: optIn,
        tags: [],
      }),
    onSuccess: () => {
      toast({ title: "Contact added" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      setEmail(""); setFirstName(""); setLastName(""); setOptIn(true);
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Email *</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-new-email" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="optInNew" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
            <label htmlFor="optInNew" className="text-sm">Opted into marketing emails</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!email.includes("@") || mut.isPending} data-testid="button-create-contact">
            {mut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditContactDialog({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState(contact.firstName || "");
  const [lastName, setLastName] = useState(contact.lastName || "");
  const [tags, setTags] = useState((contact.tags || []).join(", "));
  const [optIn, setOptIn] = useState(contact.marketingOptIn && !contact.unsubscribedAt);

  const mut = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/admin/contacts/${contact.id}`, {
        firstName: firstName || null,
        lastName: lastName || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        marketingOptIn: optIn,
      }),
    onSuccess: () => {
      toast({ title: "Contact updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input value={contact.email} disabled />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed (used as identity key).</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="input-edit-firstname" /></div>
            <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-edit-lastname" /></div>
          </div>
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, newsletter" data-testid="input-edit-tags" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="editOptIn" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
            <label htmlFor="editOptIn" className="text-sm">Opted into marketing emails</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} data-testid="button-save-contact">
            {mut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactDetailDialog({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const { data: history = [], isLoading } = useQuery<ContactCampaignHistory[]>({
    queryKey: ["/api/admin/contacts", contact.id, "campaigns"],
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact: {contact.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><strong>Name:</strong> {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"}</div>
            <div><strong>Source:</strong> {contact.source}</div>
            <div><strong>Status:</strong> {contact.unsubscribedAt || !contact.marketingOptIn ? "Opted out" : "Opted in"}</div>
            <div><strong>Last emailed:</strong> {contact.lastEmailedAt ? new Date(contact.lastEmailedAt).toLocaleString() : "Never"}</div>
            <div className="col-span-2"><strong>Tags:</strong> {(contact.tags || []).join(", ") || "—"}</div>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-1">Campaign history</h4>
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-500">No campaigns yet.</p>
            ) : (
              <table className="w-full text-xs border rounded">
                <thead className="bg-gray-50 text-left">
                  <tr><th className="p-2">Campaign</th><th className="p-2">Status</th><th className="p-2">Sent</th></tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="p-2">{h.campaignName}<div className="text-gray-500">{h.campaignSubject}</div></td>
                      <td className="p-2"><Badge variant="secondary">{h.status}</Badge></td>
                      <td className="p-2">{h.sentAt ? new Date(h.sentAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListCampaignHistoryDialog({ list, onClose }: { list: ContactList; onClose: () => void }) {
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/admin/contact-lists", list.id, "campaigns"],
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Campaigns targeting "{list.name}"</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-gray-500">No campaigns have used this list.</p>
        ) : (
          <table className="w-full text-sm border rounded">
            <thead className="bg-gray-50 text-left">
              <tr><th className="p-2">Name</th><th className="p-2">Subject</th><th className="p-2">Status</th><th className="p-2">Sent</th></tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2 font-medium">{c.name}</td>
                  <td className="p-2">{c.subject}</td>
                  <td className="p-2"><CampaignStatusBadge status={c.status} /></td>
                  <td className="p-2 text-xs">{c.sentCount}/{c.totalRecipients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== LISTS ===================
function ListsPanel() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<ContactList | null>(null);

  const { data: lists = [], isLoading } = useQuery<ContactList[]>({
    queryKey: ["/api/admin/contact-lists"],
  });

  const createMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/contact-lists", { name, description: desc || null }),
    onSuccess: () => {
      toast({ title: "List created" });
      setName(""); setDesc(""); setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-lists"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/contact-lists/${id}`),
    onSuccess: () => {
      toast({ title: "List deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-lists"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-list">
          <Plus className="w-4 h-4 mr-2" />
          New list
        </Button>
      </div>
      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      ) : (
        <div className="border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Description</th>
                <th className="p-2">Members</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {lists.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">No lists yet.</td></tr>}
              {lists.map((l) => (
                <tr key={l.id} className="border-t" data-testid={`row-list-${l.id}`}>
                  <td className="p-2 font-medium">{l.name}</td>
                  <td className="p-2 text-gray-600">{l.description || "—"}</td>
                  <td className="p-2"><Badge variant="secondary">{l.memberCount}</Badge></td>
                  <td className="p-2 text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => setActiveListId(l.id)} data-testid={`button-manage-${l.id}`}>
                      <Users className="w-4 h-4 mr-1" /> Manage members
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setHistoryFor(l)} data-testid={`button-list-history-${l.id}`}>
                      <Mail className="w-4 h-4 mr-1" /> Campaigns
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete list "${l.name}"?`)) deleteMut.mutate(l.id); }}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>New contact list</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-list-name" /></div>
            <div><Label>Description</Label><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending} data-testid="button-create-list">
              {createMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeListId && (
        <ListMembersDialog listId={activeListId} onClose={() => setActiveListId(null)} />
      )}
      {historyFor && (
        <ListCampaignHistoryDialog list={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}

function ListMembersDialog({ listId, onClose }: { listId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/admin/contacts", search, "members"],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      const r = await fetch(`/api/admin/contacts?${p.toString()}`, {
        credentials: "include", headers: authHeaders(),
      });
      return r.json();
    },
  });

  const addMut = useMutation({
    mutationFn: async (contactId: string) =>
      apiRequest("POST", `/api/admin/contact-lists/${listId}/members`, { contactIds: [contactId] }),
    onSuccess: () => {
      toast({ title: "Added to list" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-lists"] });
    },
  });
  const removeMut = useMutation({
    mutationFn: async (contactId: string) =>
      apiRequest("DELETE", `/api/admin/contact-lists/${listId}/members`, { contactIds: [contactId] }),
    onSuccess: () => {
      toast({ title: "Removed from list" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-lists"] });
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Manage list members</DialogTitle></DialogHeader>
        <Input placeholder="Search contacts" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-member-search" />
        <div className="max-h-96 overflow-y-auto border rounded">
          <table className="w-full text-sm">
            <tbody>
              {contacts.map((c) => {
                const inList = c.listIds.includes(listId);
                return (
                  <tr key={c.id} className="border-t">
                    <td className="p-2 text-xs">{c.email}</td>
                    <td className="p-2">{[c.firstName, c.lastName].filter(Boolean).join(" ")}</td>
                    <td className="p-2 text-right">
                      {inList ? (
                        <Button size="sm" variant="outline" onClick={() => removeMut.mutate(c.id)} data-testid={`button-remove-${c.id}`}>Remove</Button>
                      ) : (
                        <Button size="sm" onClick={() => addMut.mutate(c.id)} data-testid={`button-add-${c.id}`}>Add</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== CAMPAIGNS ===================
function CampaignsPanel() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [recipientsFor, setRecipientsFor] = useState<Campaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/admin/campaigns"],
    // While any campaign is mid-send, poll so the dashboard counts stay live.
    refetchInterval: (q) =>
      (q.state.data as Campaign[] | undefined)?.some(
        (c) => c.status === "sending" || c.status === "queued",
      )
        ? 3000
        : false,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/campaigns/${id}`),
    onSuccess: () => {
      toast({ title: "Campaign deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-new-campaign">
          <Plus className="w-4 h-4 mr-2" /> New campaign
        </Button>
      </div>
      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      ) : (
        <div className="border rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Subject</th>
                <th className="p-2">Status</th>
                <th className="p-2">Sent</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">No campaigns yet.</td></tr>}
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t" data-testid={`row-campaign-${c.id}`}>
                  <td className="p-2 font-medium">{c.name}</td>
                  <td className="p-2">{c.subject}</td>
                  <td className="p-2"><CampaignStatusBadge status={c.status} /></td>
                  <td className="p-2 text-xs">
                    {c.sentCount}/{c.totalRecipients}
                    {c.failedCount > 0 ? ` (${c.failedCount} failed)` : ""}
                  </td>
                  <td className="p-2 text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => setRecipientsFor(c)} data-testid={`button-recipients-${c.id}`}>Recipients</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(c)} data-testid={`button-edit-${c.id}`}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteMut.mutate(c.id); }}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CampaignEditor onClose={() => setShowCreate(false)} />}
      {editing && <CampaignEditor campaign={editing} onClose={() => setEditing(null)} />}
      {recipientsFor && (
        <RecipientsDialog campaign={recipientsFor} onClose={() => setRecipientsFor(null)} />
      )}
    </div>
  );
}

function RecipientsDialog({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const [filter, setFilter] = useState<string>("all");
  const { data: recipients = [], isLoading } = useQuery<Recipient[]>({
    queryKey: ["/api/admin/campaigns", campaign.id, "recipients"],
    refetchInterval: campaign.status === "sending" || campaign.status === "queued" ? 3000 : false,
  });
  const filtered = filter === "all" ? recipients : recipients.filter((r) => r.status === filter);

  const exportFailures = () => {
    const failed = recipients.filter((r) => r.status === "failed");
    const lines = ["email,error", ...failed.map((r) => `${r.email},"${(r.errorMessage || "").replace(/"/g, '""')}"`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaign.name.replace(/[^a-z0-9]+/gi, "_")}_failures.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recipients — {campaign.name}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 mb-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44" data-testid="select-recipient-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({recipients.length})</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="claimed">In flight</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportFailures} data-testid="button-export-failures">
            Export failures (CSV)
          </Button>
          <span className="ml-auto text-xs text-gray-500">
            sent {campaign.sentCount} · failed {campaign.failedCount} · total {campaign.totalRecipients}
          </span>
        </div>
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        ) : (
          <div className="border rounded max-h-[55vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left sticky top-0">
                <tr>
                  <th className="p-2">Email</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Sent at</th>
                  <th className="p-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-gray-500">No recipients match this filter.</td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t" data-testid={`row-recipient-${r.id}`}>
                    <td className="p-2 font-mono text-xs">{r.email}</td>
                    <td className="p-2"><Badge variant="secondary">{r.status}</Badge></td>
                    <td className="p-2 text-xs">{r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}</td>
                    <td className="p-2 text-xs text-red-600">{r.errorMessage || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-gray-400",
    queued: "bg-blue-500",
    sending: "bg-yellow-500",
    sent: "bg-green-600",
    failed: "bg-red-600",
  };
  return <Badge className={map[status] || "bg-gray-400"}>{status}</Badge>;
}

function CampaignEditor({ campaign, onClose }: { campaign?: Campaign; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!campaign;
  const [name, setName] = useState(campaign?.name || "");
  const [subject, setSubject] = useState(campaign?.subject || "");
  const [bodyHtml, setBodyHtml] = useState(campaign?.bodyHtml || "");
  const [listId, setListId] = useState<string>(campaign?.listId || "");
  const [fromName, setFromName] = useState(campaign?.fromName || "");
  const [fromEmail, setFromEmail] = useState(campaign?.fromEmail || "");
  const [replyTo, setReplyTo] = useState(campaign?.replyTo || "");
  const [testEmail, setTestEmail] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string>("");

  const { data: lists = [] } = useQuery<ContactList[]>({ queryKey: ["/api/admin/contact-lists"] });

  type CampaignPayload = {
    name: string;
    subject: string;
    bodyHtml: string;
    listId: string | null;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: CampaignPayload = {
        name, subject, bodyHtml,
        listId: listId || null,
      };
      if (fromName) payload.fromName = fromName;
      if (fromEmail) payload.fromEmail = fromEmail;
      if (replyTo) payload.replyTo = replyTo;
      if (isEdit) return apiRequest("PATCH", `/api/admin/campaigns/${campaign!.id}`, payload);
      return apiRequest("POST", "/api/admin/campaigns", payload);
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Saved" : "Campaign created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      if (!isEdit) onClose();
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const testMut = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/campaigns/${campaign!.id}/test`, { to: testEmail }),
    onSuccess: () => toast({ title: "Test sent", description: `Sent to ${testEmail}` }),
    onError: (e: Error) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  const sendMut = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/campaigns/${campaign!.id}/send`),
    onSuccess: () => {
      toast({ title: "Sending started", description: "Campaign queued for delivery." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit campaign" : "New campaign"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Internal name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-campaign-name" /></div>
          <div><Label>Subject *</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="input-campaign-subject" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>From name</Label><Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Cascadia Oceanic" /></div>
            <div><Label>From email</Label><Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="cascadia@chrismcnulty.net" /></div>
            <div><Label>Reply-to</Label><Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} /></div>
          </div>
          <div>
            <Label>Recipient list *</Label>
            <Select value={listId} onValueChange={setListId}>
              <SelectTrigger data-testid="select-list"><SelectValue placeholder="Choose list" /></SelectTrigger>
              <SelectContent>
                {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} ({l.memberCount})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Body *</Label>
            <RichEditor value={bodyHtml} onChange={setBodyHtml} />
            <p className="text-xs text-gray-500 mt-1">
              Tokens: <code>{"{{firstName|fallback}}"}</code>, <code>{"{{lastName}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{unsubscribeUrl}}"}</code>.
              The Cascadia header & footer (with unsubscribe link) are added automatically.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Live preview</Label>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/admin/campaigns/preview", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ bodyHtml }),
                    });
                    setPreviewHtml(await res.text());
                  } catch {
                    toast({ title: "Preview failed", variant: "destructive" });
                  }
                }}
                disabled={!bodyHtml}
                data-testid="button-refresh-preview"
              >
                Refresh preview
              </Button>
            </div>
            <iframe
              title="campaign-preview"
              className="w-full h-80 border rounded bg-white"
              sandbox=""
              srcDoc={previewHtml || "<p style='font-family:sans-serif;padding:1rem;color:#666'>Click \"Refresh preview\" to render the branded email.</p>"}
              data-testid="iframe-campaign-preview"
            />
          </div>
        </div>
        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => saveMut.mutate()} disabled={!name || !subject || !bodyHtml || saveMut.isPending} data-testid="button-save-campaign">
            {saveMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isEdit ? "Save" : "Create"}
          </Button>
          {isEdit && (
            <>
              <div className="flex items-center gap-1">
                <Input
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-56"
                  data-testid="input-test-email"
                />
                <Button
                  variant="outline"
                  onClick={() => testMut.mutate()}
                  disabled={!testEmail.includes("@") || testMut.isPending}
                  data-testid="button-test-send"
                >
                  {testMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                  Test
                </Button>
              </div>
              <Button
                onClick={() => {
                  if (confirm(`Send this campaign to all members of the chosen list? This cannot be undone.`)) sendMut.mutate();
                }}
                disabled={!listId || sendMut.isPending || campaign!.status === "sending" || campaign!.status === "sent"}
                className="bg-cascadia-green hover:opacity-90"
                data-testid="button-send-campaign"
              >
                {sendMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send to list
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- rich text editor ----------
// Minimal contentEditable editor with a toolbar (B/I/H2/list/link) plus a
// "raw HTML" toggle for advanced edits. State lives in the parent so
// the field round-trips through useState/save.
function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [rawMode, setRawMode] = useState(false);

  useEffect(() => {
    if (!rawMode && ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [rawMode, value]);

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className="border rounded">
      <div className="flex flex-wrap items-center gap-1 border-b p-1 bg-gray-50">
        <Button type="button" size="sm" variant="ghost" onClick={() => exec("bold")} data-testid="rt-bold"><strong>B</strong></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => exec("italic")} data-testid="rt-italic"><em>I</em></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => exec("formatBlock", "<h2>")} data-testid="rt-h2">H2</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => exec("formatBlock", "<p>")} data-testid="rt-p">P</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => exec("insertUnorderedList")} data-testid="rt-ul">• List</Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const url = prompt("Link URL");
            if (url) exec("createLink", url);
          }}
          data-testid="rt-link"
        >Link</Button>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={rawMode} onChange={(e) => setRawMode(e.target.checked)} data-testid="rt-raw-toggle" />
            Raw HTML
          </label>
        </div>
      </div>
      {rawMode ? (
        <Textarea
          rows={12}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs border-0 rounded-none focus-visible:ring-0"
          data-testid="textarea-body-raw"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[240px] p-3 text-sm focus:outline-none prose prose-sm max-w-none"
          onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
          data-testid="editor-body"
        />
      )}
    </div>
  );
}

// ---------- helpers ----------
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const t = localStorage.getItem("auth-token");
  if (t) headers["Authorization"] = `Bearer ${t}`;
  const sid = localStorage.getItem("admin-session-id");
  if (sid) headers["x-session-id"] = sid;
  return headers;
}

function parseCsv(text: string): Array<{ email: string; firstName?: string; lastName?: string; tags?: string[] }> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (k: string) => headers.indexOf(k);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]);
    const email = cells[idx("email")];
    if (!email) continue;
    out.push({
      email,
      firstName: idx("firstname") >= 0 ? cells[idx("firstname")] : undefined,
      lastName: idx("lastname") >= 0 ? cells[idx("lastname")] : undefined,
      tags: idx("tags") >= 0 && cells[idx("tags")] ? cells[idx("tags")].split(/[;|]/).map((s) => s.trim()).filter(Boolean) : undefined,
    });
  }
  return out;
}

function splitCsvRow(row: string): string[] {
  // Simple CSV split (does not handle quoted commas perfectly; sufficient for typical exports)
  return row.split(",").map((s) => s.trim().replace(/^"(.*)"$/, "$1"));
}
