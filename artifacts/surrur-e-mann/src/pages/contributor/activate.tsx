import { FormEvent, useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { CheckCircle, Loader2, ShieldAlert } from "lucide-react";

export default function ContributorActivate() {
  const [, params] = useRoute("/contributor/activate/:token");
  const token = params?.token || "";
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "activated">("loading");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/api/contributor-activation/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.valid) { setState("invalid"); return; }
        setFullName(data.fullName || "");
        setState("ready");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/contributor-activation/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.message || "The account could not be activated."); return; }
      setState("activated");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-heading font-bold text-2xl tracking-widest text-accent">SURUUREMAN</Link>
          <p className="text-xs text-muted-foreground/50 tracking-widest uppercase mt-2">Contributor Activation</p>
        </div>
        <div className="bg-card/60 border border-accent/20 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-black/50">
          {state === "loading" && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-accent" /></div>}
          {state === "invalid" && <div className="text-center space-y-4"><ShieldAlert size={42} className="mx-auto text-destructive" /><h1 className="font-heading text-xl tracking-wider">Activation Link Unavailable</h1><p className="text-sm text-muted-foreground">This activation link is invalid, expired, or already used.</p><Link href="/admin/login" className="inline-block text-accent text-sm hover:underline">Go to sign in</Link></div>}
          {state === "ready" && (
            <form onSubmit={submit} className="space-y-5">
              <div className="text-center space-y-2"><h1 className="font-heading text-xl tracking-wider">Create Your Password</h1><p className="text-sm text-muted-foreground">{fullName ? `Welcome, ${fullName}.` : "Complete your Contributor activation."}</p></div>
              {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>}
              <div className="space-y-1"><label className="text-xs text-muted-foreground tracking-widest uppercase">Password</label><input type="password" autoComplete="new-password" className="w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-3 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></div>
              <div className="space-y-1"><label className="text-xs text-muted-foreground tracking-widest uppercase">Confirm Password</label><input type="password" autoComplete="new-password" className="w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-3 text-sm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} /></div>
              <button type="submit" disabled={saving} className="w-full py-3 rounded-lg bg-accent text-background font-heading tracking-widest uppercase text-sm disabled:opacity-50">{saving ? "Activating..." : "Activate Account"}</button>
            </form>
          )}
          {state === "activated" && <div className="text-center space-y-4"><CheckCircle size={46} className="mx-auto text-emerald-400" /><h1 className="font-heading text-xl tracking-wider">Account Activated Successfully</h1><p className="text-sm text-muted-foreground">Your Contributor account is ready. Sign in to access the existing Contributor Dashboard.</p><Link href="/admin/login" className="inline-block px-5 py-3 rounded-lg bg-accent text-background font-heading tracking-widest uppercase text-sm">Login to Contributor Dashboard</Link></div>}
        </div>
      </div>
    </div>
  );
}