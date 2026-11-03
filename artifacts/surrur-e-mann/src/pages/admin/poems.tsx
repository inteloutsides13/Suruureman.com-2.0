import { useState, useEffect, FormEvent } from "react";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { adminFetch } from "@/hooks/use-admin-auth";
import { getMissingPoemFields, getPoemValidationMessage } from "@/lib/poem-validation";
import { Plus, Pencil, Trash2, ArrowLeft, Search, X } from "lucide-react";
import { Link } from "wouter";
import { getPoemLanguageLabel, POEM_LANGUAGES } from "@/lib/poem-languages";

interface Poem {
  id: number; title: string; titleUrdu: string; content: string;
  poetName: string; poetNameUrdu: string; category: string;
  categoryUrdu: string; featured: boolean; imageUrl: string | null;
  language: string; createdAt: string;
  contributorName: string | null;
}

interface Poet {
  id: number; name: string; nameUrdu: string;
}

interface Category { id: number; name: string; nameUrdu: string; slug: string; }

const LANGUAGES = POEM_LANGUAGES;

const EMPTY_FORM = {
  title: "", titleUrdu: "", content: "", poetName: "", poetNameUrdu: "",
  category: "", categoryUrdu: "", featured: false, imageUrl: "", language: "",
};

function PoemForm({ initial, onSave, onCancel, saving }: {
  initial: typeof EMPTY_FORM;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [poets, setPoets] = useState<Poet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    fetch("/api/poets")
      .then((r) => r.json())
      .then((d) => setPoets(d.poets || []))
      .catch(() => {});
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValidationError("");
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  function handlePoetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setValidationError("");
    const poet = poets.find((p) => String(p.id) === e.target.value);
    if (poet) {
      setForm((f) => ({ ...f, poetName: poet.name, poetNameUrdu: poet.nameUrdu }));
    } else {
      setForm((f) => ({ ...f, poetName: "", poetNameUrdu: "" }));
    }
  }

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setValidationError("");
    const cat = categories.find((c) => c.slug === e.target.value);
    if (cat) {
      setForm((f) => ({ ...f, category: cat.slug, categoryUrdu: cat.nameUrdu }));
    } else {
      setForm((f) => ({ ...f, category: "", categoryUrdu: "" }));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const missing = getMissingPoemFields(form);
    if (missing.length > 0) {
      setValidationError(getPoemValidationMessage(missing));
      return;
    }
    setValidationError("");
    onSave(form);
  }

  const inputCls = "w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-2.5 text-foreground font-sans text-sm transition-colors";
  const labelCls = "text-xs text-muted-foreground tracking-widest uppercase";
  const selectCls = `${inputCls} cursor-pointer`;

  const selectedPoetId = poets.find((p) => p.name === form.poetName)?.id ?? "";
  const selectedCategory = form.category;

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className={labelCls}>Title (English) <span className="text-destructive">*</span></label>
          <input className={inputCls} value={form.title} onChange={set("title")} required />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Title (Urdu) <span className="text-destructive">*</span></label>
          <input className={`${inputCls} text-right font-urdu`} dir="rtl" value={form.titleUrdu} onChange={set("titleUrdu")} required />
        </div>

        <div className="col-span-2 space-y-1">
          <label className={labelCls}>Poet <span className="text-destructive">*</span></label>
          <select
            className={selectCls}
            value={selectedPoetId}
            onChange={handlePoetChange}
            required
          >
            <option value="">— Select Poet —</option>
            {poets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameUrdu} ({p.name})
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 space-y-1">
          <label className={labelCls}>Category <span className="text-destructive">*</span></label>
          <select
            className={selectCls}
            value={selectedCategory}
            onChange={handleCategoryChange}
            required
          >
            <option value="">— Select Category —</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.nameUrdu} ({c.name})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className={labelCls}>Content (Urdu) <span className="text-destructive">*</span></label>
        <textarea className={`${inputCls} text-right font-urdu min-h-[160px] leading-loose`} dir="rtl" value={form.content} onChange={set("content")} required />
      </div>
      <div className="space-y-1">
        <label className={labelCls}>Image URL (optional)</label>
        <input className={inputCls} value={form.imageUrl ?? ""} onChange={set("imageUrl")} />
      </div>
      <div className="space-y-1">
        <label className={labelCls}>Language <span className="text-destructive">*</span></label>
          <select
          className={selectCls}
          value={form.language}
          onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
          required
        >
            <option value="">— Select Language —</option>
          {form.language === "farsi" && (
            <option value="farsi" disabled>فارسی — Farsi (legacy, keep existing value)</option>
          )}
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.labelUrdu} — {lang.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="featured" checked={form.featured}
          onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
          className="accent-amber-500" />
        <label htmlFor="featured" className={labelCls}>Featured</label>
      </div>
      {validationError && <p role="alert" className="text-destructive text-sm">{validationError}</p>}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-accent text-background font-heading tracking-widest text-xs uppercase hover:bg-accent/90 disabled:opacity-50 transition-all">
          {saving ? "Saving..." : "Save Poem"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-2.5 rounded-lg border border-accent/20 text-muted-foreground hover:text-foreground text-xs uppercase tracking-widest transition-all">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AdminPoemsNew() {
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(form: typeof EMPTY_FORM) {
    setSaving(true);
    setError("");
    try {
      const res = await adminFetch("/api/poems", {
        method: "POST",
        body: JSON.stringify({ ...form, imageUrl: form.imageUrl || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || "Failed to create poem");
        return;
      }
      navigate("/admin/poems");
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <AdminLayout>
      <Link href="/admin/poems" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to Poems
      </Link>
      <h1 className="font-heading text-xl font-bold text-foreground tracking-wider mb-8">Add New Poem</h1>
      {error && <p className="text-destructive text-sm mb-4">{error}</p>}
      <PoemForm initial={EMPTY_FORM} onSave={handleSave} onCancel={() => navigate("/admin/poems")} saving={saving} />
    </AdminLayout>
  );
}

export function AdminPoemsEdit() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [poem, setPoem] = useState<Poem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch(`/api/poems/${id}`)
      .then(async (r) => {
        if (!r.ok) { setLoading(false); return; }
        const data = await r.json();
        setPoem(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleSave(form: typeof EMPTY_FORM) {
    setSaving(true);
    setError("");
    try {
      const res = await adminFetch(`/api/poems/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...form, imageUrl: form.imageUrl || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || "Failed to update poem");
        return;
      }
      navigate("/admin/poems");
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  if (loading) return <AdminLayout><p className="text-muted-foreground">Loading...</p></AdminLayout>;
  if (!poem) return <AdminLayout><p className="text-destructive">Poem not found.</p></AdminLayout>;

  const initial = {
    title: poem.title, titleUrdu: poem.titleUrdu, content: poem.content,
    poetName: poem.poetName, poetNameUrdu: poem.poetNameUrdu,
    category: poem.category, categoryUrdu: poem.categoryUrdu,
    featured: poem.featured, imageUrl: poem.imageUrl ?? "",
     language: poem.language ?? "",
  };

  return (
    <AdminLayout>
      <Link href="/admin/poems" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to Poems
      </Link>
      <h1 className="font-heading text-xl font-bold text-foreground tracking-wider mb-8">Edit Poem</h1>
      {error && <p className="text-destructive text-sm mb-4">{error}</p>}
      <PoemForm initial={initial} onSave={handleSave} onCancel={() => navigate("/admin/poems")} saving={saving} />
    </AdminLayout>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function AdminPoems() {
  const { role } = useAdminAuth();
  const canViewAttribution = role === "admin" || role === "developer";
  const [poems, setPoems] = useState<Poem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [langFilter, setLangFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!canViewAttribution) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({ limit: "2000", offset: "0" });
    if (langFilter !== "all") params.set("language", langFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);

    adminFetch(`/api/admin/poems?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Poems could not be loaded.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPoems(data.poems || []);
        setTotal(Number(data.total ?? 0));
      })
      .catch(() => {
        if (cancelled) return;
        setPoems([]);
        setTotal(0);
        setLoadError("Poems could not be loaded. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [canViewAttribution, debouncedSearch, langFilter, refreshKey]);

  async function handleDelete(id: number) {
    if (!confirm("Delete this poem?")) return;
    setDeleting(id);
    try {
      const res = await adminFetch(`/api/poems/${id}`, { method: "DELETE" });
      if (!res.ok) setLoadError("Poem could not be deleted. Please try again.");
    } catch {
      setLoadError("Poem could not be deleted. Please try again.");
    } finally {
      setRefreshKey((key) => key + 1);
      setDeleting(null);
    }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground tracking-wider">Poems</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading poems..." : `${poems.length} of ${total} matching ${total === 1 ? "poem" : "poems"}`}
          </p>
        </div>
        <Link href="/admin/poems/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background text-xs font-heading tracking-widest uppercase hover:bg-accent/90 transition-all">
          <Plus size={14} /> Add Poem
        </Link>
      </div>
      <div className="relative w-full sm:max-w-xl mb-5">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent/60 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={200}
          placeholder="Search poems, poets, contributors..."
          aria-label="Search poems, poets, contributors"
          className="w-full bg-card/40 border border-accent/20 hover:border-accent/40 focus:border-accent focus:outline-none rounded-full py-3 pl-11 pr-12 text-foreground placeholder:text-muted-foreground/50 font-sans text-sm tracking-wide transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear poem search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ value: "all", label: "All Languages" }, ...LANGUAGES.map((l) => ({ value: l.value, label: l.label }))].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setLangFilter(opt.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-heading tracking-widest uppercase border transition-all ${
              langFilter === opt.value
                ? "bg-accent text-background border-accent"
                : "border-accent/20 text-muted-foreground hover:border-accent/50 hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-card/40 border border-accent/10 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        loadError ? (
          <p role="alert" className="py-10 text-center text-sm text-destructive">{loadError}</p>
        ) : poems.length === 0 ? (
          <div className="py-14 text-center border border-dashed border-accent/20 rounded-2xl bg-card/20">
            <p className="font-heading text-sm text-muted-foreground">No poems found.</p>
          </div>
        ) : (
        <div className="space-y-3">
          {poems.map((poem) => (
            <div key={poem.id} className="flex items-center justify-between bg-card/40 border border-accent/15 rounded-xl px-5 py-4 hover:border-accent/30 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-urdu text-lg text-foreground truncate">{poem.titleUrdu}</p>
                  {poem.language && poem.language !== "urdu" && (
                    <span className="shrink-0 text-[10px] font-heading tracking-widest uppercase px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent">
                      {getPoemLanguageLabel(poem.language)}
                    </span>
                  )}
                </div>
                <p className="font-sans text-xs text-muted-foreground">
                  {poem.poetName} · {poem.category}
                  {poem.featured && " · ⭐ Featured"}
                  {canViewAttribution && poem.contributorName && ` · Contributor: ${poem.contributorName}`}
                  {poem.createdAt && ` · ${formatDate(poem.createdAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <Link href={`/admin/poems/${poem.id}/edit`}
                  aria-label={`Edit ${poem.title}`}
                  className="p-2 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/5 transition-all">
                  <Pencil size={15} />
                </Link>
                <button onClick={() => handleDelete(poem.id)} disabled={deleting === poem.id}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 disabled:opacity-40 transition-all">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
        )
      )}
    </AdminLayout>
  );
}
