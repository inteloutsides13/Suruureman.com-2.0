import { lazy, Suspense, ReactNode, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, useSearch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageLoader } from "@/components/page-loader";
import { Layout } from "@/components/layout";
import { PersistentRadioPlayer } from "@/components/persistent-radio-player";
import { getAdminToken, getAdminRole, clearAdminSession } from "@/hooks/use-admin-auth";
import { IrabAccessGuard } from "@/components/irab-access-guard";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useSeoRouteMetadata } from "@/hooks/use-seo";

setAuthTokenGetter(getAdminToken);

// Public pages
const Home = lazy(() => import("@/pages/home"));
const LanguagePoems = lazy(() => import("@/pages/language-poems"));
const Poems = lazy(() => import("@/pages/poems"));
const PoemDetail = lazy(() => import("@/pages/poem-detail"));
const Videos = lazy(() => import("@/pages/videos"));
const Poets = lazy(() => import("@/pages/poets"));
const PoetDetail = lazy(() => import("@/pages/poet-detail"));
const Search = lazy(() => import("@/pages/search"));
const Contact = lazy(() => import("@/pages/contact"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Tools = lazy(() => import("@/pages/tools"));
const Irab = lazy(() => import("@/pages/irab"));
const Radio = lazy(() => import("@/pages/radio"));
const BecomeContributor = lazy(() => import("@/pages/become-contributor"));
const ContributorStatus = lazy(() => import("@/pages/contributor-status"));
const ContributorActivate = lazy(() => import("@/pages/contributor/activate"));

// Admin pages
const AdminLogin = lazy(() => import("@/pages/admin/login"));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminPoems = lazy(() => import("@/pages/admin/poems").then((m) => ({ default: m.default })));
const AdminPoemsNew = lazy(() => import("@/pages/admin/poems").then((m) => ({ default: m.AdminPoemsNew })));
const AdminPoemsEdit = lazy(() => import("@/pages/admin/poems").then((m) => ({ default: m.AdminPoemsEdit })));
const AdminPoets = lazy(() => import("@/pages/admin/poets").then((m) => ({ default: m.default })));
const AdminPoetsNew = lazy(() => import("@/pages/admin/poets").then((m) => ({ default: m.AdminPoetsNew })));
const AdminPoetsEdit = lazy(() => import("@/pages/admin/poets").then((m) => ({ default: m.AdminPoetsEdit })));
const AdminVideos = lazy(() => import("@/pages/admin/videos").then((m) => ({ default: m.default })));
const AdminVideosNew = lazy(() => import("@/pages/admin/videos").then((m) => ({ default: m.AdminVideosNew })));
const AdminVideosEdit = lazy(() => import("@/pages/admin/videos").then((m) => ({ default: m.AdminVideosEdit })));
const AdminVisualPoetry = lazy(() => import("@/pages/admin/visual-poetry"));
const AdminMessages = lazy(() => import("@/pages/admin/messages"));
const AdminSettings = lazy(() => import("@/pages/admin/settings"));
const AdminBackups = lazy(() => import("@/pages/admin/backups"));
const AdminCategories = lazy(() => import("@/pages/admin/categories"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminTools = lazy(() => import("@/pages/admin/tools"));
const AdminContributors = lazy(() => import("@/pages/admin/contributors"));
const AdminPending = lazy(() => import("@/pages/admin/pending"));
const AdminRadio = lazy(() => import("@/pages/admin/radio"));
const AdminRadioCalendar = lazy(() => import("@/pages/admin/radio-calendar"));
const AdminContributorApplications = lazy(() => import("@/pages/admin/contributor-applications"));

// Contributor portal pages
const ContributorDashboard = lazy(() => import("@/pages/contributor/dashboard"));
const ContributorSubmissions = lazy(() => import("@/pages/contributor/submissions"));
const ContributorPoemsNew = lazy(() => import("@/pages/contributor/poems-new"));
const ContributorPoemsEdit = lazy(() => import("@/pages/contributor/poems-edit"));
const ContributorPoetsNew = lazy(() => import("@/pages/contributor/poets-new"));
const ContributorRadio = lazy(() => import("@/pages/contributor/radio"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: true, staleTime: 30 * 1000, retry: 1 },
  },
});

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [location]);
  return null;
}

/** Guard for admin/developer routes — redirects contributors to their portal */
function AdminGuard({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getAdminToken();
    const role = getAdminRole();
    if (!token) { navigate("/admin/login"); setVerified(false); return; }
    // Contributors who land here get sent to their portal
    if (role === "contributor") { navigate("/contributor/dashboard"); setVerified(false); return; }
    fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          clearAdminSession(); navigate("/admin/login"); setVerified(false);
        } else {
          setVerified(true);
        }
      })
      .catch(() => { setVerified(true); });
  }, []);

  if (verified === null) return <PageLoader />;
  if (!verified) return null;
  return <>{children}</>;
}

/** Guard for developer-only routes */
function DeveloperGuard({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [checked, setChecked] = useState<boolean | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    const token = getAdminToken();
    const role = getAdminRole();
    if (!token) { navigate("/admin/login"); setChecked(false); return; }
    if (role !== "developer") {
      setUnauthorized(true); setChecked(false);
      setTimeout(() => navigate("/admin/dashboard"), 2500);
      return;
    }
    setChecked(true);
  }, []);

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 p-8 bg-card/40 border border-destructive/20 rounded-2xl max-w-sm">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-destructive">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="font-heading text-xl tracking-wider text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground">This page requires Developer access. Redirecting…</p>
        </div>
      </div>
    );
  }

  if (checked === null || (checked === false && !unauthorized)) return <PageLoader />;
  return <>{children}</>;
}

