import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, BookOpen, Feather, Video, Home, Search, Mail, Wrench, Radio, UserPlus, LogIn, LayoutDashboard, ArrowRight, Languages } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { hasIrabAccessRole, useAdminAuth } from "@/hooks/use-admin-auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FooterDeveloperCredit } from "@/components/footer-developer-credit";
import { SocialLinks } from "@/components/social-links";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { isAuthenticated, role } = useAdminAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const canAccessIrab = isAuthenticated && hasIrabAccessRole(role);
  const navLinks = [
    { href: "/", label: "Home", labelUrdu: "مرکزی صفحہ", icon: Home },
    { href: "/poems", label: "Poetry", labelUrdu: "شاعری", icon: BookOpen },
    { href: "/poets", label: "Poets", labelUrdu: "شعراء", icon: Feather },
    { href: "/videos", label: "Videos", labelUrdu: "ویڈیوز", icon: Video },
    { href: "/tools", label: "Tools", labelUrdu: "ٹولز", icon: Wrench },
    { href: "/irab", label: "e'raab", labelUrdu: "اِعْراب", icon: Languages },
    { href: "/radio", label: "Radio", labelUrdu: "ریڈیو", icon: Radio },
    { href: "/contact", label: "Contact", labelUrdu: "رابطہ", icon: Mail },
  ].filter((link) => link.href !== "/irab" || canAccessIrab);

  const accountDestination = role === "contributor" ? "/contributor/dashboard" : "/admin/dashboard";
  const accountLabel = role === "contributor" ? "OPEN CONTRIBUTOR DASHBOARD" : "OPEN ADMIN DASHBOARD";
  const accountDescription = role === "contributor" ? "Continue to your Contributor workspace" : "Continue to your Admin workspace";

  function closeAccess() {
    setAccessOpen(false);
  }

  function goToAccessDestination(destination: string) {
    setAccessOpen(false);
    setMobileMenuOpen(false);
    navigate(destination);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Navbar */}
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-all duration-500 border-b",
          isScrolled
            ? "bg-background/80 backdrop-blur-xl border-accent/20 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
            : "bg-transparent border-transparent py-5"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 max-[360px]:gap-2">
            <Link href="/" aria-label="Surrur-e-Mann home" className="group flex min-w-0 shrink-0 items-center gap-2 max-[360px]:gap-1">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-accent/30 shadow-lg shadow-accent/10 transition-colors group-hover:border-accent max-[360px]:h-8 max-[360px]:w-8 md:h-12 md:w-12">
                <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Surrur-e-Mann logo" className="w-full h-full object-cover" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="whitespace-nowrap font-heading text-xs font-bold tracking-[0.03em] text-foreground transition-colors group-hover:text-accent min-[380px]:hidden">
                  SURRUR
                </span>
                <span className="whitespace-nowrap font-heading text-xs font-bold tracking-[0.03em] text-foreground transition-colors group-hover:text-accent max-[379px]:hidden sm:text-sm md:text-xl md:tracking-wider">
                  SURRUR-E-MANN
                </span>
                <span className="mt-[-0.25rem] hidden text-right font-urdu text-xs text-accent/80 sm:block">سُرُورِ مَن</span>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => {
                const isActive = location === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-testid={link.href === "/radio" ? "link-header-radio-desktop" : undefined}
                    className="relative group py-2 flex flex-col items-center"
                  >
                    <span className={cn("text-sm tracking-widest transition-colors duration-300", link.href === "/irab" ? "normal-case" : "uppercase", isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground")}>
                      {link.label}
                    </span>
                    <span className={cn("font-urdu text-sm mt-1 transition-colors duration-300", isActive ? "text-accent text-glow-gold" : "text-muted-foreground/50 group-hover:text-accent/80")}>
                      {link.labelUrdu}
                    </span>
                    {isActive && <motion.div layoutId="navbar-indicator" className="absolute bottom-0 left-0 right-0 h-px bg-accent shadow-[0_0_8px_rgba(212,175,55,0.8)]" />}
                  </Link>
                );
              })}
            </nav>

            <Link href="/search" className="hidden lg:flex p-2 text-muted-foreground hover:text-accent transition-colors duration-300" title="Search">
              <Search size={18} />
            </Link>
            <button
              type="button"
              onClick={() => setAccessOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-accent/30 px-2.5 py-2 text-accent transition-colors duration-300 hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:gap-2 sm:px-3"
              title="Login or become a Contributor"
              aria-label="Login or become a Contributor"
              aria-haspopup="dialog"
            >
              <LogIn size={15} aria-hidden="true" />
              <span className="hidden text-[10px] uppercase tracking-widest min-[421px]:inline sm:hidden">Login</span>
              <span className="hidden text-[10px] uppercase tracking-widest sm:inline">Login / Contribute</span>
            </button>

            <Link
              href="/radio"
              data-testid="link-header-radio-mobile"
              dir="ltr"
              aria-label="Radio"
              aria-current={location === "/radio" ? "page" : undefined}
              title="Radio"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/25 px-2.5 text-accent transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden",
                location === "/radio" && "border-primary/55 bg-primary/30",
              )}
            >
              <Radio size={15} aria-hidden="true" />
              <span className="text-[10px] font-medium tracking-wide">Radio</span>
            </Link>

            <button
              type="button"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
              className="lg:hidden p-2 text-foreground hover:text-accent transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            id="mobile-navigation-menu"
            className="fixed inset-0 z-40 flex h-[100dvh] min-h-0 flex-col items-center border-b border-accent/20 bg-background/95 px-4 pt-[calc(6rem+env(safe-area-inset-top))] backdrop-blur-3xl lg:hidden"
          >
            <div className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2">
              <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
                {/* Home */}
                {[navLinks[0], navLinks[1]].map((link) => {
                  const isActive = location === link.href;
                  return (
                    <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                      className={cn("flex w-full flex-col items-center border-b border-accent/10 py-4 transition-colors", isActive ? "text-accent" : "text-muted-foreground")}
                    >
                      <link.icon className="mb-2 opacity-50" size={20} />
                      <span className={cn("mb-1 text-lg tracking-widest", link.href === "/irab" ? "normal-case" : "uppercase")}>{link.label}</span>
                      <span className="font-urdu text-xl text-accent/80">{link.labelUrdu}</span>
                    </Link>
                  );
                })}
                {/* Search — third position for easy mobile access */}
                <Link href="/search" onClick={() => setMobileMenuOpen(false)}
                  className={cn("flex w-full flex-col items-center border-b border-accent/10 py-4 transition-colors", location === "/search" ? "text-accent" : "text-muted-foreground")}
                >
                  <Search className="mb-2 opacity-50" size={20} />
                  <span className="mb-1 text-lg tracking-widest uppercase">Search</span>
                  <span className="font-urdu text-xl text-accent/80">تلاش</span>
                </Link>
                {/* Poets, Videos, Tools, Contact */}
                {navLinks.slice(2).map((link) => {
                  const isActive = location === link.href;
                  return (
                    <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                      className={cn("flex w-full flex-col items-center border-b border-accent/10 py-4 transition-colors", isActive ? "text-accent" : "text-muted-foreground")}
                    >
                      <link.icon className="mb-2 opacity-50" size={20} />
                      <span className="mb-1 text-lg tracking-widest uppercase">{link.label}</span>
                      <span className="font-urdu text-xl text-accent/80">{link.labelUrdu}</span>
                    </Link>
                  );
                })}
                <Link href="/become-a-contributor" onClick={() => setMobileMenuOpen(false)}
                  className={cn("flex w-full flex-col items-center border-b border-accent/10 py-4 transition-colors", location === "/become-a-contributor" ? "text-accent" : "text-muted-foreground")}
                >
                  <UserPlus className="mb-2 opacity-50" size={20} />
                  <span className="mb-1 text-lg tracking-widest uppercase">Become a Contributor</span>
                  <span className="font-urdu text-xl text-accent/80">شریکِ کار بنیں</span>
                </Link>
                <Link href="/contributor-status" onClick={() => setMobileMenuOpen(false)}
                  className={cn("flex w-full flex-col items-center border-b border-accent/10 py-4 transition-colors", location === "/contributor-status" ? "text-accent" : "text-muted-foreground")}
                >
                  <Search className="mb-2 opacity-50" size={20} />
                  <span className="mb-1 text-lg tracking-widest uppercase">Check Application Status</span>
                  <span className="font-urdu text-xl text-accent/80">درخواست کی صورتحال</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="z-[60] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border-accent/30 bg-card/95 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:max-w-md sm:p-7">
          <DialogHeader className="pr-7 text-center sm:text-center">
            <DialogTitle className="font-heading text-xl tracking-[0.16em] text-accent sm:text-2xl">
              WELCOME TO SURRUR-E-MANN
            </DialogTitle>
            <DialogDescription className="pt-1 text-sm text-muted-foreground">
              Choose how you would like to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 pt-2">
            <button
              type="button"
              onClick={() => goToAccessDestination(isAuthenticated ? accountDestination : "/admin/login")}
              className="group flex min-h-16 items-center gap-4 rounded-xl border border-accent/25 bg-background/40 px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-accent/25 bg-accent/10 text-accent">
                {isAuthenticated ? <LayoutDashboard size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium uppercase tracking-[0.14em] text-foreground">
                  {isAuthenticated ? accountLabel : "LOGIN"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {isAuthenticated ? accountDescription : "Admin / Contributor"}
                </span>
              </span>
              <ArrowRight className="shrink-0 text-accent/70 transition-transform group-hover:translate-x-1" size={17} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => goToAccessDestination("/become-a-contributor")}
              className="group flex min-h-16 items-center gap-4 rounded-xl border border-accent/25 bg-background/40 px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-accent/25 bg-accent/10 text-accent">
                <UserPlus size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium uppercase tracking-[0.14em] text-foreground">BECOME A CONTRIBUTOR</span>
                <span className="mt-1 block text-xs text-muted-foreground">Apply to share your work with Surrur-e-Mann</span>
              </span>
              <ArrowRight className="shrink-0 text-accent/70 transition-transform group-hover:translate-x-1" size={17} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => goToAccessDestination("/contributor-status")}
              className="group flex min-h-16 items-center gap-4 rounded-xl border border-accent/25 bg-background/40 px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-accent/25 bg-accent/10 text-accent">
                <Search size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium uppercase tracking-[0.14em] text-foreground">CHECK APPLICATION STATUS</span>
                <span className="mt-1 block text-xs text-muted-foreground">Check your Contributor application</span>
              </span>
              <ArrowRight className="shrink-0 text-accent/70 transition-transform group-hover:translate-x-1" size={17} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={closeAccess}
              className="flex min-h-12 items-center justify-center rounded-xl border border-foreground/10 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              CONTINUE AS VISITOR
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <main className="flex-grow pb-20 pt-20">{children}</main>

      {/* Footer */}
      <footer className="bg-card border-t border-accent/10 py-16 mt-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-full bg-primary/5 blur-[100px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center justify-center text-center space-y-8">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-accent/20 p-1">
              <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Surrur-e-Mann logo" className="w-full h-full object-cover rounded-full grayscale-[20%] opacity-80" />
            </div>
            <div className="space-y-4">
              <h3 className="font-heading text-3xl font-bold tracking-widest text-foreground">SURRUR-E-MANN</h3>
              <p className="font-urdu text-2xl text-accent text-glow-gold">دل کی دنیا - روح کی صدا</p>
            </div>

            <SocialLinks />

            <div className="flex flex-wrap gap-6 pt-8 border-t border-accent/10 w-full max-w-md justify-center">
              {navLinks.map(link => (
                <Link key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-accent transition-colors uppercase tracking-wider">
                  {link.label}
                </Link>
              ))}
              <Link href="/become-a-contributor" className="text-sm text-accent hover:text-foreground transition-colors uppercase tracking-wider">
                Become a Contributor
              </Link>
              <Link href="/contributor-status" className="text-sm text-accent hover:text-foreground transition-colors uppercase tracking-wider">
                Check Application Status
              </Link>
            </div>

            <p className="text-xs text-muted-foreground/50 pt-8 tracking-widest">
              &copy; {new Date().getFullYear()} SURRUR-E-MANN. ALL RIGHTS RESERVED.
            </p>

            <FooterDeveloperCredit />
          </div>
        </div>
      </footer>
    </div>
  );
}
