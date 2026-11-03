import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ContributorLayout } from "@/components/contributor-layout";
import { contributorFetch } from "@/hooks/use-admin-auth";
import { Clock, CheckCircle, XCircle, BookOpen, Plus, Loader2, Feather } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Submission {
  id: number;
  title: string;
  titleUrdu: string;
  poetName: string;
  poetNameUrdu: string;
  category: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
}

type StatusFilter = "all" | "pending" | "published" | "rejected";

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30", icon: Clock },
  published: { label: "Published", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", icon: CheckCircle },
  rejected: { label: "Rejected", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: XCircle },
  draft: { label: "Draft", color: "text-muted-foreground", bg: "bg-muted/10 border-muted/30", icon: BookOpen },
};

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ContributorSubmissions() {
  const [poems, setPoems] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await contributorFetch(`/api/contributor/submissions?${params}`);
      if (res.ok) {
        const d = await res.json();
        setPoems(d.poems);
        setTotal(d.total);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "published", label: "Published" },
    { key: "rejected", label: "Rejected" },
  ];

  const isEditable = (status: string) => ["pending", "rejected", "draft"].includes(status);

  return (
    <ContributorLayout>
      <div className="space-y-8 max-w-4xl">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-heading text-3xl tracking-wider text-foreground">My Submissions</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {total} submission{total !== 1 ? "s" : ""}
            </p>
          </div>
          <Link href="/contributor/poems/new">
            <Button className="gap-2">
              <Plus size={16} /> New Poem
            </Button>
          </Link>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 border-b border-accent/10 pb-0">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                "px-4 py-2.5 text-sm font-heading tracking-wider transition-all border-b-2 -mb-px",
                statusFilter === key
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="text-accent animate-spin" />
          </div>
        ) : poems.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Feather size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {statusFilter === "all" ? "No submissions yet" : `No ${statusFilter} submissions`}
            </p>
            {statusFilter === "all" && (
              <Link href="/contributor/poems/new">
                <Button variant="outline" size="sm" className="mt-4 gap-2">
                  <Plus size={14} /> Submit Your First Poem
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {poems.map((poem) => {
              const cfg = statusConfig[poem.status] || statusConfig.pending;
              return (
                <div
                  key={poem.id}
                  className="bg-card/30 border border-accent/10 rounded-xl p-5 hover:border-accent/20 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium text-foreground">{poem.title}</span>
                        <span className="text-muted-foreground/50 text-sm font-urdu">{poem.titleUrdu}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {poem.poetName} · {poem.category} · Submitted {formatDate(poem.createdAt)}
                        {poem.status === "published" && poem.approvedAt && ` · Approved ${formatDate(poem.approvedAt)}`}
                        {poem.status === "rejected" && poem.rejectedAt && ` · Rejected ${formatDate(poem.rejectedAt)}`}
                      </p>
                      {poem.status === "rejected" && poem.rejectionReason && (
                        <div className="mt-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                          <p className="text-xs text-destructive/80"><strong>Reason:</strong> {poem.rejectionReason}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">You can edit and resubmit this poem.</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={cn("flex items-center gap-1.5 text-xs font-heading tracking-wide border rounded-full px-2.5 py-1", cfg.color, cfg.bg)}>
                        <cfg.icon size={11} /> {cfg.label}
                      </span>
                      {isEditable(poem.status) && (
                        <Link href={`/contributor/poems/${poem.id}/edit`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            {poem.status === "rejected" ? "Edit & Resubmit" : "Edit"}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ContributorLayout>
  );
}
