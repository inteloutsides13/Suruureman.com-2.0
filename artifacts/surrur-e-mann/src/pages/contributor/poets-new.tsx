import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { ContributorLayout } from "@/components/contributor-layout";
import { contributorFetch } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { Feather, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground tracking-widest uppercase">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function ContributorPoetsNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", nameUrdu: "", bio: "", bioUrdu: "", era: "" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("Name");
    if (!form.nameUrdu.trim()) missing.push("Urdu Name");
    if (!form.bio.trim()) missing.push("Biography");
    if (!form.bioUrdu.trim()) missing.push("Urdu Biography");
    if (!form.era.trim()) missing.push("Era / Period");
    if (missing.length > 0) {
      toast({ title: `Please fill in: ${missing.join(", ")}`, variant: "destructive" }); return;
    }

    setSubmitting(true);
    try {
      const res = await contributorFetch("/api/contributor/poets", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          nameUrdu: form.nameUrdu.trim(),
          bio: form.bio.trim(),
          bioUrdu: form.bioUrdu.trim(),
          era: form.era.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast({ title: d.message || "Failed to create poet", variant: "destructive" }); return;
      }
      toast({ title: `Poet "${form.name}" created`, description: "You can now submit poems by this poet." });
      navigate("/contributor/poems/new");
    } finally {
      setSubmitting(false);
    }
  }

  function f(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  return (
    <ContributorLayout>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="font-heading text-3xl tracking-wider text-foreground">Add New Poet</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create a poet profile so you can attribute poems to them. The profile will be immediately available.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Poet Name (English)" required>
              <Input placeholder="e.g. Allama Iqbal" value={form.name} onChange={f("name")} />
            </Field>
            <Field label="شاعر کا نام (اردو)" required>
              <Input dir="rtl" placeholder="مثلاً: علامہ اقبال" value={form.nameUrdu} onChange={f("nameUrdu")} className="font-urdu text-right" />
            </Field>
          </div>

          <Field label="Era / Time Period" required>
            <Input placeholder="e.g. 1877–1938 · Modernist" value={form.era} onChange={f("era")} />
          </Field>

          <Field label="Biography (English)" required>
            <Textarea
              placeholder="A brief biography of the poet in English..."
              value={form.bio}
              onChange={f("bio")}
              rows={5}
              className="resize-y"
            />
          </Field>

          <Field label="سوانح عمری (اردو)" required>
            <Textarea
              dir="rtl"
              placeholder="شاعر کی مختصر سوانح عمری اردو میں..."
              value={form.bioUrdu}
              onChange={f("bioUrdu")}
              rows={5}
              className="font-urdu text-right resize-y"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/contributor/poems/new")}>
              Back to Poem Form
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Feather size={14} />}
              {submitting ? "Creating..." : "Create Poet Profile"}
            </Button>
          </div>
        </form>
      </div>
    </ContributorLayout>
  );
}
