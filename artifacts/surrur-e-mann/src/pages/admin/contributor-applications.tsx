import { useCallback, useEffect, useState } from "react";
import { Check, Clipboard, Eye, Loader2, RefreshCw, Search, X } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";

type Status = "pending" | "approved" | "rejected";
interface Application {
  id: number; fullName: string; email: string; dateOfBirth: string | null; contributionArea: string; preferredLanguage: string; category: string;
  status: Status; rejectionReason: string | null; reviewedAt: string | null; userId: number | null;
  activationUsedAt: string | null; activationExpiresAt: string | null; approvalEmailStatus: "sent" | "failed" | "not_sent"; approvalEmailMessage?: string | null; createdAt: string; updatedAt: string;
}
interface Detail extends Application { contactInformation: string | null; bio: string; portfolio: string | null; termsVersion: string; termsAcceptedAt: string; }

function date(value: string | null) { return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"; }
function badge(status: Status) { return status === "pending" ? "text-amber-300 bg-amber-500/10 border-amber-500/20" : status === "approved" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" : "text-red-300 bg-red-500/10 border-red-500/20"; }
function emailBadge(status: Application["approvalEmailStatus"]) { return status === "sent" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" : status === "failed" ? "text-red-300 bg-red-500/10 border-red-500/20" : "text-muted-foreground bg-muted/10 border-accent/10"; }

export default function ContributorApplications() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [status, setStatus] = useState<"" | Status>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [activationLink, setActivationLink] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: "200" });
      if (status) query.set("status", status);
      if (search) query.set("search", search);
      const response = await adminFetch(`/api/admin/contributor-applications?${query}`);
      if (response.ok) setApplications((await response.json()).applications || []);
    } finally { setLoading(false); }
  }, [search, status]);
  useEffect(() => { load(); }, [load]);

  async function view(id: number) {
    const response = await adminFetch(`/api/admin/contributor-applications/${id}`);
    if (response.ok) {
      const data = await response.json();
      setSelected(data.application);
    }
  }
  async function run(path: string, options: RequestInit, success: string) {
    setAction(path);
    try {
      const response = await adminFetch(path, options);
      const data = await response.json();
       if (!response.ok) { toast({ title: data.message || "Action failed", variant: "destructive" }); return; }
      if (data.activationLink) setActivationLink(data.activationLink);
       toast({
         title: success,
         description: data.approvalEmailStatus === "failed"
           ? "Approval succeeded, but the email was not sent. Status activation remains available."
           : data.approvalEmailStatus === "sent"
             ? "The approval email was sent. Status activation remains available as a fallback."
             : undefined,
         variant: data.approvalEmailStatus === "failed" ? "destructive" : undefined,
       });
      await load();
      if (selected) await view(selected.id);
    } finally { setAction(""); }
  }
  async function copyLink() {
    if (!activationLink) return;
    await navigator.clipboard.writeText(activationLink);
    toast({ title: "Activation link copied" });
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl space-y-8">
        <div className="flex flex-wrap justify-between gap-4 items-end">
          <div><p className="text-xs text-accent tracking-widest uppercase">Onboarding</p><h1 className="font-heading text-3xl tracking-wider mt-2">Contributor Applications</h1><p className="text-sm text-muted-foreground mt-2">Review applications and send an optional approval email using the existing secure activation link.</p></div>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-accent/20 rounded-lg text-sm hover:bg-accent/10"><RefreshCw size={14} /> Refresh</button>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]"><Search size={15} className="absolute left-3 top-3 text-muted-foreground" /><input className="w-full bg-card/40 border border-accent/15 rounded-lg px-9 py-2.5 text-sm" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <select className="bg-card/40 border border-accent/15 rounded-lg px-3 py-2.5 text-sm" value={status} onChange={(event) => setStatus(event.target.value as "" | Status)}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
        </div>
        <div className="border border-accent/15 rounded-2xl overflow-hidden">
          {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-accent" /></div> : applications.length === 0 ? <div className="p-12 text-center text-muted-foreground">No applications found.</div> : <div className="divide-y divide-accent/10">{applications.map((application) => <div key={application.id} className="p-5 flex flex-wrap gap-4 items-center justify-between hover:bg-accent/[0.03]"><div><h2 className="font-heading tracking-wider">{application.fullName}</h2><p className="text-sm text-muted-foreground">{application.email} · {application.contributionArea}</p><p className="text-xs text-muted-foreground/70 mt-1">Submitted {date(application.createdAt)}</p></div><div className="flex items-center gap-3"><span className={`text-xs border rounded-full px-3 py-1 uppercase tracking-wider ${badge(application.status)}`}>{application.status}</span>{application.status === "approved" && <span className={`text-xs border rounded-full px-3 py-1 uppercase tracking-wider ${emailBadge(application.approvalEmailStatus)}`}>Email {application.approvalEmailStatus === "not_sent" ? "not sent" : application.approvalEmailStatus}</span>}<button onClick={() => view(application.id)} className="flex items-center gap-2 px-3 py-2 border border-accent/20 rounded-lg text-sm hover:bg-accent/10"><Eye size={14} /> View</button></div></div>)}</div>}
        </div>
      </div>

         {selected && <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm overflow-y-auto p-4"><div className="max-w-2xl mx-auto my-8 bg-card border border-accent/20 rounded-2xl p-6 sm:p-8 space-y-6"><div className="flex justify-between gap-4"><div><p className="text-xs text-accent tracking-widest uppercase">Application #{selected.id}</p><h2 className="font-heading text-2xl tracking-wider mt-1">{selected.fullName}</h2></div><button onClick={() => { setSelected(null); setActivationLink(""); }} className="text-muted-foreground hover:text-foreground"><X /></button></div><div className="grid sm:grid-cols-2 gap-4 text-sm"><div><span className="text-muted-foreground block">Email</span>{selected.email}</div><div><span className="text-muted-foreground block">Date of birth</span>{selected.dateOfBirth || "Not provided"}</div><div><span className="text-muted-foreground block">Contact</span>{selected.contactInformation || "—"}</div><div><span className="text-muted-foreground block">Contribution area</span>{selected.contributionArea}</div><div><span className="text-muted-foreground block">Language / category</span>{selected.preferredLanguage} / {selected.category}</div><div><span className="text-muted-foreground block">Submitted</span>{date(selected.createdAt)}</div><div><span className="text-muted-foreground block">Terms accepted</span>{selected.termsVersion} · {date(selected.termsAcceptedAt)}</div></div><div className="space-y-2"><p className="text-xs text-muted-foreground uppercase tracking-widest">Bio</p><p className="text-sm whitespace-pre-wrap">{selected.bio}</p></div>{selected.portfolio && <div className="space-y-2"><p className="text-xs text-muted-foreground uppercase tracking-widest">Sample / portfolio</p><p className="text-sm whitespace-pre-wrap break-words">{selected.portfolio}</p></div>}<div className="border-t border-accent/10 pt-5 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Application status</span><span className={`border rounded-full px-3 py-1 text-xs ${badge(selected.status)}`}>{selected.status}</span></div>{selected.status === "approved" && <div className="mt-3 flex justify-between"><span className="text-muted-foreground">Account activation</span><span className={selected.activationUsedAt ? "text-emerald-300" : "text-amber-300"}>{selected.activationUsedAt ? `Active since ${date(selected.activationUsedAt)}` : "Activation pending"}</span></div>} {selected.status === "approved" && <div className="mt-3 flex justify-between gap-4"><span className="text-muted-foreground">Approval email</span><span className={emailBadge(selected.approvalEmailStatus)}>{selected.approvalEmailStatus === "not_sent" ? "Not sent" : selected.approvalEmailStatus === "sent" ? "Sent" : "Failed"}</span></div>}{selected.approvalEmailStatus === "failed" && <p className="mt-2 text-xs text-amber-200">The approval succeeded, but email delivery failed. Status-page activation remains available.{selected.approvalEmailMessage ? ` ${selected.approvalEmailMessage}` : ""}</p>}{selected.rejectionReason && <div className="mt-3"><span className="text-muted-foreground block">Rejection reason</span>{selected.rejectionReason}</div>}</div>
        {selected.status === "pending" && <div className="space-y-3 border-t border-accent/10 pt-5"><div className="flex flex-wrap gap-3"><button disabled={!!action} onClick={() => run(`/api/admin/contributor-applications/${selected.id}/approve`, { method: "POST" }, "Application approved and account created")} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/80 text-background text-sm disabled:opacity-50"><Check size={14} /> Approve</button><input className="flex-1 min-w-[220px] bg-background/50 border border-accent/15 rounded-lg px-3 py-2 text-sm" placeholder="Optional rejection reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} /><button disabled={!!action} onClick={() => run(`/api/admin/contributor-applications/${selected.id}/reject`, { method: "POST", body: JSON.stringify({ reason: rejectionReason }) }, "Application rejected")} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-300 text-sm disabled:opacity-50"><X size={14} /> Reject</button></div></div>}
        {selected.status === "approved" && !selected.activationUsedAt && <div className="border-t border-accent/10 pt-5 space-y-3"><p className="text-sm text-muted-foreground">Generate a fresh link if the previous one was lost. The previous unused link will stop working.</p><button disabled={!!action} onClick={() => run(`/api/admin/contributor-applications/${selected.id}/reissue-activation`, { method: "POST" }, "New activation link generated")} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-accent/30 text-accent text-sm disabled:opacity-50"><RefreshCw size={14} /> Generate New Activation Link</button></div>}
        {activationLink && <div className="border border-accent/20 rounded-xl p-4 space-y-3"><p className="text-xs text-accent uppercase tracking-widest">Secure activation link — show only to the applicant</p><div className="flex gap-2"><input readOnly className="min-w-0 flex-1 bg-background/50 border border-accent/15 rounded-lg px-3 py-2 text-xs" value={activationLink} /><button onClick={copyLink} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-background text-sm"><Clipboard size={14} /> Copy</button></div><p className="text-xs text-muted-foreground">This link expires in 72 hours and can be used once.</p></div>}</div></div>}
    </AdminLayout>
  );
}