/** Guard for contributor-only portal routes */
function ContributorGuard({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getAdminToken();
    const role = getAdminRole();
    if (!token) { navigate("/admin/login"); setVerified(false); return; }
    // Admin/developer users who hit the contributor portal → redirect to admin
    if (role === "admin" || role === "developer") { navigate("/admin/dashboard"); setVerified(false); return; }
    // Verify contributor token is still valid
    fetch("/api/contributor/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          clearAdminSession(); navigate("/admin/login"); setVerified(false);
        } else {
          setVerified(true);
        }
      })
      .catch(() => { setVerified(true); });
  }, []);

  if (verified === null) return <PageLoader />;
  if (!verified) return null;
  return <>{children}</>;
}

function PublicRouter() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/poetry/:language" component={LanguagePoems} />
          <Route path="/poems" component={Poems} />
          <Route path="/poems/:id" component={PoemDetail} />
          <Route path="/videos" component={Videos} />
          <Route path="/poets" component={Poets} />
          <Route path="/poets/:id" component={PoetDetail} />
          <Route path="/search" component={Search} />
          <Route path="/contact" component={Contact} />
          <Route path="/tools" component={Tools} />
          <Route path="/irab"><IrabAccessGuard><Irab /></IrabAccessGuard></Route>
          <Route path="/radio" component={Radio} />
          <Route path="/become-a-contributor" component={BecomeContributor} />
          <Route path="/contributor-status" component={ContributorStatus} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function AdminRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/dashboard"><AdminGuard><AdminDashboard /></AdminGuard></Route>
        <Route path="/admin/poems/new"><AdminGuard><AdminPoemsNew /></AdminGuard></Route>
        <Route path="/admin/poems/:id/edit"><AdminGuard><AdminPoemsEdit /></AdminGuard></Route>
        <Route path="/admin/poems"><AdminGuard><AdminPoems /></AdminGuard></Route>
        <Route path="/admin/poets/new"><AdminGuard><AdminPoetsNew /></AdminGuard></Route>
        <Route path="/admin/poets/:id/edit"><AdminGuard><AdminPoetsEdit /></AdminGuard></Route>
        <Route path="/admin/poets"><AdminGuard><AdminPoets /></AdminGuard></Route>
        <Route path="/admin/videos/new"><AdminGuard><AdminVideosNew /></AdminGuard></Route>
        <Route path="/admin/videos/:id/edit"><AdminGuard><AdminVideosEdit /></AdminGuard></Route>
        <Route path="/admin/videos"><AdminGuard><AdminVideos /></AdminGuard></Route>
        <Route path="/admin/visual-poetry"><AdminGuard><AdminVisualPoetry /></AdminGuard></Route>
        <Route path="/admin/messages"><AdminGuard><AdminMessages /></AdminGuard></Route>
        <Route path="/admin/settings"><AdminGuard><AdminSettings /></AdminGuard></Route>
        <Route path="/admin/backups"><DeveloperGuard><AdminBackups /></DeveloperGuard></Route>
        <Route path="/admin/categories"><AdminGuard><AdminCategories /></AdminGuard></Route>
        <Route path="/admin/users"><DeveloperGuard><AdminUsers /></DeveloperGuard></Route>
        <Route path="/admin/tools"><AdminGuard><AdminTools /></AdminGuard></Route>
        <Route path="/admin/contributors"><AdminGuard><AdminContributors /></AdminGuard></Route>
        <Route path="/admin/pending"><AdminGuard><AdminPending /></AdminGuard></Route>
        <Route path="/admin/radio"><AdminGuard><AdminRadio /></AdminGuard></Route>
        <Route path="/admin/radio-calendar"><AdminGuard><AdminRadioCalendar /></AdminGuard></Route>
        <Route path="/admin/contributor-applications"><AdminGuard><AdminContributorApplications /></AdminGuard></Route>
        <Route path="/admin"><AdminGuard><AdminDashboard /></AdminGuard></Route>
      </Switch>
    </Suspense>
  );
}

function ContributorRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/contributor/activate/:token" component={ContributorActivate} />
        <Route path="/contributor/dashboard"><ContributorGuard><ContributorDashboard /></ContributorGuard></Route>
        <Route path="/contributor/submissions"><ContributorGuard><ContributorSubmissions /></ContributorGuard></Route>
        <Route path="/contributor/poems/new"><ContributorGuard><ContributorPoemsNew /></ContributorGuard></Route>
        <Route path="/contributor/poems/:id/edit"><ContributorGuard><ContributorPoemsEdit /></ContributorGuard></Route>
        <Route path="/contributor/poets/new"><ContributorGuard><ContributorPoetsNew /></ContributorGuard></Route>
        <Route path="/contributor/radio"><ContributorGuard><ContributorRadio /></ContributorGuard></Route>
        <Route path="/contributor"><ContributorGuard><ContributorDashboard /></ContributorGuard></Route>
      </Switch>
    </Suspense>
  );
}

function AppRouter() {
  const [location] = useLocation();
  const search = useSearch();
  useSeoRouteMetadata(location, search);
  if (location.startsWith("/admin")) return <AdminRouter />;
  if (location === "/contributor" || location.startsWith("/contributor/")) return <ContributorRouter />;
  return <PublicRouter />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ScrollToTop />
            <AppRouter />
            <PersistentRadioPlayer />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
