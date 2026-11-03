import { useState, useEffect, FormEvent } from "react";
import { useLocation, useParams } from "wouter";
import { ContributorLayout } from "@/components/contributor-layout";
import { contributorFetch } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getMissingPoemFields, getPoemValidationMessage } from "@/lib/poem-validation";
import { POEM_LANGUAGES } from "@/lib/poem-languages";

interface Poet { id: number; name: string; nameUrdu: string; era: string; }
interface Category { id: number; name: string; nameUrdu: string; slug: string; }

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

export default function ContributorPoemsEdit() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [poets, setPoets] = useState<Poet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [poemStatus, setPoemStatus] = useState("");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    titleUrdu: "",
    content: "",
    poetName: "",
    poetNameUrdu: "",
    category: "",
    categoryUrdu: "",
    language: "urdu",
    imageUrl: "",
  });

  useEffect(() => {
    Promise.all([
      contributorFetch(`/api/contributor/poems/${id}`).then((r) => r.ok ? r.json() : null),
      contributorFetch("/api/contributor/poets").then((r) => r.ok ? r.json() : null),
      contributorFetch("/api/contributor/categories").then((r) => r.ok ? r.json() : null),
    ]).then(([poem, p, c]) => {
      if (!poem) { toast({ title: "Poem not found or access denied", variant: "destructive" }); navigate("/contributor/submissions"); return; }
      if (poem.status === "published") { toast({ title: "Published poems cannot be edited" }); navigate("/contributor/submissions"); return; }
      setForm({
        title: poem.title || "",
        titleUrdu: poem.titleUrdu || "",
        content: poem.content || "",
        poetName: poem.poetName || "",
        poetNameUrdu: poem.poetNameUrdu || "",
        category: poem.category || "",
        categoryUrdu: poem.categoryUrdu || "",
         language: poem.language || "",
        imageUrl: poem.imageUrl || "",
      });
      setPoemStatus(poem.status);
      setRejectionReason(poem.rejectionReason ?? null);
      if (p) setPoets(p.poets);
      if (c) setCategories(c.categories);
    }).finally(() => setLoading(false));
  }, [id]);

  function handleCategorySelect(slug: string) {
    const cat = categories.find((c) => c.slug === slug);
    if (cat) {
      setForm((f) => ({ ...f, category: cat.name, categoryUrdu: cat.nameUrdu }));
    } else {
      setForm((f) => ({ ...f, category: "", categoryUrdu: "" }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const missing = getMissingPoemFields(form);
    if (missing.length > 0) {
      toast({
        title: "Please complete all required fields before saving the poem.",
        description: getPoemValidationMessage(missing).replace("Please complete all required fields before saving the poem. ", ""),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await contributorFetch(`/api/contributor/poems/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: form.title.trim(),
          titleUrdu: form.titleUrdu.trim(),
          content: form.content.trim(),
          poetName: form.poetName.trim(),
          poetNameUrdu: form.poetNameUrdu.trim(),
          category: form.category.trim(),
          categoryUrdu: form.categoryUrdu.trim(),
           language: form.language.trim(),
          imageUrl: form.imageUrl.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast({ title: d.message || "Failed to save", variant: "destructive" }); return;
      }
      const wasRejected = poemStatus === "rejected";
      toast({
        title: wasRejected ? "Poem resubmitted for review" : "Poem saved",
        description: wasRejected ? "It has been sent back to the approval queue." : undefined,
      });
      navigate("/contributor/submissions");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <ContributorLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="text-accent animate-spin" />
        </div>
      </ContributorLayout>
    );
  }

  return (
    <ContributorLayout>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="font-heading text-3xl tracking-wider text-foreground">Edit Poem</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {poemStatus === "rejected" ? "Fix the issues and resubmit for review." : "Update your poem submission."}
          </p>
        </div>

        {/* Rejection notice */}
        {poemStatus === "rejected" && rejectionReason && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5 flex gap-3">
            <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive mb-1">Rejection Reason</p>
              <p className="text-sm text-muted-foreground">{rejectionReason}</p>
              <p className="text-xs text-muted-foreground/60 mt-2">Fix the issue above and save to resubmit for review.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Titles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Title (Transliteration)" required>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </Field>
            <Field label="عنوان (Urdu)" required>
              <Input dir="rtl" value={form.titleUrdu} onChange={(e) => setForm((f) => ({ ...f, titleUrdu: e.target.value }))} className="font-urdu text-right" />
            </Field>
          </div>

          {/* Poet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Poet (English)" required>
              <Input value={form.poetName} onChange={(e) => setForm((f) => ({ ...f, poetName: e.target.value }))} />
            </Field>
            <Field label="شاعر (اردو)" required>
              <Input dir="rtl" value={form.poetNameUrdu} onChange={(e) => setForm((f) => ({ ...f, poetNameUrdu: e.target.value }))} className="font-urdu text-right" />
            </Field>
          </div>

          {/* Category & Language */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Category" required>
              <select
                value={categories.find((c) => c.name === form.category)?.slug ?? ""}
                onChange={(e) => handleCategorySelect(e.target.value)}
                className="w-full bg-background/50 border border-accent/20 rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
              >
                <option value="">Select a category...</option>
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Language" required>
              <select
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                className="w-full bg-background/50 border border-accent/20 rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
              >
                 <option value="">Select a language...</option>
                   {form.language === "farsi" && (
                     <option value="farsi" disabled>Farsi (legacy, keep existing value)</option>
                   )}
                  {POEM_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Content */}
          <Field label="Poem Content" required>
            <Textarea
              dir="rtl"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={12}
              className="font-urdu text-right text-base leading-loose resize-y"
            />
          </Field>

          {/* Image */}
          <Field label="Image URL (optional)">
            <Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
          </Field>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/contributor/submissions")}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {poemStatus === "rejected" ? "Save & Resubmit" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </ContributorLayout>
  );
}
