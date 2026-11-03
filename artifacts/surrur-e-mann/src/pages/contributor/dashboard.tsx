import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ContributorLayout } from "@/components/contributor-layout";
import { contributorFetch } from "@/hooks/use-admin-auth";
import { Plus, BookOpen, Clock, CheckCircle, XCircle, Feather, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Stats {
  total: number;
  pending: number;
  published: number;
  rejected: number;
}

interface RecentPoem {
  id: number;
  title: string;
  titleUrdu: string;
  poetName: string;
  status: string;
  createdAt: string;
  rejectionReason?: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending Review", color: "text-amber-400", icon: Clock },
  published: { label: "Published", color: "text-emerald-400", icon: CheckCircle },
  rejected: { label: "Rejected", color: "text-destructive", icon: XCircle },
  draft: { label: "Draft", color: "text-muted-foreground", icon: BookOpen },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ContributorDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentPoems, setRecentPoems] = useState<RecentPoem[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      contributorFetch("/api/contributor/me").then((r) => r.ok ? r.json() : null),
      contributorFetch("/api/contributor/submissions?limit=5").then((r) => r.ok ? r.json() : null),
    ]).then(([me, subs]) => {
      if (me) { setStats(me.stats); setName(me.name); }
      if (subs) setRecentPoems(subs.poems);
    }).finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: "Total Submitted", value: stats?.total ?? 0, icon: BookOpen, color: "text-accent" },
    { label: "Pending Review", value: stats?.pending ?? 0, icon: Clock, color: "text-amber-400" },
    { label: "Published", value: stats?.published ?? 0, icon: CheckCircle, color: "text-emerald-400" },
    { label: "Rejected", value: stats?.rejected ?? 0, icon: XCircle, color: "text-destructive" },
  ];

  return (
    <ContributorLayout>
      <div className="space-y-8 max-w-4xl">
        {/* Welcome */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-heading text-3xl tracking-wider text-foreground">
              Welcome{name ? `, ${name}` : ""}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your poem submissions and track their status.</p>
          </div>
          <Link href="/contributor/poems/new">
            <Button className="gap-2">
              <Plus size={16} /> New Poem
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="text-accent animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statCards.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-card/30 border border-accent/10 rounded-xl p-5 space-y-3">
                  <div className={cn("flex items-center gap-2", color)}>
                    <Icon size={16} />
                    <span className="text-xs font-heading tracking-widest uppercase">{label}</span>
                  </div>
                  <p className={cn("font-heading text-4xl", color)}>{value}</p>
                </div>
              ))}
            </div>

            {/* Recent Submissions */}
            <div className="bg-card/30 border border-accent/10 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-accent/10">
                <h2 className="font-heading tracking-wider text-foreground">Recent Submissions</h2>
                <Link href="/contributor/submissions" className="text-xs text-accent hover:text-accent/80 transition-colors">
                  View all →
                </Link>
              </div>

              {recentPoems.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Feather size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No submissions yet</p>
                  <Link href="/contributor/poems/new">
                    <Button variant="outline" size="sm" className="mt-4 gap-2">
                      <Plus size={14} /> Submit Your First Poem
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-accent/5">
                  {recentPoems.map((poem) => {
                    const cfg = statusConfig[poem.status] || statusConfig.pending;
                    return (
                      <div key={poem.id} className="px-6 py-4 hover:bg-accent/3 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-foreground truncate">{poem.title}</span>
                              <span className="text-muted-foreground/50 text-sm font-urdu shrink-0">{poem.titleUrdu}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{poem.poetName} · {formatDate(poem.createdAt)}</p>
                            {poem.status === "rejected" && poem.rejectionReason && (
                              <p className="text-xs text-destructive/70 mt-1 italic">Reason: {poem.rejectionReason}</p>
                            )}
                          </div>
                          <div className="shrink-0 flex items-center gap-3">
                            <div className={cn("flex items-center gap-1.5 text-xs font-heading tracking-wide", cfg.color)}>
                              <cfg.icon size={12} />
                              {cfg.label}
                            </div>
                            {(poem.status === "pending" || poem.status === "rejected" || poem.status === "draft") && (
                              <Link href={`/contributor/poems/${poem.id}/edit`} className="text-xs text-accent hover:underline">
                                Edit
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

            {/* Quick Tips */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
              <h3 className="font-heading text-sm tracking-widest uppercase text-emerald-400 mb-3">Submission Guidelines</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• Submit authentic Urdu poetry with correct poet attribution</li>
                <li>• Ensure both English transliteration and Urdu titles are provided</li>
                <li>• Poems are reviewed by our editors before publication (usually within 48 hours)</li>
                <li>• Rejected poems can be edited and resubmitted — they will be queued for review again</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </ContributorLayout>
  );
}
