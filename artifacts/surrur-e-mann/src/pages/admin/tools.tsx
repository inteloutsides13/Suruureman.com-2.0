import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { getAdminRole } from "@/hooks/use-admin-auth";
import { Wrench, Plus, Pencil, Trash2, X, Check, ExternalLink, Eye, EyeOff } from "lucide-react";

interface Tool {
  id: number;
  title: string;
  titleUrdu: string;
  description: string;
  descriptionUrdu: string;
  url: string;
  active: boolean;
  displayOrder: number;
  createdAt: string;
}

interface FormState {
  title: string;
  titleUrdu: string;
  description: string;
  descriptionUrdu: string;
  url: string;
  active: boolean;
  displayOrder: number;
}

const emptyForm = (): FormState => ({
  title: "", titleUrdu: "", description: "", descriptionUrdu: "",
  url: "", active: true, displayOrder: 0,
});

const inputCls = "w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-2.5 text-foreground text-sm transition-colors";

export default function AdminTools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const isDeveloper = getAdminRole() === "developer";

  function loadTools() {
    setLoading(true);
    adminFetch("/api/tools/admin")
      .then((r) => r.json())
      .then((d) => setTools(d.tools || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadTools(); }, []);

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowForm(true);
  }

  function startEdit(t: Tool) {
    setEditingId(t.id);
    setForm({ title: t.title, titleUrdu: t.titleUrdu, description: t.description, descriptionUrdu: t.descriptionUrdu, url: t.url, active: t.active, displayOrder: t.displayOrder });
    setError("");
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  async function handleSave() {
    if (!form.title || !form.url) { setError("Title and URL are required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await adminFetch(
        editingId ? `/api/tools/admin/${editingId}` : "/api/tools/admin",
        { method: editingId ? "PUT" : "POST", body: JSON.stringify(form) }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to save"); return; }
      setShowForm(false);
      loadTools();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this tool?")) return;
    setDeletingId(id);
    try {
      const res = await adminFetch(`/api/tools/admin/${id}`, { method: "DELETE" });
      if (res.ok) loadTools();
    } finally { setDeletingId(null); }
  }

  async function handleToggleActive(tool: Tool) {
    await adminFetch(`/api/tools/admin/${tool.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...tool, active: !tool.active }),
    });
    loadTools();
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground tracking-wider mb-1 flex items-center gap-3">
              <Wrench size={22} className="text-accent" />
              Tools Management
            </h1>
            <p className="text-sm text-muted-foreground">Manage external tools linked from the public Tools page.</p>
          </div>
          {isDeveloper && (
            <button onClick={startAdd}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-background font-heading tracking-widest text-xs hover:bg-accent/90 transition-all">
              <Plus size={16} /> Add Tool
            </button>
          )}
        </div>

        {!isDeveloper && (
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-heading tracking-wider uppercase">View Only — Developer access required to add, edit, or delete tools.</p>
          </div>
        )}

        {showForm && isDeveloper && (
          <div className="bg-card/60 border border-accent/20 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-sm tracking-widest uppercase text-accent">
                {editingId ? "Edit Tool" : "New Tool"}
              </h2>
              <button onClick={cancelForm} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-2">{error}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">Title (English) *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">Title (Urdu) *</label>
                <input type="text" dir="rtl" value={form.titleUrdu} onChange={(e) => setForm({ ...form, titleUrdu: e.target.value })} className={inputCls + " font-urdu"} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">URL *</label>
                <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" className={inputCls} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">Description (Urdu)</label>
                <textarea dir="rtl" value={form.descriptionUrdu} onChange={(e) => setForm({ ...form, descriptionUrdu: e.target.value })} rows={2} className={inputCls + " resize-none font-urdu"} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">Description (English)</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls + " resize-none"} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">Display Order</label>
                <input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div className="space-y-1 flex items-end">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="w-4 h-4 accent-[hsl(var(--accent))] rounded" />
                  <span className="text-xs text-muted-foreground tracking-widest uppercase">Active (visible on public page)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-background font-heading tracking-widest text-xs hover:bg-accent/90 disabled:opacity-50 transition-all">
                <Check size={14} /> {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={cancelForm}
                className="px-5 py-2.5 rounded-lg border border-accent/20 text-muted-foreground hover:text-foreground font-heading tracking-widest text-xs transition-all">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bg-card/40 border border-accent/15 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading tools...</div>
          ) : tools.length === 0 ? (
            <div className="p-12 text-center">
              <Wrench size={32} className="text-accent/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No tools yet.{isDeveloper ? " Click \"Add Tool\" to create one." : ""}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-accent/10">
                  <th className="text-left px-6 py-4 text-xs font-heading tracking-widest uppercase text-muted-foreground">Tool</th>
                  <th className="text-left px-6 py-4 text-xs font-heading tracking-widest uppercase text-muted-foreground hidden md:table-cell">URL</th>
                  <th className="text-left px-6 py-4 text-xs font-heading tracking-widest uppercase text-muted-foreground">Status</th>
                  {isDeveloper && <th className="px-6 py-4 w-24" />}
                </tr>
              </thead>
              <tbody>
                {tools.map((t) => (
                  <tr key={t.id} className="border-b border-accent/5 hover:bg-accent/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-sans text-foreground">{t.title}</div>
                      <div className="font-urdu text-xs text-muted-foreground mt-0.5">{t.titleUrdu}</div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <a href={t.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-accent/70 hover:text-accent transition-colors max-w-[200px] truncate">
                        <ExternalLink size={11} />
                        <span className="truncate">{t.url.replace(/^https?:\/\//, '')}</span>
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      {isDeveloper ? (
                        <button onClick={() => handleToggleActive(t)}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${t.active ? "border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/20" : "border-accent/20 text-muted-foreground bg-card/40 hover:bg-accent/10"}`}>
                          {t.active ? <Eye size={11} /> : <EyeOff size={11} />}
                          {t.active ? "Active" : "Hidden"}
                        </button>
                      ) : (
                        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border w-fit ${t.active ? "border-green-500/30 text-green-400" : "border-accent/20 text-muted-foreground"}`}>
                          {t.active ? <Eye size={11} /> : <EyeOff size={11} />}
                          {t.active ? "Active" : "Hidden"}
                        </span>
                      )}
                    </td>
                    {isDeveloper && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => startEdit(t)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-40">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
