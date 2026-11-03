import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, BookOpen, Feather, Video, LogOut, Image, Mail, Settings,
  Database, FolderOpen, Users, Shield, Code2, Wrench, UserPlus, Clock, Radio, Languages, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminAuth, adminFetch } from "@/hooks/use-admin-auth";

const commonLinks = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/poems", label: "Poems", icon: BookOpen },
  { href: "/admin/poets", label: "Poets", icon: Feather },
  { href: "/admin/videos", label: "Videos", icon: Video },
  { href: "/admin/categories", label: "Categories", icon: FolderOpen },
  { href: "/admin/visual-poetry", label: "Visual Poetry", icon: Image },
  { href: "/admin/messages", label: "Messages", icon: Mail },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/tools", label: "Tools", icon: Wrench },
  { href: "/irab", label: "اِعْراب — e'raab", icon: Languages },
  { href: "/admin/radio", label: "Radio", icon: Radio },
  { href: "/admin/radio-calendar", label: "Radio Calendar", icon: CalendarDays },
];

const contributorLinks = [
  { href: "/admin/contributors", label: "Contributors", icon: UserPlus },
  { href: "/admin/contributor-applications", label: "Applications", icon: UserPlus },
  { href: "/admin/pending", label: "Pending Approvals", icon: Clock },
];

const developerLinks = [
  { href: "/admin/backups", label: "Backups", icon: Database },
  { href: "/admin/users", label: "User Management", icon: Users },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { email, role, logout } = useAdminAuth();
  const isDev = role === "developer";
  const [pendingCount, setPendingCount] = useState(0);

  // Load pending count badge
  useEffect(() => {
    adminFetch("/api/admin/pending?limit=1")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.total) setPendingCount(Number(d.total)); })
      .catch(() => {});
  }, [location]);

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  const allLinks = isDev
    ? [...commonLinks, ...contributorLinks, ...developerLinks]
    : [...commonLinks, ...contributorLinks];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-accent/10 bg-card/30 lg:w-56 lg:border-b-0 lg:border-r">
        <div className="border-b border-accent/10 px-4 py-4 lg:px-6 lg:py-8">
          <Link href="/" className="font-heading font-bold text-accent tracking-widest text-sm">
            SURUUREMAN
          </Link>
          <p className="text-xs text-muted-foreground/50 tracking-widest uppercase mt-1">Admin Panel</p>
        </div>

        <div className="px-6 py-3 border-b border-accent/10">
          {isDev ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[10px] font-heading tracking-widest uppercase text-blue-400">Developer</span>
              <Code2 size={10} className="text-blue-400 ml-auto" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-heading tracking-widest uppercase text-accent">Administrator</span>
              <Shield size={10} className="text-accent ml-auto" />
            </div>
          )}
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:py-6">
          {allLinks.map((link) => {
            const isActive = location.startsWith(link.href);
            const isDevLink = developerLinks.some((d) => d.href === link.href);
            const isContribLink = contributorLinks.some((c) => c.href === link.href);
            const isPendingLink = link.href === "/admin/pending";

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                  isActive
                    ? isDevLink
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      : isContribLink
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-accent/10 text-accent border border-accent/20"
                    : isDevLink
                      ? "text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/5"
                      : isContribLink
                        ? "text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
                )}
              >
                <link.icon size={16} />
                <span className="flex-1">{link.label}</span>
                {isPendingLink && pendingCount > 0 && (
                  <span className="text-[10px] font-heading tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-between gap-3 border-t border-accent/10 px-3 py-2 lg:block lg:py-4">
          <p className="px-3 text-xs text-muted-foreground/40 truncate mb-2">{email}</p>
          <button
            onClick={handleLogout}
            className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-all duration-200 hover:bg-destructive/5 hover:text-destructive lg:w-full"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
