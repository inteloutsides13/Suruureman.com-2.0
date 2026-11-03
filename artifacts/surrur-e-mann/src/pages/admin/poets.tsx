import { useState, useEffect, FormEvent } from "react";
import { useParams, useLocation, Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";

interface Poet {
  id: number; name: string; nameUrdu: string; bio: string;
  bioUrdu: string; era: string; poemCount: number;
}

const EMPTY_FORM = { name: "", nameUrdu: "", bio: "", bioUrdu: "", era: "" };

function PoetForm({ initial, onSave, onCancel, saving }: {
  initial: typeof EMPTY_FORM;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputCls = "w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-2.5 text-foreground font-sans text-sm transition-colors";
  const labelCls = "text-xs text-muted-foreground tracking-widest uppercase";

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><label className={labelCls}>Name (English)</label><input className={inputCls} value={form.name} onChange={set("name")} required /></div>
        <div className="space-y-1"><label className={labelCls}>Name (Urdu)</label><input className={`${inputCls} text-right font-urdu`} dir="rtl" value={form.nameUrdu} onChange={set("nameUrdu")} required /></div>
        <div className="col-span-2 space-y-1"><label className={labelCls}>Era</label><input className={inputCls} value={form.era} onChange={set("era")} required placeholder="e.g. 18th century" /></div>
      </div>
      <div className="space-y-1"><label className={labelCls}>Biography (English)</label>
        <textarea className={`${inputCls} min-h-[100px]`} value={form.bio} onChange={set("bio")} required /></div>
      <div className="space-y-1"><label className={labelCls}>Biography (Urdu)</label>
        <textarea className={`${inputCls} text-right font-urdu min-h-[100px] leading-loose`} dir="rtl" value={form.bioUrdu} onChange={set("bioUrdu")} required /></div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-accent text-background font-heading tracking-widest text-xs uppercase hover:bg-accent/90 disabled:opacity-50 transition-all">
          {saving ? "Saving..." : "Save Poet"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-2.5 rounded-lg border border-accent/20 text-muted-foreground hover:text-foreground text-xs uppercase tracking-widest transition-all">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AdminPoetsNew() {
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function handleSave(form: typeof EMPTY_FORM) {
    setSaving(true); setError("");
    try {
      const res = await adminFetch("/api/poets", { method: "POST", body: JSON.stringify(form) });
      if (!res.ok) { setError("Failed to create poet"); return; }
      navigate("/admin/poets");
    } catch { setError("Network error"); } finally { setSaving(false); }
  }
  return (
    <AdminLayout>
      <Link href="/admin/poets" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent mb-6 transition-colors"><ArrowLeft size={14} /> Back to Poets</Link>
      <h1 className="font-heading text-xl font-bold text-foreground tracking-wider mb-8">Add New Poet</h1>
      {error && <p className="text-destructive text-sm mb-4">{error}</p>}
      <PoetForm initial={EMPTY_FORM} onSave={handleSave} onCancel={() => navigate("/admin/poets")} saving={saving} />
    </AdminLayout>
  );
}

export function AdminPoetsEdit() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [poet, setPoet] = useState<Poet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/poets/${id}`)
      .then(async (r) => {
        if (!r.ok) { setLoading(false); return; }
        const data = await r.json();
        setPoet(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);
  async function handleSave(form: typeof EMPTY_FORM) {
    setSaving(true); setError("");
    try {
      const res = await adminFetch(`/api/poets/${id}`, { method: "PUT", body: JSON.stringify(form) });
      if (!res.ok) { setError("Failed to update poet"); return; }
      navigate("/admin/poets");
    } catch { setError("Network error"); } finally { setSaving(false); }
  }
  if (loading) return <AdminLayout><p className="text-muted-foreground">Loading...</p></AdminLayout>;
  if (!poet) return <AdminLayout><p className="text-destructive">Poet not found.</p></AdminLayout>;
  const initial = { name: poet.name, nameUrdu: poet.nameUrdu, bio: poet.bio, bioUrdu: poet.bioUrdu, era: poet.era };
  return (
    <AdminLayout>
      <Link href="/admin/poets" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent mb-6 transition-colors"><ArrowLeft size={14} /> Back to Poets</Link>
      <h1 className="font-heading text-xl font-bold text-foreground tracking-wider mb-8">Edit Poet</h1>
      {error && <p className="text-destructive text-sm mb-4">{error}</p>}
      <PoetForm initial={initial} onSave={handleSave} onCancel={() => navigate("/admin/poets")} saving={saving} />
    </AdminLayout>
  );
}

export default function AdminPoets() {
  const [poets, setPoets] = useState<Poet[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  async function load() {
    try {
      const res = await fetch("/api/poets");
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setPoets(data.poets || []);
    } catch { /* network error */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  async function handleDelete(id: number) {
    if (!confirm("Delete this poet?")) return;
    setDeleting(id);
    await adminFetch(`/api/poets/${id}`, { method: "DELETE" });
    await load(); setDeleting(null);
  }
  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="font-heading text-xl font-bold text-foreground tracking-wider">Poets</h1>
          <p className="text-sm text-muted-foreground">{poets.length} total</p></div>
        <Link href="/admin/poets/new" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background text-xs font-heading tracking-widest uppercase hover:bg-accent/90 transition-all">
          <Plus size={14} /> Add Poet
        </Link>
      </div>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-card/40 border border-accent/10 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {poets.map((poet) => (
            <div key={poet.id} className="flex items-center justify-between bg-card/40 border border-accent/15 rounded-xl px-5 py-4 hover:border-accent/30 transition-all">
              <div><p className="font-urdu text-lg text-foreground">{poet.nameUrdu}</p>
                <p className="font-sans text-xs text-muted-foreground">{poet.name} · {poet.era} · {poet.poemCount} poems</p></div>
              <div className="flex items-center gap-2">
                <Link href={`/admin/poets/${poet.id}/edit`} className="p-2 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/5 transition-all"><Pencil size={15} /></Link>
                <button onClick={() => handleDelete(poet.id)} disabled={deleting === poet.id}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 disabled:opacity-40 transition-all"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
