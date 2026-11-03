import { useState, useEffect, FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ContributorLayout } from "@/components/contributor-layout";
import { contributorFetch } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getMissingPoemFields, getPoemValidationMessage } from "@/lib/poem-validation";
import { POEM_LANGUAGES } from "@/lib/poem-languages";

interface Poet {
  id: number;
  name: string;
  nameUrdu: string;
  era: string;
}

interface Category {
  id: number;
  name: string;
  nameUrdu: string;
  slug: string;
}

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

export default function ContributorPoemsNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [poets, setPoets] = useState<Poet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    titleUrdu: "",
    content: "",
    poetId: "",
    poetName: "",
    poetNameUrdu: "",
    category: "",
    categoryUrdu: "",
    language: "",
    imageUrl: "",
  });
  const [poetMode, setPoetMode] = useState<"select" | "new">("select");

  useEffect(() => {
    Promise.all([
      contributorFetch("/api/contributor/poets").then((r) => r.ok ? r.json() : null),
      contributorFetch("/api/contributor/categories").then((r) => r.ok ? r.json() : null),
    ]).then(([p, c]) => {
      if (p) setPoets(p.poets);
      if (c) setCategories(c.categories);
    }).finally(() => setLoadingData(false));
  }, []);

  function handlePoetSelect(poetName: string) {
    const poet = poets.find((p) => p.name === poetName);
    if (poet) {
      setForm((f) => ({ ...f, poetName: poet.name, poetNameUrdu: poet.nameUrdu }));
    } else {
      setForm((f) => ({ ...f, poetName: poetName }));
    }
  }

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
      const res = await contributorFetch("/api/contributor/poems", {
        method: "POST",
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
        toast({ title: d.message || "Submission failed", variant: "destructive" }); return;
      }
      toast({ title: "Poem submitted for review", description: "You'll see it in My Submissions. Editors review within 48 hours." });
      navigate("/contributor/submissions");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ContributorLayout>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="font-heading text-3xl tracking-wider text-foreground">Submit New Poem</h1>
          <p className="text-muted-foreground text-sm mt-1">Your submission will be reviewed by an editor before publication.</p>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="text-accent animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Titles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Title (Transliteration)" required>
                <Input
                  placeholder="e.g. Shikwa"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </Field>
              <Field label="عنوان (Urdu)" required>
                <Input
                  dir="rtl"
                  placeholder="مثلاً: شکوہ"
                  value={form.titleUrdu}
                  onChange={(e) => setForm((f) => ({ ...f, titleUrdu: e.target.value }))}
                  className="font-urdu text-right"
                />
              </Field>
            </div>

            {/* Poet Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground tracking-widest uppercase">Poet <span className="text-destructive">*</span></label>
                <div className="flex gap-2">
                  {(["select", "new"] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setPoetMode(m)}
                      className={cn(
                        "text-[10px] font-heading tracking-widest uppercase px-2.5 py-1 rounded-md transition-all",
                        poetMode === m ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m === "select" ? "Select existing" : "Add new poet"}
                    </button>
                  ))}
                </div>
              </div>

              {poetMode === "select" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <select
                      value={form.poetName}
                      onChange={(e) => handlePoetSelect(e.target.value)}
                      className="w-full bg-background/50 border border-accent/20 rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                    >
                      <option value="">Select a poet...</option>
                      {poets.map((p) => (
                        <option key={p.id} value={p.name}>{p.name} ({p.era})</option>
                      ))}
                    </select>
                  </div>
                  <Field label="شاعر (Urdu Name)" required>
                    <Input
                      dir="rtl"
                      placeholder="شاعر کا اردو نام"
                      value={form.poetNameUrdu}
                      onChange={(e) => setForm((f) => ({ ...f, poetNameUrdu: e.target.value }))}
                      className="font-urdu text-right"
                    />
                  </Field>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Poet Name (English)" required>
                    <Input
                      placeholder="e.g. Allama Iqbal"
                      value={form.poetName}
                      onChange={(e) => setForm((f) => ({ ...f, poetName: e.target.value }))}
                    />
                  </Field>
                  <Field label="شاعر کا نام (اردو)" required>
                    <Input
                      dir="rtl"
                      placeholder="مثلاً: علامہ اقبال"
                      value={form.poetNameUrdu}
                      onChange={(e) => setForm((f) => ({ ...f, poetNameUrdu: e.target.value }))}
                      className="font-urdu text-right"
                    />
                  </Field>
                </div>
              )}

              {poetMode === "new" && (
                <p className="text-xs text-amber-400/80">
                  You can also <Link href="/contributor/poets/new" className="underline">create the poet profile</Link> first, then come back to submit this poem.
                </p>
              )}
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
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Language" required>
                <select
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  className="w-full bg-background/50 border border-accent/20 rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="">Select a language...</option>
                  {POEM_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Content */}
            <Field label="Poem Content (Urdu / Script)" required>
              <Textarea
                dir="rtl"
                placeholder="یہاں شعر لکھیں..."
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={12}
                className="font-urdu text-right text-base leading-loose resize-y"
              />
            </Field>

            {/* Optional image */}
            <Field label="Image URL (optional)">
              <Input
                placeholder="https://..."
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              />
            </Field>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate("/contributor/submissions")}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submitting ? "Submitting..." : "Submit for Review"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </ContributorLayout>
  );
}
