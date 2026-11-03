import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { Plus, Trash2, RotateCcw, Database } from "lucide-react";

interface Backup {
  id: number;
  name: string;
  createdAt: string;
  formatVersion: 1 | 2 | null;
  restorable: boolean;
  includedDatasets: string[];
  rowCounts: Record<string, number>;
  integrityValid: boolean | null;
}

const DATASET_LABELS: Record<string, string> = {
  poems: "poems",
  poets: "poets",
  videos: "videos",
  categories: "categories",
  settings: "public settings",
  tools: "tools",
};

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

export default function AdminBackups() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const res = await adminFetch("/api/admin/backups");
      if (res.ok) { const d = await res.json(); setBackups(d.backups || []); }
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setCreating(true);
    setMessage("");
    try {
      const res = await adminFetch("/api/admin/backups", { method: "POST" });
      if (res.ok) {
        setMessage("Backup created successfully");
        await load();
      } else {
        setMessage("Failed to create backup");
      }
    } catch { setMessage("Network error"); }
    finally { setCreating(false); }
  }

  async function handleRestore(backup: Backup) {
    const phrase = window.prompt(
      `This merges records from "${backup.name}" into current data. Matching records will be overwritten; records created later are left in place. Radio, analytics history, account records, messages, and audit logs are not included.\n\nType RESTORE BACKUP exactly to continue.`,
    );
    if (phrase !== "RESTORE BACKUP") return;
    setRestoring(backup.id);
    setMessage("");
    try {
      const res = await adminFetch(`/api/admin/backups/${backup.id}/restore`, {
        method: "POST",
        body: JSON.stringify({ backupId: backup.id, confirmationPhrase: phrase }),
      });
      if (res.ok) {
        setMessage("Snapshot merge completed successfully");
        await load();
      }
      else { const d = await res.json(); setMessage(d.message || "Restore failed"); }
    } catch { setMessage("Network error"); }
    finally { setRestoring(null); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this backup?")) return;
    setDeleting(id);
    await adminFetch(`/api/admin/backups/${id}`, { method: "DELETE" });
    setBackups((prev) => prev.filter((b) => b.id !== id));
    setDeleting(null);
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground tracking-wider">Backups</h1>
          <p className="text-sm text-muted-foreground">{backups.length}/5 backups stored</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background text-xs font-heading tracking-widest uppercase hover:bg-accent/90 disabled:opacity-50 transition-all"
        >
          <Plus size={14} />
          {creating ? "Creating..." : "Create Backup"}
        </button>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm border ${message.includes("success") || message.includes("completed") ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-destructive/10 border-destructive/30 text-destructive"}`}>
          {message}
        </div>
      )}

      <div className="mb-6 bg-card/30 border border-accent/10 rounded-xl px-5 py-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Application data snapshots — not full database backups</p>
        <p className="mt-2">New snapshots include poems, poets, videos, categories, tools, and the public contact/social settings shown on the Settings page. Only the five newest snapshots are retained; creating another removes the oldest in the same transaction.</p>
        <p className="mt-2">Restore is a merge: saved rows overwrite matching IDs or setting keys, missing saved rows are reinserted, and rows created after the snapshot remain. Restore is transactional, so a failed restore does not leave partial changes. New snapshots are schema-validated and SHA-256 checked.</p>
        <p className="mt-2">Not included: Radio data, analytics event history and engagement counters, accounts or password hashes, contributor applications and activation tokens, contact messages, audit logs, database schema, or PostgreSQL point-in-time recovery. These snapshots stay in the same database and are not encrypted or stored off-site.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-card/40 border border-accent/10 rounded-xl animate-pulse" />)}
        </div>
      ) : backups.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center border border-dashed border-accent/20 rounded-3xl bg-card/20">
          <Database size={32} className="text-accent/30 mb-4" />
          <p className="text-muted-foreground text-sm tracking-widest uppercase">No backups yet</p>
          <p className="text-xs text-muted-foreground/50 mt-2">Click "Create Backup" to save the current state</p>
        </div>
      ) : (
        <div className="space-y-3">
          {backups.map((backup, index) => (
            <div key={backup.id} className="flex items-center justify-between bg-card/40 border border-accent/15 rounded-xl px-5 py-4 hover:border-accent/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-heading text-accent">
                  {index + 1}
                </div>
                <div>
                  <p className="font-sans text-sm font-medium text-foreground">{backup.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(backup.createdAt)}</p>
                  {backup.restorable ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      v{backup.formatVersion} · {backup.includedDatasets
                        .map((dataset) => `${DATASET_LABELS[dataset] ?? dataset}: ${backup.rowCounts[dataset] ?? 0}`)
                        .join(" · ")}
                      {backup.integrityValid === true ? " · checksum verified" : " · legacy, no checksum"}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-destructive">Invalid or corrupt snapshot — restore unavailable</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRestore(backup)}
                  disabled={restoring === backup.id || !backup.restorable}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-accent hover:bg-accent/5 disabled:opacity-40 transition-all border border-accent/10 hover:border-accent/30"
                >
                  <RotateCcw size={13} />
                  {restoring === backup.id ? "Restoring..." : "Restore"}
                </button>
                <button
                  onClick={() => handleDelete(backup.id)}
                  disabled={deleting === backup.id}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 disabled:opacity-40 transition-all"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
