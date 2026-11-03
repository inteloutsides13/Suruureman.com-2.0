import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch, useAdminAuth } from "@/hooks/use-admin-auth";
import { BookOpen, Feather, Video, Plus, Heart, Eye, Share2, TrendingUp, Code2, Shield } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Stats {
  poems: number; poets: number; videos: number;
  totalLikes: number; totalViews: number; totalShares: number;
}

interface AnalyticsDay { day: string; likes: number; views: number; shares: number; }

interface TopPoem {
  id: number; title: string; titleUrdu: string; poetName: string;
  likes: number; views: number; shares: number;
}

interface TopPoems { byLikes: TopPoem[]; byViews: TopPoem[]; byShares: TopPoem[]; }

type Range = "7d" | "30d" | "custom";

function formatDay(day: string) {
  const d = new Date(day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AdminDashboard() {
  const { email, role } = useAdminAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsDay[]>([]);
  const [topPoems, setTopPoems] = useState<TopPoems | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [range, setRange] = useState<Range>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    adminFetch("/api/admin/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setStats(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
    adminFetch("/api/admin/top-poems")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setTopPoems(d); })
      .catch(console.error);
  }, []);

  const loadAnalytics = useCallback(() => {
    setAnalyticsLoading(true);
    let url = `/api/admin/analytics?range=${range}`;
    if (range === "custom" && customStart && customEnd) {
      url = `/api/admin/analytics?start=${customStart}&end=${customEnd}`;
    }
    adminFetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setAnalytics(d.data || []); })
      .catch(console.error)
      .finally(() => setAnalyticsLoading(false));
  }, [range, customStart, customEnd]);

  useEffect(() => {
    if (range !== "custom") loadAnalytics();
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = analytics.map((d) => ({ ...d, day: formatDay(d.day) }));

  const contentCards = [
    { label: "Poems", count: stats?.poems, icon: BookOpen, href: "/admin/poems", addHref: "/admin/poems/new" },
    { label: "Poets", count: stats?.poets, icon: Feather, href: "/admin/poets", addHref: "/admin/poets/new" },
    { label: "Videos", count: stats?.videos, icon: Video, href: "/admin/videos", addHref: "/admin/videos/new" },
  ];

  const engagementCards = [
    { label: "Total Likes", value: stats?.totalLikes, icon: Heart, color: "text-red-400" },
    { label: "Total Views", value: stats?.totalViews, icon: Eye, color: "text-blue-400" },
    { label: "Total Shares", value: stats?.totalShares, icon: Share2, color: "text-green-400" },
  ];

  const inputCls = "bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-3 py-1.5 text-foreground font-sans text-xs transition-colors";

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground tracking-wider mb-2">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of your content library and analytics.</p>
          </div>
          <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border self-start ${
            role === "developer"
              ? "bg-blue-500/10 border-blue-500/20"
              : "bg-accent/10 border-accent/20"
          }`}>
            {role === "developer" ? (
              <Code2 size={14} className="text-blue-400" />
            ) : (
              <Shield size={14} className="text-accent" />
            )}
            <div>
              <p className={`text-[10px] font-heading tracking-widest uppercase ${role === "developer" ? "text-blue-400" : "text-accent"}`}>
                {role === "developer" ? "Developer Account" : "Administrator Account"}
              </p>
              <p className="text-[10px] text-muted-foreground/60 truncate max-w-[180px]">{email}</p>
            </div>
          </div>
        </div>

        {/* Content counts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {contentCards.map(({ label, count, icon: Icon, href, addHref }) => (
            <div key={label} className="bg-card/40 border border-accent/15 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Icon size={16} className="text-accent" />
                  </div>
                  <span className="font-heading text-sm tracking-widest uppercase text-muted-foreground">{label}</span>
                </div>
                <Link href={addHref} className="text-accent hover:text-accent/80 transition-colors">
                  <Plus size={18} />
                </Link>
              </div>
              <p className="font-heading text-4xl font-bold text-foreground">
                {loading ? <span className="animate-pulse text-accent/30">—</span> : count ?? 0}
              </p>
              <Link href={href} className="mt-4 text-xs text-accent/60 hover:text-accent tracking-widest uppercase transition-colors inline-block">
                Manage →
              </Link>
            </div>
          ))}
        </div>

        {/* Engagement totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {engagementCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card/40 border border-accent/15 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent/5 border border-accent/10 flex items-center justify-center shrink-0">
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className="font-heading text-xs tracking-widest uppercase text-muted-foreground mb-1">{label}</p>
                <p className="font-heading text-2xl font-bold text-foreground">
                  {loading ? <span className="animate-pulse text-accent/30">—</span> : (value ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Analytics Charts */}
        <div className="bg-card/40 border border-accent/15 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              <h2 className="font-heading text-sm tracking-widest uppercase text-foreground">Engagement Over Time</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["7d", "30d", "custom"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded-lg text-xs font-heading tracking-widest uppercase transition-all ${range === r ? "bg-accent text-background" : "border border-accent/20 text-muted-foreground hover:text-foreground"}`}
                >
                  {r === "7d" ? "Last 7 Days" : r === "30d" ? "Last 30 Days" : "Custom"}
                </button>
              ))}
              {range === "custom" && (
                <>
                  <input type="date" className={inputCls} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                  <span className="text-muted-foreground text-xs">to</span>
                  <input type="date" className={inputCls} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                  <button
                    onClick={loadAnalytics}
                    disabled={!customStart || !customEnd}
                    className="px-3 py-1 rounded-lg text-xs font-heading tracking-widest uppercase bg-accent text-background disabled:opacity-40 transition-all"
                  >
                    Apply
                  </button>
                </>
              )}
            </div>
          </div>

          {analyticsLoading ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm animate-pulse">Loading chart...</div>
          ) : chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No data for this period yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid rgba(201,168,76,0.2)", borderRadius: "12px", fontSize: "12px" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} />
                <Line type="monotone" dataKey="likes" stroke="#f87171" strokeWidth={2} dot={false} name="Likes" />
                <Line type="monotone" dataKey="views" stroke="#60a5fa" strokeWidth={2} dot={false} name="Views" />
                <Line type="monotone" dataKey="shares" stroke="#4ade80" strokeWidth={2} dot={false} name="Shares" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Content */}
        {topPoems && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Top by Likes", data: topPoems.byLikes, key: "likes" as const, color: "text-red-400" },
              { label: "Top by Views", data: topPoems.byViews, key: "views" as const, color: "text-blue-400" },
              { label: "Top by Shares", data: topPoems.byShares, key: "shares" as const, color: "text-green-400" },
            ].map(({ label, data, key, color }) => (
              <div key={label} className="bg-card/40 border border-accent/15 rounded-2xl p-6">
                <h3 className="font-heading text-xs tracking-widest uppercase text-muted-foreground mb-4">{label}</h3>
                <div className="space-y-3">
                  {data.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data yet.</p>
                  ) : data.map((poem, i) => (
                    <div key={poem.id} className="flex items-center gap-3">
                      <span className="font-heading text-xs text-accent/40 w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-urdu text-sm text-foreground truncate">{poem.titleUrdu}</p>
                        <p className="font-sans text-xs text-muted-foreground truncate">{poem.poetName}</p>
                      </div>
                      <span className={`font-heading text-sm font-bold ${color}`}>
                        {poem[key].toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
