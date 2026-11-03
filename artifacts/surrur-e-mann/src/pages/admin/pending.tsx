import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Eye, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getPoemLanguageLabel } from "@/lib/poem-languages";

interface PendingPoem {
  id: number;
  title: string;
  titleUrdu: string;
  content: string;
  poetName: string;
  poetNameUrdu: string;
  category: string;
  language: string;
  status: string;
  createdByUserId: number | null;
  createdAt: string;
  contributorName: string | null;
  contributorEmail: string | null;
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPending() {
  const { toast } = useToast();
  const [poems, setPoems] = useState<PendingPoem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<{ poem: PendingPoem } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/pending?limit=100");
      if (res.ok) {
        const d = await res.json();
        setPoems(d.poems);
        setTotal(d.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id: number) {
    setActionId(id);
    try {
      const res = await adminFetch(`/api/admin/poems/${id}/approve`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Poem approved and published" });
        setPoems((p) => p.filter((x) => x.id !== id));
        setTotal((t) => t - 1);
        if (expanded === id) setExpanded(null);
      } else {
        toast({ title: d.message || "Failed to approve", variant: "destructive" });
      }
    } finally { setActionId(null); }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast({ title: "Rejection reason required", variant: "destructive" }); return;
    }
    const id = rejectModal!.poem.id;
    setRejecting(true);
    try {
      const res = await adminFetch(`/api/admin/poems/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Poem rejected — contributor notified via their submissions page" });
        setPoems((p) => p.filter((x) => x.id !== id));
        setTotal((t) => t - 1);
        setRejectModal(null);
        setRejectReason("");
        if (expanded === id) setExpanded(null);
      } else {
        toast({ title: d.message || "Failed to reject", variant: "destructive" });
      }
    } finally { setRejecting(false); }
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-3xl tracking-wider text-foreground">Pending Approvals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading ? "Loading…" : total === 0 ? "No pending submissions" : `${total} submission${total !== 1 ? "s" : ""} awaiting review`}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="text-accent animate-spin" />
          </div>
        ) : poems.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <CheckCircle size={48} className="mx-auto mb-4 text-emerald-400/30" />
            <p className="font-heading text-lg tracking-wider text-emerald-400/60">All caught up</p>
            <p className="text-sm mt-1">No poems waiting for review.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {poems.map((poem) => (
              <div
                key={poem.id}
                className="bg-card/30 border border-accent/10 rounded-xl overflow-hidden transition-all"
              >
                {/* Summary row */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-heading text-foreground tracking-wide">{poem.title}</span>
                      <span className="text-muted-foreground text-sm font-urdu">{poem.titleUrdu}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>{poem.poetName}</span>
                      <span className="opacity-30">·</span>
                      <span className="capitalize">{poem.category}</span>
                      <span className="opacity-30">·</span>
                      <span>{getPoemLanguageLabel(poem.language)}</span>
                      <span className="opacity-30">·</span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {formatDateTime(poem.createdAt)}
                      </span>
                    </div>
                    {poem.contributorName && (
                      <p className="text-xs text-emerald-400/70 mt-1">
                        Submitted by {poem.contributorName} ({poem.contributorEmail})
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setExpanded(expanded === poem.id ? null : poem.id)}
                      className="p-2 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
                      title="Preview content"
                    >
                      {expanded === poem.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(poem.id)}
                      disabled={actionId === poem.id}
                      className="gap-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white h-8"
                    >
                      {actionId === poem.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setRejectModal({ poem }); setRejectReason(""); }}
                      disabled={actionId === poem.id}
                      className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 h-8"
                    >
                      <XCircle size={12} /> Reject
                    </Button>
                  </div>
                </div>

                {/* Expanded content preview */}
                {expanded === poem.id && (
                  <div className="border-t border-accent/10 px-6 py-5 bg-background/20">
                    <p className="text-xs text-muted-foreground/60 tracking-widest uppercase mb-3">Poem Content</p>
                    <pre className="whitespace-pre-wrap font-urdu text-right text-foreground leading-loose text-base bg-card/40 rounded-xl p-5 border border-accent/10 overflow-auto max-h-80 dir-rtl">
                      {poem.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-destructive/20 rounded-2xl p-8 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <XCircle size={20} className="text-destructive" />
              <h2 className="font-heading text-xl tracking-wider">Reject Poem</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Rejecting <strong className="text-foreground">"{rejectModal.poem.title}"</strong>.
              The contributor will see your reason in their submissions page.
            </p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground tracking-widest uppercase">Reason for Rejection</label>
              <Textarea
                placeholder="Explain why this poem is being rejected (required)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRejectModal(null)} className="flex-1">Cancel</Button>
              <Button
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                className="flex-1 gap-2 bg-destructive/80 hover:bg-destructive text-white"
              >
                {rejecting && <Loader2 size={14} className="animate-spin" />}
                Reject Poem
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
