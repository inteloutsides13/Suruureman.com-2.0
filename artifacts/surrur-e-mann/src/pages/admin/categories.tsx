import { useState, useEffect, FormEvent } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

interface Category {
  id: number; name: string; nameUrdu: string; slug: string; description: string; poemCount: number;
}

const EMPTY_FORM = { name: "", nameUrdu: "", slug: "", description: "" };

function slugify(s: string) { return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""); }

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) { const d = await res.json(); setCategories(d.categories || []); }
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm((f) => ({
      ...f,
      [k]: val,
      ...(k === "name" ? { slug: slugify(val) } : {}),
    }));
  };

  function startEdit(cat: Category) {
    setEditId(cat.id);
    setForm({ name: cat.name, nameUrdu: cat.nameUrdu, slug: cat.slug, description: cat.description });
    setError("");
  }

  function startNew() {
    setEditId("new");
    setForm(EMPTY_FORM);
    setError("");
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const isNew = editId === "new";
      const res = await adminFetch(isNew ? "/api/categories" : `/api/categories/${editId}`, {
        method: isNew ? "POST" : "PUT",
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message || "Failed to save");
        return;
      }
      setEditId(null);
      await load();
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Delete category "${cat.name}"? This will fail if any poems use it.`)) return;
    setDeleting(cat.id);
    setError("");
    try {
      const res = await adminFetch(`/api/categories/${cat.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { setError(d.message); return; }
      await load();
    } catch { setError("Network error"); }
    finally { setDeleting(null); }
  }

  const inputCls = "w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-2.5 text-foreground font-sans text-sm transition-colors";
  const labelCls = "text-xs text-muted-foreground tracking-widest uppercase";

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground tracking-wider">Categories</h1>
          <p className="text-sm text-muted-foreground">{categories.length} total</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background text-xs font-heading tracking-widest uppercase hover:bg-accent/90 transition-all"
        >
          <Plus size={14} /> Add Category
        </button>
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {editId !== null && (
        <form onSubmit={handleSave} className="mb-8 bg-card/40 border border-accent/20 rounded-2xl p-6 space-y-4 max-w-2xl">
          <h2 className="font-heading text-sm font-semibold text-accent tracking-widest uppercase">{editId === "new" ? "New Category" : "Edit Category"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelCls}>Name (English)</label>
              <input className={inputCls} value={form.name} onChange={set("name")} required />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Name (Urdu)</label>
              <input className={`${inputCls} text-right font-urdu`} dir="rtl" value={form.nameUrdu} onChange={set("nameUrdu")} required />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Slug (auto)</label>
              <input className={inputCls} value={form.slug} onChange={set("slug")} required placeholder="e.g. ghazal" />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Description</label>
              <input className={inputCls} value={form.description} onChange={set("description")} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent text-background text-xs font-heading tracking-widest uppercase hover:bg-accent/90 disabled:opacity-50 transition-all">
              <Check size={13} />{saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setEditId(null)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg border border-accent/20 text-muted-foreground hover:text-foreground text-xs uppercase tracking-widest transition-all">
              <X size={13} /> Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-card/40 border border-accent/10 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between bg-card/40 border border-accent/15 rounded-xl px-5 py-4 hover:border-accent/30 transition-all">
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-medium text-foreground">{cat.nameUrdu} <span className="text-muted-foreground/60">({cat.name})</span></p>
                <p className="text-xs text-muted-foreground">slug: {cat.slug} · {cat.poemCount} poems</p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <button onClick={() => startEdit(cat)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/5 transition-all">
                  <Pencil size={15} />
                </button>
                <button onClick={() => handleDelete(cat)} disabled={deleting === cat.id}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 disabled:opacity-40 transition-all">
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
