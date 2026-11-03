import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus, Search, Filter, CheckCircle, XCircle, RotateCcw,
  Eye, ChevronRight, Loader2, AlertTriangle, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Contributor {
  id: number;
  email: string;
  name: string;
  status: "active" | "disabled" | "activation_pending";
  role: string;
  lastLoginAt: string | null;
  notes: string | null;
  createdAt: string;
  totalSubmissions: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
}

type ModalMode = "create" | "view" | "reset-password" | null;
type DeleteAction = "retain" | "delete";

interface DeleteImpact {
  selectedCount: number;
  hasAssociatedData: boolean;
  contributors: Array<{ id: number; name: string; email: string; status: string }>;
  counts: {
    poems: number;
    radioAudio: number;
    radioPlaylists: number;
    radioSchedules: number;
    radioPlaylistItems: number;
  };
}

function formatDate(d: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(d: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminContributors() {
  const { toast } = useToast();
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "disabled">("");
  const [modal, setModal] = useState<{ mode: ModalMode; contributor?: Contributor }>({ mode: null });

  // Create form
  const [createForm, setCreateForm] = useState({ email: "", name: "", password: "", notes: "" });
  const [creating, setCreating] = useState(false);

  // Reset password form
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // Action loading states
  const [actionId, setActionId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | null>(null);
  const [deleteAction, setDeleteAction] = useState<DeleteAction>("retain");
  const [deleteStep, setDeleteStep] = useState<"impact" | "final">("impact");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await adminFetch(`/api/admin/contributors?${params}`);
      if (res.ok) {
        const d = await res.json();
        setContributors(d.contributors);
        setTotal(d.total);
        setSelectedIds(new Set());
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!createForm.email || !createForm.name || !createForm.password) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    setCreating(true);
    try {
      const res = await adminFetch("/api/admin/contributors", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      const d = await res.json();
      if (!res.ok) { toast({ title: d.message || "Failed", variant: "destructive" }); return; }
      toast({ title: `Contributor "${createForm.name}" created` });
      setModal({ mode: null });
      setCreateForm({ email: "", name: "", password: "", notes: "" });
      load();
    } finally {
      setCreating(false);
    }
  }

  async function handleDisable(id: number) {
    setActionId(id);
    try {
      const res = await adminFetch(`/api/admin/contributors/${id}/disable`, { method: "POST" });
      if (res.ok) { toast({ title: "Contributor disabled and sessions invalidated" }); load(); }
      else { const d = await res.json(); toast({ title: d.message || "Failed", variant: "destructive" }); }
    } finally { setActionId(null); }
  }

  async function handleEnable(id: number) {
    setActionId(id);
    try {
      const res = await adminFetch(`/api/admin/contributors/${id}/enable`, { method: "POST" });
      if (res.ok) { toast({ title: "Contributor enabled" }); load(); }
      else { const d = await res.json(); toast({ title: d.message || "Failed", variant: "destructive" }); }
    } finally { setActionId(null); }
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return;
    }
    const id = modal.contributor!.id;
    setResetting(true);
    try {
      const res = await adminFetch(`/api/admin/contributors/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      });
      const d = await res.json();
      if (!res.ok) { toast({ title: d.message || "Failed", variant: "destructive" }); return; }
      toast({ title: "Password reset — existing sessions invalidated" });
      setModal({ mode: null });
      setNewPassword("");
    } finally { setResetting(false); }
  }

  const allVisibleSelected = contributors.length > 0 && contributors.every((contributor) => selectedIds.has(contributor.id));

  function toggleSelected(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) return new Set();
      return new Set(contributors.map((contributor) => contributor.id));
    });
  }

  async function inspectDeletion() {
    if (!selectedIds.size) {
      toast({ title: "Select at least one Contributor", variant: "destructive" });
      return;
    }
    const res = await adminFetch("/api/admin/contributors/delete-impact", {
      method: "POST",
      body: JSON.stringify({ ids: [...selectedIds] }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: data.message || "Could not inspect selected Contributors", variant: "destructive" });
      return;
    }
    setDeleteImpact(data);
    setDeleteAction("retain");
    setDeleteStep("impact");
  }

  async function performDeletion(contentAction: DeleteAction) {
    if (!deleteImpact) return;
    setDeleting(true);
    try {
      const res = await adminFetch("/api/admin/contributors", {
        method: "DELETE",
        body: JSON.stringify({ ids: deleteImpact.contributors.map((contributor) => contributor.id), contentAction }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.message || "Contributor deletion failed", variant: "destructive" });
        return;
      }
      toast({ title: data.message || "Contributors deleted permanently" });
      setDeleteImpact(null);
      setSelectedIds(new Set());
      await load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl tracking-wider text-foreground">Contributors</h1>
            <p className="text-muted-foreground text-sm mt-1">{total} total contributor{total !== 1 ? "s" : ""}</p>
          </div>
            <div className="flex flex-wrap items-center gap-3">
              {selectedIds.size > 0 && (
                <Button variant="destructive" onClick={inspectDeletion} disabled={deleting} className="gap-2">
                  <Trash2 size={16} /> Delete Selected ({selectedIds.size})
                </Button>
              )}
              <Button onClick={() => setModal({ mode: "create" })} className="gap-2">
                <UserPlus size={16} /> New Contributor
              </Button>
            </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {(["", "active", "disabled"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-heading tracking-wider uppercase transition-all",
                  statusFilter === s
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "text-muted-foreground hover:text-foreground border border-transparent hover:border-accent/20"
                )}
              >
                {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card/30 border border-accent/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="text-accent animate-spin" />
            </div>
          ) : contributors.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <UserPlus size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No contributors found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-accent/10">
                  <th className="w-12 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible Contributors"
                      className="h-4 w-4 accent-accent"
                    />
                  </th>
                  {["Contributor", "Status", "Submissions", "Last Login", "Joined", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-heading tracking-widest uppercase text-muted-foreground/60">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contributors.map((c) => (
                  <tr key={c.id} className="border-b border-accent/5 hover:bg-accent/3 transition-colors">
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelected(c.id)}
                        aria-label={`Select ${c.name}`}
                        className="h-4 w-4 accent-accent"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.email}</p>
                      {c.notes && <p className="text-xs text-muted-foreground/50 mt-0.5 italic truncate max-w-[200px]">{c.notes}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={c.status === "active" ? "default" : "destructive"} className="text-[10px] font-heading tracking-wider">
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-3 text-xs">
                        <span className="text-muted-foreground">{c.totalSubmissions} total</span>
                        {c.pendingSubmissions > 0 && <span className="text-amber-400">{c.pendingSubmissions} pending</span>}
                        {c.approvedSubmissions > 0 && <span className="text-emerald-400">{c.approvedSubmissions} approved</span>}
                        {c.rejectedSubmissions > 0 && <span className="text-destructive/70">{c.rejectedSubmissions} rejected</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{formatDateTime(c.lastLoginAt)}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setModal({ mode: "view", contributor: c })}
                          className="p-1.5 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
                          title="View profile"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => { setModal({ mode: "reset-password", contributor: c }); setNewPassword(""); }}
                          className="p-1.5 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-amber-400 transition-colors"
                          title="Reset password"
                        >
                          <RotateCcw size={14} />
                        </button>
                        {c.status === "active" ? (
                          <button
                            onClick={() => handleDisable(c.id)}
                            disabled={actionId === c.id}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            title="Disable account"
                          >
                            {actionId === c.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnable(c.id)}
                            disabled={actionId === c.id}
                            className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition-colors disabled:opacity-50"
                            title="Enable account"
                          >
                            {actionId === c.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {modal.mode === "create" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-accent/20 rounded-2xl p-8 w-full max-w-md shadow-2xl space-y-5">
            <h2 className="font-heading text-xl tracking-wider">New Contributor</h2>
            {[
              { label: "Full Name", key: "name", type: "text", placeholder: "Contributor's name" },
              { label: "Email Address", key: "email", type: "email", placeholder: "email@example.com" },
              { label: "Initial Password", key: "password", type: "password", placeholder: "Min. 8 characters" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">{label}</label>
                <Input
                  type={type}
                  placeholder={placeholder}
                  value={createForm[key as keyof typeof createForm]}
                  onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground tracking-widest uppercase">Notes (optional)</label>
              <Input
                placeholder="Internal notes about this contributor"
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setModal({ mode: null })} className="flex-1">Cancel</Button>
              <Button onClick={handleCreate} disabled={creating} className="flex-1 gap-2">
                {creating && <Loader2 size={14} className="animate-spin" />}
                Create Contributor
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Profile Modal */}
      {modal.mode === "view" && modal.contributor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-accent/20 rounded-2xl p-8 w-full max-w-md shadow-2xl space-y-5">
            <h2 className="font-heading text-xl tracking-wider">{modal.contributor.name}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{modal.contributor.email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                <Badge variant={modal.contributor.status === "active" ? "default" : "destructive"} className="text-[10px] font-heading tracking-wider">
                  {modal.contributor.status}
                </Badge>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Joined</span><span>{formatDate(modal.contributor.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Last Login</span><span>{formatDateTime(modal.contributor.lastLoginAt)}</span></div>
              <hr className="border-accent/10" />
              <div className="flex justify-between"><span className="text-muted-foreground">Total Submissions</span><span>{modal.contributor.totalSubmissions}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pending</span><span className="text-amber-400">{modal.contributor.pendingSubmissions}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Approved</span><span className="text-emerald-400">{modal.contributor.approvedSubmissions}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rejected</span><span className="text-destructive/70">{modal.contributor.rejectedSubmissions}</span></div>
              {modal.contributor.notes && (
                <>
                  <hr className="border-accent/10" />
                  <div><span className="text-muted-foreground text-xs block mb-1">Notes</span><p className="text-foreground">{modal.contributor.notes}</p></div>
                </>
              )}
            </div>
            <Button variant="outline" onClick={() => setModal({ mode: null })} className="w-full">Close</Button>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {modal.mode === "reset-password" && modal.contributor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-accent/20 rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-amber-400" />
              <h2 className="font-heading text-xl tracking-wider">Reset Password</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Reset password for <strong className="text-foreground">{modal.contributor.name}</strong>.
              Their existing sessions will be immediately invalidated.
            </p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground tracking-widest uppercase">New Password</label>
              <Input
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setModal({ mode: null })} className="flex-1">Cancel</Button>
              <Button onClick={handleResetPassword} disabled={resetting} className="flex-1 gap-2 bg-amber-500/80 hover:bg-amber-500 text-background">
                {resetting && <Loader2 size={14} className="animate-spin" />}
                Reset
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteImpact && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-destructive/30 rounded-2xl p-8 w-full max-w-lg shadow-2xl space-y-6">
            {deleteStep === "final" ? (
              <>
                <div className="flex items-center gap-3 text-destructive">
                  <AlertTriangle size={22} />
                  <h2 className="font-heading text-xl tracking-wider">Final Confirmation</h2>
                </div>
                <p className="text-sm text-muted-foreground">You are about to permanently delete:</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>{deleteImpact.selectedCount} Contributor account{deleteImpact.selectedCount === 1 ? "" : "s"}</li>
                  <li>Associated content/data</li>
                </ul>
                <p className="text-sm font-medium text-destructive">This action cannot be undone.</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setDeleteImpact(null)} className="flex-1">Cancel</Button>
                  <Button variant="destructive" onClick={() => performDeletion("delete")} disabled={deleting} className="flex-1 gap-2">
                    {deleting && <Loader2 size={14} className="animate-spin" />}
                    Permanently Delete Everything
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-destructive">
                  <AlertTriangle size={22} />
                  <h2 className="font-heading text-xl tracking-wider">Delete Contributor{deleteImpact.selectedCount === 1 ? "" : "s"}?</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Selected Contributors: <strong className="text-foreground">{deleteImpact.selectedCount}</strong>
                </p>
                {deleteImpact.hasAssociatedData ? (
                  <>
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2 text-sm">
                      <p className="font-medium text-amber-200">These Contributors have associated content/data.</p>
                      <p className="text-muted-foreground">Poems: {deleteImpact.counts.poems} · Radio audio: {deleteImpact.counts.radioAudio} · Playlists: {deleteImpact.counts.radioPlaylists} · Schedules: {deleteImpact.counts.radioSchedules}</p>
                    </div>
                    <fieldset className="space-y-3 text-sm">
                      <legend className="font-medium mb-2">What should happen to the associated content?</legend>
                      <label className="flex gap-3 items-start cursor-pointer">
                        <input type="radio" name="delete-content-action" checked={deleteAction === "delete"} onChange={() => setDeleteAction("delete")} className="mt-1 accent-destructive" />
                        <span><strong>Delete Contributor and permanently delete associated content</strong><span className="block text-muted-foreground mt-1">This will require one more final confirmation.</span></span>
                      </label>
                      <label className="flex gap-3 items-start cursor-pointer">
                        <input type="radio" name="delete-content-action" checked={deleteAction === "retain"} onChange={() => setDeleteAction("retain")} className="mt-1 accent-accent" />
                        <span><strong>Delete Contributor but keep associated content</strong><span className="block text-muted-foreground mt-1">Ownership links will be cleared where the existing schema supports it.</span></span>
                      </label>
                    </fieldset>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setDeleteImpact(null)} className="flex-1">Cancel</Button>
                      <Button onClick={() => deleteAction === "delete" ? setDeleteStep("final") : performDeletion("retain")} disabled={deleting} className="flex-1">
                        {deleteAction === "delete" ? "Continue" : "Delete and Keep Content"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">This Contributor has no associated content. This action will permanently delete the account and cannot be undone.</p>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setDeleteImpact(null)} className="flex-1">Cancel</Button>
                      <Button variant="destructive" onClick={() => performDeletion("retain")} disabled={deleting} className="flex-1 gap-2">
                        {deleting && <Loader2 size={14} className="animate-spin" />}
                        Delete Permanently
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
