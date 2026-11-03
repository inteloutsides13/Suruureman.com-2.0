import { useState, useEffect, FormEvent } from "react";
import { useParams, useLocation, Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";

interface Video {
  id: number; title: string; titleUrdu: string; description: string;
  youtubeId: string; thumbnailUrl: string | null; duration: string;
}

const EMPTY_FORM = { title: "", titleUrdu: "", description: "", youtubeId: "", thumbnailUrl: "", duration: "" };

function VideoForm({ initial, onSave, onCancel, saving }: {
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
        <div className="space-y-1"><label className={labelCls}>Title (English)</label><input className={inputCls} value={form.title} onChange={set("title")} required /></div>
        <div className="space-y-1"><label className={labelCls}>Title (Urdu)</label><input className={`${inputCls} text-right font-urdu`} dir="rtl" value={form.titleUrdu} onChange={set("titleUrdu")} required /></div>
        <div className="space-y-1"><label className={labelCls}>YouTube URL or ID</label><input className={inputCls} value={form.youtubeId} onChange={set("youtubeId")} required placeholder="e.g. https://youtube.com/watch?v=... or ID" /></div>
        <div className="space-y-1"><label className={labelCls}>Duration</label><input className={inputCls} value={form.duration} onChange={set("duration")} required placeholder="e.g. 5:23" /></div>
        <div className="col-span-2 space-y-1"><label className={labelCls}>Thumbnail URL (optional)</label><input className={inputCls} value={form.thumbnailUrl ?? ""} onChange={set("thumbnailUrl")} /></div>
      </div>
      <div className="space-y-1"><label className={labelCls}>Description</label>
        <textarea className={`${inputCls} min-h-[80px]`} value={form.description} onChange={set("description")} required /></div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-accent text-background font-heading tracking-widest text-xs uppercase hover:bg-accent/90 disabled:opacity-50 transition-all">
          {saving ? "Saving..." : "Save Video"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-2.5 rounded-lg border border-accent/20 text-muted-foreground hover:text-foreground text-xs uppercase tracking-widest transition-all">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AdminVideosNew() {
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function handleSave(form: typeof EMPTY_FORM) {
    setSaving(true); setError("");
    try {
      const res = await adminFetch("/api/videos", { method: "POST", body: JSON.stringify({ ...form, thumbnailUrl: form.thumbnailUrl || null }) });
      if (!res.ok) { setError("Failed to create video"); return; }
      navigate("/admin/videos");
    } catch { setError("Network error"); } finally { setSaving(false); }
  }
  return (
    <AdminLayout>
      <Link href="/admin/videos" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent mb-6 transition-colors"><ArrowLeft size={14} /> Back to Videos</Link>
      <h1 className="font-heading text-xl font-bold text-foreground tracking-wider mb-8">Add New Video</h1>
      {error && <p className="text-destructive text-sm mb-4">{error}</p>}
      <VideoForm initial={EMPTY_FORM} onSave={handleSave} onCancel={() => navigate("/admin/videos")} saving={saving} />
    </AdminLayout>
  );
}

export function AdminVideosEdit() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/videos/${id}`)
      .then(async (r) => {
        if (!r.ok) { setLoading(false); return; }
        const data = await r.json();
        setVideo(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);
  async function handleSave(form: typeof EMPTY_FORM) {
    setSaving(true); setError("");
    try {
      const res = await adminFetch(`/api/videos/${id}`, { method: "PUT", body: JSON.stringify({ ...form, thumbnailUrl: form.thumbnailUrl || null }) });
      if (!res.ok) { setError("Failed to update video"); return; }
      navigate("/admin/videos");
    } catch { setError("Network error"); } finally { setSaving(false); }
  }
  if (loading) return <AdminLayout><p className="text-muted-foreground">Loading...</p></AdminLayout>;
  if (!video) return <AdminLayout><p className="text-destructive">Video not found.</p></AdminLayout>;
  const initial = { title: video.title, titleUrdu: video.titleUrdu, description: video.description, youtubeId: video.youtubeId, thumbnailUrl: video.thumbnailUrl ?? "", duration: video.duration };
  return (
    <AdminLayout>
      <Link href="/admin/videos" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent mb-6 transition-colors"><ArrowLeft size={14} /> Back to Videos</Link>
      <h1 className="font-heading text-xl font-bold text-foreground tracking-wider mb-8">Edit Video</h1>
      {error && <p className="text-destructive text-sm mb-4">{error}</p>}
      <VideoForm initial={initial} onSave={handleSave} onCancel={() => navigate("/admin/videos")} saving={saving} />
    </AdminLayout>
  );
}

export default function AdminVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  async function load() {
    try {
      const res = await fetch("/api/videos");
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setVideos(data.videos || []);
    } catch { /* network error */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  async function handleDelete(id: number) {
    if (!confirm("Delete this video?")) return;
    setDeleting(id);
    await adminFetch(`/api/videos/${id}`, { method: "DELETE" });
    await load(); setDeleting(null);
  }
  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="font-heading text-xl font-bold text-foreground tracking-wider">Videos</h1>
          <p className="text-sm text-muted-foreground">{videos.length} total</p></div>
        <Link href="/admin/videos/new" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background text-xs font-heading tracking-widest uppercase hover:bg-accent/90 transition-all">
          <Plus size={14} /> Add Video
        </Link>
      </div>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-card/40 border border-accent/10 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => (
            <div key={v.id} className="flex items-center justify-between bg-card/40 border border-accent/15 rounded-xl px-5 py-4 hover:border-accent/30 transition-all">
              <div><p className="font-urdu text-lg text-foreground">{v.titleUrdu}</p>
                <p className="font-sans text-xs text-muted-foreground">{v.title} · {v.youtubeId} · {v.duration}</p></div>
              <div className="flex items-center gap-2">
                <Link href={`/admin/videos/${v.id}/edit`} className="p-2 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/5 transition-all"><Pencil size={15} /></Link>
                <button onClick={() => handleDelete(v.id)} disabled={deleting === v.id}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 disabled:opacity-40 transition-all"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
