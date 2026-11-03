import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle, ClipboardCheck, Globe2, Loader2, LogIn, Megaphone, SearchCheck, Send, Sparkles, UserCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { SectionHeading } from "@/components/section-heading";
import { contributorTermsEnglish, contributorTermsUrdu } from "@/content/contributor-terms";
import { useSeo } from "@/hooks/use-seo";

const inputClass = "w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-3 text-foreground text-sm transition-colors";
const labelClass = "text-xs text-muted-foreground tracking-widest uppercase";

const languages = [
  { value: "urdu", label: "اردو" },
  { value: "english", label: "English" },
  { value: "siraiki", label: "سرائیکی" },
  { value: "punjabi", label: "پنجابی" },
  { value: "pashto", label: "پشتو" },
];

const contributorSteps = [
  {
    number: "1",
    title: "Submit Contributor Request",
    description: "Visit our website and submit your request to become a contributor.",
    icon: ClipboardCheck,
  },
  {
    number: "2",
    title: "Check Your Request Status",
    description: "After submitting your request, please allow our administration team time to review it.",
    icon: SearchCheck,
  },
  {
    number: "3",
    title: "Once Approved — Return to Status",
    description: "After your request has been approved, visit the website again and open the Status section.",
    icon: LogIn,
  },
  {
    number: "4",
    title: "Activate Your Account",
    description: "Your Account Activation option will become available in the Status section after approval. Click it and complete the activation process.",
    icon: UserCheck,
  },
  {
    number: "5",
    title: "Start Contributing",
    description: "Once your account has been successfully activated, you can access your contributor account and begin submitting your content.",
    icon: Sparkles,
  },
];

function ContributorProcessNotice() {
  return (
    <section dir="ltr" className="mt-10 overflow-hidden rounded-3xl border border-accent/30 bg-card/60 text-left shadow-[0_12px_40px_hsl(340_25%_2%_/_0.45)]">
      <div className="border-b border-accent/15 bg-accent/5 px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent">
            <Megaphone size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-heading text-lg tracking-[0.12em] text-accent sm:text-xl">📢 IMPORTANT NOTICE FOR ALL CONTRIBUTORS</h2>
            <p className="mt-3 text-sm font-medium text-foreground">Dear Contributors,</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              To become an official contributor on Suruur E Man, please follow these steps carefully:
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-5">
        {contributorSteps.map((step) => (
          <article key={step.number} className="relative rounded-2xl border border-accent/15 bg-background/35 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {step.number}
              </span>
              <step.icon size={17} className="text-accent/80" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-medium leading-5 text-foreground">{step.title}</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{step.description}</p>
          </article>
        ))}
      </div>

      <div className="mx-5 mb-5 rounded-2xl border border-accent/45 bg-accent/10 p-4 sm:mx-7 sm:mb-7 sm:p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-accent" size={19} aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">⚠️ PLEASE NOTE:</p>
            <p className="mt-2 text-sm font-medium leading-6 text-foreground">
              Approval does not automatically activate your account. After approval, you must return to the Status section on our website and activate your account manually.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent/90">Approved ≠ Activated</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-accent/15 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe2 size={16} className="text-accent" aria-hidden="true" />
          <span>🌐 Website: Suruureman.com</span>
        </div>
        <Link href="/contributor-status" className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-xs font-heading tracking-[0.12em] text-background transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card">
          CHECK APPLICATION STATUS
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <p className="border-t border-accent/10 px-5 py-4 text-center text-xs italic text-muted-foreground sm:px-7">
        Thank you for becoming part of the Suruur E Man Contributor Community.
        <span className="mt-1 block not-italic font-medium text-accent/80">Suruur E Man Team</span>
      </p>
    </section>
  );
}

