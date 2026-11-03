import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Radio } from "lucide-react";
import { ContributorLayout } from "@/components/contributor-layout";
import { MobileBroadcastGuide } from "@/components/mobile-broadcast-guide";
import { contributorFetch } from "@/hooks/use-admin-auth";

type Submission = {
  id: number;
  title: string;
  titleUrdu: string;
  description: string;
  category: string | null;
  originalFilename: string;
  editorialStatus: string;
  processingStatus: string;
  rightsStatus: string;
  rightsNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

const initialForm = {
  title: "",
  titleUrdu: "",
  description: "",
  category: "poetry",
  originalFilename: "",
  sizeBytes: "1",
  durationMs: "60000",
  contentType: "audio/mpeg",
  rightsStatus: "unknown",
  rightsNotes: "",
  rightsValidFrom: "",
  rightsValidUntil: "",
};

export default function ContributorRadio() {
  // Development-only recovery switch for the existing metadata submission workflow.
  // Production builds always keep that interface out of the simplified Radio panel.
  const showLegacySubmissionTools =
    import.meta.env.DEV && import.meta.env.VITE_SHOW_CONTRIBUTOR_RADIO_SUBMISSIONS === "true";
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function load() {
    const response = await contributorFetch("/api/contributor/radio/submissions");
    if (response.ok) setSubmissions((await response.json()).submissions ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (showLegacySubmissionTools) void load();
  }, [showLegacySubmissionTools]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    const response = await contributorFetch(editingId ? `/api/contributor/radio/submissions/${editingId}` : "/api/contributor/radio/submissions", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify({
        ...form,
        sizeBytes: Number(form.sizeBytes),
        durationMs: Number(form.durationMs),
        rightsValidFrom: form.rightsValidFrom || null,
        rightsValidUntil: form.rightsValidUntil || null,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setFeedback(data.message ?? "The Radio submission could not be saved.");
      return;
    }
    setFeedback(editingId ? "Radio content resubmitted for editorial review." : "Radio content submitted for editorial review.");
    setEditingId(null);
    setForm(initialForm);
    await load();
  }

  return (
    <ContributorLayout>
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-accent/10 pb-6">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">GoCast.fm broadcasting</p>
          <h1 className="mt-2 font-heading text-3xl">Radio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">Follow the approved broadcast steps below. Your Radio administrator must provide the GoCast.fm setup link, approved app or device, and connection details.</p>
        </header>

        <MobileBroadcastGuide audience="contributor" />

        {showLegacySubmissionTools && (
          <>
            {feedback && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300" role="status">{feedback}</div>}

            <section className="rounded-xl border border-accent/15 bg-card/30 p-5 sm:p-7">
          <div className="flex items-start gap-3"><Radio size={19} className="mt-0.5 text-emerald-400" /><div><h2 className="font-heading text-xl">Submit a recording</h2><p className="mt-1 text-xs text-muted-foreground">The current foundation records metadata only. File transfer stays blocked until an approved storage provider is configured.</p></div></div>
          <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["title", "Title", "text"],
              ["titleUrdu", "Urdu title", "text"],
              ["originalFilename", "Audio filename", "text"],
              ["sizeBytes", "File size in bytes", "number"],
              ["durationMs", "Duration in milliseconds", "number"],
            ].map(([key, label, type]) => <label key={key} className="space-y-2"><span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span><input required={["title", "originalFilename"].includes(key)} type={type} value={form[key as keyof typeof form]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" /></label>)}
            <label className="space-y-2"><span className="text-xs uppercase tracking-wider text-muted-foreground">Content category</span><select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"><option value="poetry">Poetry</option><option value="ghazal">Ghazal</option><option value="music">Music</option><option value="naat_special">Naat / Special</option><option value="literary_program">Literary program</option><option value="interview">Interview</option><option value="recorded_program">Recorded program</option><option value="live_program">Live program</option><option value="station_promo">Station / promo</option></select></label>
            <label className="space-y-2"><span className="text-xs uppercase tracking-wider text-muted-foreground">Format</span><select value={form.contentType} onChange={(event) => setForm((current) => ({ ...current, contentType: event.target.value }))} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"><option value="audio/mpeg">MP3</option><option value="audio/mp4">M4A</option><option value="audio/aac">AAC</option></select></label>
            <label className="space-y-2"><span className="text-xs uppercase tracking-wider text-muted-foreground">Rights status</span><select value={form.rightsStatus} onChange={(event) => setForm((current) => ({ ...current, rightsStatus: event.target.value }))} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"><option value="unknown">Unknown</option><option value="cleared">Cleared</option><option value="restricted">Restricted</option></select></label>
            <label className="space-y-2 sm:col-span-2"><span className="text-xs uppercase tracking-wider text-muted-foreground">Description and rights notes</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value, rightsNotes: event.target.value }))} rows={4} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" /></label>
             <div className="sm:col-span-2 flex gap-2"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm text-background disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={15} />{saving ? "Saving…" : editingId ? "Resubmit for review" : "Submit for review"}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(initialForm); }} className="rounded-lg border border-accent/20 px-4 py-2.5 text-sm text-accent">Cancel</button>}</div>
          </form>
            </section>

            <section className="rounded-xl border border-accent/15 bg-card/30">
          <div className="border-b border-accent/10 px-5 py-4"><h2 className="font-heading text-xl">My Radio submissions</h2></div>
           {loading ? <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" size={16} /> Loading submissions…</div> : submissions.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No Radio submissions yet.</p> : <div className="divide-y divide-accent/10">{submissions.map((item) => <div key={item.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-start"><div><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.originalFilename} · {item.category ?? "Uncategorized"} · rights: {item.rightsStatus}</p>{item.rightsStatus !== "cleared" && <p className="mt-1 text-xs text-amber-300">Rights information is not cleared for broadcast yet{item.rightsNotes ? `: ${item.rightsNotes}` : "."}</p>}{item.rejectionReason && <p className="mt-1 text-xs text-destructive">Rejected: {item.rejectionReason}</p>}</div><div className="flex items-center gap-3"><span className="text-xs uppercase tracking-wider text-emerald-400">{item.editorialStatus} · {item.processingStatus}</span>{["draft", "rejected"].includes(item.editorialStatus) && <button type="button" onClick={() => { setEditingId(item.id); setForm({ title: item.title, titleUrdu: item.titleUrdu, description: item.description, category: item.category ?? "poetry", originalFilename: item.originalFilename, sizeBytes: "1", durationMs: "60000", contentType: "audio/mpeg", rightsStatus: item.rightsStatus, rightsNotes: item.rightsNotes ?? "", rightsValidFrom: "", rightsValidUntil: "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs text-accent hover:underline">Edit / resubmit</button>}</div></div>)}</div>}
            </section>
          </>
        )}
      </div>
    </ContributorLayout>
  );
}