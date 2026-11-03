import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { login, isAuthenticated, isContributor: alreadyContributor, role } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect already-authenticated users to the right home
  if (isAuthenticated) {
    if (role === "contributor") {
      navigate("/contributor/dashboard");
    } else {
      navigate("/admin/dashboard");
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Login failed");
        return;
      }
      login(data.token, data.email, data.role, data.name, data.userId);

      // Route by role
      if (data.role === "contributor") {
        navigate("/contributor/dashboard");
      } else {
        navigate("/admin/dashboard");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-heading font-bold text-2xl tracking-widest text-accent">SURUUREMAN</h1>
          <p className="text-xs text-muted-foreground/50 tracking-widest uppercase mt-1">Sign In</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card/60 border border-accent/20 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-black/50 space-y-5"
        >
          <h2 className="font-heading text-lg text-foreground tracking-wider text-center mb-2">Sign In</h2>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3 text-center">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground tracking-widest uppercase font-sans">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-3 text-foreground font-sans text-sm transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground tracking-widest uppercase font-sans">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-3 text-foreground font-sans text-sm transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-accent text-background font-heading tracking-widest uppercase text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(201,168,76,0.2)]"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
