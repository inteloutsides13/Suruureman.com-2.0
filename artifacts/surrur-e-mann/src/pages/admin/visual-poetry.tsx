import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { Image, Check, X } from "lucide-react";

interface Poem {
  id: number; title: string; titleUrdu: string; poetName: string;
  imageUrl: string | null; visualPoetry: boolean;
}

export default function AdminVisualPoetry() {
  const [poems, setPoems] = useState<Poem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [imageInput, setImageInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  async function load() {
    try {
      const res = await adminFetch("/api/poems?limit=200");
      const data = await res.json();
      setPoems(data.poems || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleVisual(poem: Poem) {
    setSaving(poem.id);
    try {
      await adminFetch(`/api/poems/${poem.id}/visual`, {
        method: "PATCH",
        body: JSON.stringify({ visualPoetry: !poem.visualPoetry }),
      });
      await load();
    } catch { /* ignore */ }
    setSaving(null);
  }

  async function saveImage(poem: Poem) {
    if (!imageInput.trim()) return;
    setSaving(poem.id);
    try {
      await adminFetch(`/api/poems/${poem.id}/visual`, {
        method: "PATCH",
        body: JSON.stringify({ imageUrl: imageInput.trim() }),
      });
      setEditId(null);
      setImageInput("");
      setPreviewUrl("");
      await load();
    } catch { /* ignore */ }
    setSaving(null);
  }

  const visualPoems = poems.filter((p) => p.visualPoetry);

  const inputCls = "w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-2.5 text-foreground font-sans text-sm transition-colors";

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center gap-3 mb-2">
          <Image size={20} className="text-accent" />
          <h1 className="font-heading text-xl font-bold text-foreground tracking-wider">Visual Poetry</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          Mark poems as visual poetry and attach images. Visual poems appear in the Visual section on the frontend.
        </p>

        {/* Currently visual */}
        <div className="mb-8">
          <h2 className="font-heading text-xs tracking-widest uppercase text-accent/60 mb-4">
            Visual Poems ({visualPoems.length})
          </h2>
          {visualPoems.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-card/40 border border-accent/10 rounded-xl px-5 py-4">
              No visual poems yet. Mark poems below to add them.
            </p>
          ) : (
            <div className="space-y-3">
              {visualPoems.map((poem) => (
                <div key={poem.id} className="bg-card/40 border border-accent/15 rounded-xl px-5 py-4">
                  <div className="flex items-start gap-4">
                    {poem.imageUrl && (
                      <img src={poem.imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg border border-accent/20 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-urdu text-lg text-foreground">{poem.titleUrdu}</p>
                      <p className="font-sans text-xs text-muted-foreground">{poem.title} · {poem.poetName}</p>
                      {editId === poem.id ? (
                        <div className="mt-3 space-y-2">
                          <input
                            className={inputCls}
                            placeholder="Image URL (https://...)"
                            value={imageInput}
                            onChange={(e) => { setImageInput(e.target.value); setPreviewUrl(e.target.value); }}
                          />
                          {previewUrl && (
                            <img src={previewUrl} alt="preview" className="h-24 object-cover rounded-lg border border-accent/20" onError={() => setPreviewUrl("")} />
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveImage(poem)}
                              disabled={saving === poem.id || !imageInput.trim()}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-heading tracking-widest uppercase disabled:opacity-40 transition-all"
                            >
                              <Check size={12} /> Save Image
                            </button>
                            <button
                              onClick={() => { setEditId(null); setImageInput(""); setPreviewUrl(""); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/20 text-muted-foreground text-xs uppercase tracking-widest transition-all"
                            >
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => { setEditId(poem.id); setImageInput(poem.imageUrl || ""); setPreviewUrl(poem.imageUrl || ""); }}
                            className="text-xs text-accent/60 hover:text-accent transition-colors"
                          >
                            {poem.imageUrl ? "Change Image" : "Add Image"}
                          </button>
                          <span className="text-muted-foreground/30">·</span>
                          <button
                            onClick={() => toggleVisual(poem)}
                            disabled={saving === poem.id}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                          >
                            Remove from Visual
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All poems */}
        <div>
          <h2 className="font-heading text-xs tracking-widest uppercase text-accent/60 mb-4">All Poems</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-card/40 border border-accent/10 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {poems.map((poem) => (
                <div key={poem.id} className="flex items-center justify-between bg-card/40 border border-accent/15 rounded-xl px-5 py-3 hover:border-accent/30 transition-all">
                  <div>
                    <p className="font-urdu text-base text-foreground">{poem.titleUrdu}</p>
                    <p className="font-sans text-xs text-muted-foreground">{poem.title} · {poem.poetName}</p>
                  </div>
                  <button
                    onClick={() => toggleVisual(poem)}
                    disabled={saving === poem.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-heading tracking-widest uppercase transition-all disabled:opacity-40 ${
                      poem.visualPoetry
                        ? "bg-accent/10 text-accent border border-accent/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                        : "border border-accent/20 text-muted-foreground hover:text-accent hover:border-accent/40"
                    }`}
                  >
                    {saving === poem.id ? "..." : poem.visualPoetry ? "Visual ✓" : "Mark Visual"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