export default function BecomeContributor() {
  useSeo({
    title: "Become a Poetry Contributor",
    description: "Submit your poetry to Surrur-e-Mann and follow the steps to become a contributor.",
  });
  const [categories, setCategories] = useState<Array<{ id: number; name: string; nameUrdu: string }>>([]);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: "", email: "", dateOfBirth: "", contactInformation: "", bio: "", contributionArea: "",
    preferredLanguage: "urdu", category: "", portfolio: "", termsAccepted: false,
  });

  useEffect(() => {
    fetch("/api/categories")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setCategories(Array.isArray(data?.categories) ? data.categories : Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function update(name: string) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [name]: event.target.value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSending(true);
    try {
      const response = await fetch("/api/contributor-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "The application could not be submitted.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full min-h-screen pb-24">
      <div className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <SectionHeading title="Become a Contributor" titleUrdu="شریکِ کار بنیں" semanticLevel="h1" />
        <ContributorProcessNotice />
        {submitted ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-10 max-w-3xl space-y-5 rounded-3xl border border-accent/20 bg-card/30 px-6 py-20 text-center">
            <CheckCircle size={48} className="text-accent mx-auto" />
            <h2 className="font-heading text-xl tracking-wider">Application Submitted</h2>
            <p className="font-urdu text-2xl text-accent" dir="rtl">آپ کی درخواست کامیابی سے جمع ہو گئی ہے۔</p>
            <p className="mx-auto max-w-xl text-sm font-medium leading-6 text-foreground">
              Your application has been submitted successfully.
            </p>
            <p className="mx-auto max-w-xl text-sm text-muted-foreground">
              After approval, return to the Status section to activate your Contributor account. Approval does not automatically activate your account, and no email has been sent by this form.
            </p>
            <p className="font-urdu text-lg text-muted-foreground max-w-xl mx-auto" dir="rtl">
              انتظامیہ کی منظوری کے بعد آپ کو اکاؤنٹ فعال کرنے کا طریقہ فراہم کیا جائے گا۔
            </p>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              You can check your application later using your first name, date of birth, and email address.
            </p>
            <Link href="/contributor-status" className="inline-flex items-center justify-center rounded-lg border border-accent/30 px-4 py-3 text-sm text-accent hover:bg-accent/10 transition-colors">
              Check Application Status
            </Link>
          </motion.div>
        ) : (
          <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="mx-auto mt-10 max-w-3xl space-y-6 rounded-3xl border border-accent/15 bg-card/30 p-6 sm:p-8">
            <p className="text-sm text-muted-foreground">Share the information needed for a careful Contributor review. Required fields are marked by the browser.</p>
            {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>}
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClass}>Full Name</label>
                <input className={inputClass} value={form.fullName} onChange={update("fullName")} required maxLength={160} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Email Address</label>
                <input type="email" className={inputClass} value={form.email} onChange={update("email")} required maxLength={254} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClass}>Date of Birth</label>
                <input type="date" className={inputClass} value={form.dateOfBirth} onChange={update("dateOfBirth")} required />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Contact Number <span className="normal-case tracking-normal">(optional)</span></label>
                <input className={inputClass} value={form.contactInformation} onChange={update("contactInformation")} placeholder="Only if needed for your application" />
              </div>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Short Bio</label>
              <textarea className={`${inputClass} min-h-[120px] resize-y`} value={form.bio} onChange={update("bio")} required maxLength={5000} placeholder="Tell us briefly about yourself and your work." />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClass}>Contribution Area</label>
                <input className={inputClass} value={form.contributionArea} onChange={update("contributionArea")} required maxLength={160} placeholder="Poetry, translation, audio, research..." />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Preferred Language</label>
                <select className={inputClass} value={form.preferredLanguage} onChange={update("preferredLanguage")} required>
                  {languages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClass}>Relevant Category / Area</label>
                {categories.length ? (
                  <select className={inputClass} value={form.category} onChange={update("category")} required>
                    <option value="">Select a category</option>
                    {categories.map((category) => <option key={category.id} value={category.name}>{category.name}{category.nameUrdu ? ` — ${category.nameUrdu}` : ""}</option>)}
                  </select>
                ) : (
                  <input className={inputClass} value={form.category} onChange={update("category")} required maxLength={160} placeholder="Your relevant category or area" />
                )}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Sample Work / Portfolio <span className="normal-case tracking-normal">(optional)</span></label>
                <input className={inputClass} value={form.portfolio} onChange={update("portfolio")} maxLength={2000} placeholder="Link or short description" />
              </div>
            </div>

            <div className="border border-accent/15 rounded-2xl p-5 space-y-5">
              <h3 className="font-heading tracking-wider text-accent">Contributor Terms &amp; Conditions</h3>
              <div className="max-h-[34rem] overflow-y-auto rounded-xl border border-accent/10 bg-background/30 p-4 text-sm leading-8 text-muted-foreground" dir="rtl">
                <p className="font-urdu whitespace-pre-wrap text-foreground">{contributorTermsUrdu}</p>
              </div>
              <div className="max-h-[34rem] overflow-y-auto rounded-xl border border-accent/10 bg-background/30 p-4 text-sm leading-7 text-muted-foreground">
                <p className="whitespace-pre-wrap text-foreground">{contributorTermsEnglish}</p>
              </div>
              <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
                <input type="checkbox" className="mt-1 accent-accent" checked={form.termsAccepted} onChange={(event) => setForm((current) => ({ ...current, termsAccepted: event.target.checked }))} required />
                <span>I have read and understood the Contributor Terms &amp; Conditions and agree to comply with them.<br /><span className="font-urdu text-base text-muted-foreground" dir="rtl">میں نے Contributor Terms &amp; Conditions پڑھ لی ہیں، انہیں سمجھتا/سمجھتی ہوں اور ان کی پابندی کرنے سے اتفاق کرتا/کرتی ہوں۔</span></span>
              </label>
            </div>
            <button type="submit" disabled={sending} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-accent text-background font-heading tracking-widest uppercase text-sm hover:bg-accent/90 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(201,168,76,0.2)]">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? "Submitting..." : "Submit Application"}
            </button>
          </motion.form>
        )}
      </div>
    </div>
  );
}