import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, BookOpen, Plus, LogOut, Feather, User, Radio, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminAuth } from "@/hooks/use-admin-auth";

const navLinks = [
  { href: "/contributor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contributor/submissions", label: "My Submissions", icon: BookOpen },
  { href: "/contributor/poems/new", label: "New Poem", icon: Plus },
  { href: "/contributor/poets/new", label: "New Poet", icon: Feather },
  { href: "/irab", label: "اِعْراب — e'raab", icon: Languages },
  { href: "/contributor/radio", label: "Radio", icon: Radio },
];

export function ContributorLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { email, name, logout } = useAdminAuth();

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-56 shrink-0 border-r border-accent/10 flex flex-col bg-card/30">
        <div className="px-6 py-8 border-b border-accent/10">
          <Link href="/" className="font-heading font-bold text-accent tracking-widest text-sm">
            SURUUREMAN
          </Link>
          <p className="text-xs text-muted-foreground/50 tracking-widest uppercase mt-1">Contributor</p>
        </div>

        <div className="px-6 py-3 border-b border-accent/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-heading tracking-widest uppercase text-emerald-400">Contributor</span>
            <User size={10} className="text-emerald-400 ml-auto" />
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 flex flex-col gap-1 overflow-y-auto">
          {navLinks.map((link) => {
            const isActive = location.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
                )}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-accent/10">
          <p className="px-3 text-xs text-muted-foreground/40 truncate mb-1">{name || email}</p>
          <p className="px-3 text-[10px] text-muted-foreground/30 truncate mb-2">{email}</p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all duration-200"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
