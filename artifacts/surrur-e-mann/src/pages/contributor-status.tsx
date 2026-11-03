import { FormEvent, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle, Loader2, Search } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { SectionHeading } from "@/components/section-heading";

type StatusResult = {
  status: "pending" | "approved" | "rejected" | "not_found";
  accountStatus?: string | null;
  activationLink?: string | null;
  loginPath?: string;
  message: string;
};

const inputClass = "w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-3 text-foreground text-sm transition-colors";
const labelClass = "text-xs text-muted-foreground tracking-widest uppercase";

function StatusCard({ result }: { result: StatusResult }) {
  if (result.status === "not_found") {
    return (
      <div className="border border-destructive/20 bg-destructive/5 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-3 text-destructive"><AlertCircle size={20} /><h2 className="font-heading text-lg tracking-wider">Application Not Found</h2></div>
        <p className="text-sm text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  if (result.status === "pending") {
    return (
      <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-6 space-y-3">
        <p className="text-xs text-amber-300 uppercase tracking-widest">Application Status</p>
        <h2 className="font-heading text-xl tracking-wider text-amber-200">Pending</h2>
        <p className="text-sm text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  if (result.status === "rejected") {
    return (
      <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6 space-y-3">
        <p className="text-xs text-red-300 uppercase tracking-widest">Application Status</p>
        <h2 className="font-heading text-xl tracking-wider text-red-200">Application Not Approved</h2>
        <p className="text-sm text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  if (result.accountStatus === "active") {
    return (
      <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 text-emerald-300"><CheckCircle size={20} /><h2 className="font-heading text-xl tracking-wider">Application Approved</h2></div>
        <p className="text-sm text-muted-foreground">{result.message}</p>
        <Link href={result.loginPath || "/admin/login"} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-heading tracking-wider text-background hover:bg-accent/90 transition-colors">
          Go to Contributor Login <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3 text-emerald-300"><CheckCircle size={20} /><h2 className="font-heading text-xl tracking-wider">Application Approved</h2></div>
      <p className="text-sm text-muted-foreground">{result.message}</p>
      {result.activationLink ? (
        <a href={result.activationLink} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-heading tracking-wider text-background hover:bg-accent/90 transition-colors">
          Activate Your Contributor Account <ArrowRight size={15} />
        </a>
      ) : (
        <p className="text-sm text-amber-200">Please contact an Administrator or Developer for a fresh activation link.</p>
      )}
    </div>
  );
}

export default function ContributorStatus() {
  const [form, setForm] = useState({ firstName: "", dateOfBirth: "", email: "" });
  const [result, setResult] = useState<StatusResult | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  function update(name: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [name]: event.target.value }));
  }

  async function checkStatus(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    setChecking(true);
    try {
      const response = await fetch("/api/contributor-application-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (response.status === 404 && data.status === "not_found") {
        setResult(data);
      } else if (!response.ok) {
        setError(data.message || "The application status could not be checked.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="w-full min-h-screen pb-24">
      <div className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        <SectionHeading title="Check Application Status" titleUrdu="درخواست کی صورتحال دیکھیں" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-12 space-y-6">
          <div className="bg-card/30 border border-accent/15 rounded-3xl p-6 sm:p-8 space-y-6">
            <p className="text-sm text-muted-foreground">Enter the same first name, date of birth, and email address used in your Contributor application.</p>
            {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3" role="alert">{error}</div>}
            <form onSubmit={checkStatus} className="space-y-5">
              <div className="space-y-1">
                <label className={labelClass} htmlFor="status-first-name">First Name</label>
                <input id="status-first-name" className={inputClass} value={form.firstName} onChange={update("firstName")} required maxLength={80} autoComplete="given-name" />
              </div>
              <div className="space-y-1">
                <label className={labelClass} htmlFor="status-date-of-birth">Date of Birth</label>
                <input id="status-date-of-birth" type="date" className={inputClass} value={form.dateOfBirth} onChange={update("dateOfBirth")} required />
              </div>
              <div className="space-y-1">
                <label className={labelClass} htmlFor="status-email">Email Address</label>
                <input id="status-email" type="email" className={inputClass} value={form.email} onChange={update("email")} required maxLength={254} autoComplete="email" />
              </div>
              <button type="submit" disabled={checking} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-accent text-background font-heading tracking-widest uppercase text-sm hover:bg-accent/90 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(201,168,76,0.2)]">
                {checking ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                {checking ? "Checking..." : "Check Status"}
              </button>
            </form>
          </div>
          {result && <StatusCard result={result} />}
          <p className="text-center text-sm text-muted-foreground">
            Need to apply first?{" "}
            <Link href="/become-a-contributor" className="text-accent hover:text-foreground transition-colors">Become a Contributor</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}