import { useState, FormEvent } from "react";
import { SectionHeading } from "@/components/section-heading";
import { motion } from "framer-motion";
import { Send, CheckCircle } from "lucide-react";
import { useSeo } from "@/hooks/use-seo";

export default function Contact() {
  useSeo({
    title: "Contact | رابطہ — Suruureman",
    description: "Get in touch with Suruureman — share your thoughts, feedback, or enquiries about Urdu poetry.",
  });

  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message || "Failed to send message");
        return;
      }
      setSent(true);
      setForm({ name: "", email: "", message: "" });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const inputCls = "w-full bg-background/50 border border-accent/20 focus:border-accent focus:outline-none rounded-lg px-4 py-3 text-foreground font-sans text-sm transition-colors";
  const labelCls = "text-xs text-muted-foreground tracking-widest uppercase";

  return (
    <div className="w-full min-h-screen pb-24">
      <div className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        <SectionHeading title="Contact" titleUrdu="رابطہ" semanticLevel="h1" />

        {sent ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-16 flex flex-col items-center justify-center text-center gap-6 py-20 border border-accent/20 rounded-3xl bg-card/30"
          >
            <CheckCircle size={48} className="text-accent" />
            <h3 className="font-heading text-xl text-foreground tracking-wider">Message Sent!</h3>
            <p className="font-urdu text-2xl text-accent">آپ کا پیغام مل گیا</p>
            <p className="text-sm text-muted-foreground">We'll get back to you as soon as possible.</p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 px-6 py-2.5 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 text-xs tracking-widest uppercase transition-all"
            >
              Send Another
            </button>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleSubmit}
            className="mt-12 space-y-6 bg-card/30 border border-accent/15 rounded-3xl p-8"
          >
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div className="space-y-1">
              <label className={labelCls}>Your Name</label>
              <input className={inputCls} value={form.name} onChange={set("name")} required placeholder="e.g. Ahmad Ali" />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Email Address</label>
              <input type="email" className={inputCls} value={form.email} onChange={set("email")} required placeholder="you@example.com" />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Message</label>
              <textarea
                className={`${inputCls} min-h-[140px] resize-none`}
                value={form.message}
                onChange={set("message")}
                required
                placeholder="Write your message here..."
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-accent text-background font-heading tracking-widest uppercase text-sm hover:bg-accent/90 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(201,168,76,0.2)]"
            >
              <Send size={14} />
              {sending ? "Sending..." : "Send Message"}
            </button>
          </motion.form>
        )}
      </div>
    </div>
  );
}
