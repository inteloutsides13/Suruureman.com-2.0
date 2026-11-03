import { FormEvent, useState } from "react";
import { ArrowUpLeft, Check, Clipboard, Feather, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { useCreateIrabText } from "@workspace/api-client-react";
import { useSeo } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";

const MAX_CHARACTERS = 20000;

function getFriendlyError(error: unknown) {
  const structuredError =
    typeof error === "object" && error !== null
      ? (error as { status?: unknown; data?: unknown })
      : undefined;
  const status = typeof structuredError?.status === "number" ? structuredError.status : undefined;
  const responseError =
    typeof structuredError?.data === "object" &&
    structuredError.data !== null &&
    "error" in structuredError.data &&
    typeof structuredError.data.error === "string"
      ? structuredError.data.error
      : "";
  const message = (
    responseError ||
    (typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "")
  ).toLowerCase();

  if (status === 429 || message.includes("rate") || message.includes("429") || message.includes("limit")) {
    return "آج کے لیے درخواستوں کی حد پوری ہو گئی ہے۔ کچھ دیر بعد دوبارہ کوشش کریں۔";
  }

  if (status === 504 || message.includes("timeout") || message.includes("timed out")) {
    return "جواب آنے میں معمول سے زیادہ وقت لگ رہا ہے۔ براہِ کرم دوبارہ کوشش کریں۔";
  }

  if (
    status === 502 ||
    status === 503 ||
    message.includes("provider") ||
    message.includes("service") ||
    message.includes("unavailable") ||
    message.includes("502") ||
    message.includes("503")
  ) {
    return "اس وقت اِعْراب کی خدمت دستیاب نہیں۔ براہِ کرم کچھ دیر بعد دوبارہ کوشش کریں۔";
  }

  if (responseError) return responseError;
  return "اِعْراب لگانے میں دشواری پیش آئی۔ براہِ کرم دوبارہ کوشش کریں۔";
}

export default function Irab() {
  useSeo({
    title: "اِعْراب — e'raab",
    description:
      "اِعْراب — e'raab: اپنے اردو کلام میں پیشہ ورانہ اِعْراب لگائیں، عبارت کی ساخت اور سطری ترتیب برقرار رکھتے ہوئے۔",
    ogTitle: "اِعْراب — e'raab | Suruur E Man",
    ogDescription: "اِعْراب — e'raab: اردو کلام کے لیے ایک محتاط اور قابلِ اعتماد ٹول۔",
  });

  const { toast } = useToast();
  const createIrabText = useCreateIrabText();
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isPending = createIrabText.isPending;
  const characterCount = Array.from(text).length;
  const canSubmit = characterCount > 0 && characterCount <= MAX_CHARACTERS && !isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    setApiError(null);
    setCopied(false);
    setResult(null);

    if (text.length === 0) {
      setValidationError("براہِ کرم اپنا کلام درج کریں۔");
      return;
    }

    if (text.length > MAX_CHARACTERS) {
      setValidationError(`کلام ${MAX_CHARACTERS.toLocaleString("en-US")} حروف سے زیادہ نہیں ہونا چاہیے۔`);
      return;
    }

    createIrabText.mutate(
      { data: { text } },
      {
        onSuccess: (response) => {
          const possibleResponse = response as unknown as {
            success?: boolean;
            text?: string;
            error?: string;
          };

          if (possibleResponse.success === false || typeof possibleResponse.text !== "string") {
            setApiError(getFriendlyError(possibleResponse.error));
            return;
          }

          setResult(possibleResponse.text);
        },
        onError: (error) => {
          setApiError(getFriendlyError(error));
        },
      },
    );
  }

  async function handleCopy() {
    if (result === null) return;

    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast({
        title: "نتیجہ کاپی ہو گیا",
        description: "اِعْراب والی عبارت آپ کے کلپ بورڈ میں محفوظ ہے۔",
      });
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast({
        title: "کاپی نہیں ہو سکا",
        description: "براہِ کرم نتیجہ منتخب کر کے کاپی کریں۔",
        variant: "destructive",
      });
    }
  }

  function clearWorkspace() {
    setText("");
    setResult(null);
    setValidationError(null);
    setApiError(null);
    setCopied(false);
  }

  return (
    <div className="relative isolate overflow-hidden" data-testid="page-irab">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.22),transparent_68%)]" />
      <div className="pointer-events-none absolute right-[-8rem] top-40 -z-10 h-72 w-72 rounded-full border border-accent/10 opacity-70 sm:right-[-4rem]" />
      <div className="pointer-events-none absolute left-[-12rem] top-[32rem] -z-10 h-96 w-96 rounded-full border border-primary/20 opacity-60" />

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pt-16 lg:px-8 lg:pb-24 lg:pt-20">
        <header className="mx-auto max-w-4xl text-center" dir="rtl">
          <div className="mb-5 flex items-center justify-center gap-3 text-accent/75" data-testid="text-irab-eyebrow">
            <span className="h-px w-12 bg-gradient-to-l from-accent/70 to-transparent sm:w-20" />
            <span className="font-urdu text-base tracking-normal">عبارت کی حفاظت کے ساتھ</span>
            <span className="h-px w-12 bg-gradient-to-r from-accent/70 to-transparent sm:w-20" />
          </div>
          <h1 className="font-urdu text-4xl leading-[1.7] text-foreground sm:text-6xl lg:text-7xl" data-testid="heading-irab-urdu">
            اِعْراب ٹول
          </h1>
          <p className="mt-1 font-heading text-2xl tracking-tight text-accent/90 sm:text-3xl" dir="ltr" data-testid="heading-irab-english">
            e'raab Tool
          </p>
          <p className="mx-auto mt-6 max-w-2xl font-urdu text-lg leading-[2.25] text-muted-foreground sm:text-xl" data-testid="text-irab-intro">
            اپنے کلام میں پیشہ ورانہ اِعْراب لگائیں۔ الفاظ، رموزِ اوقاف اور سطری ترتیب جوں کی توں رہتی ہے۔
          </p>
        </header>

        <div className="mx-auto mt-12 grid max-w-6xl gap-8 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-14">
          <section className="min-w-0" aria-labelledby="workspace-heading">
            <div className="mb-4 flex items-end justify-between gap-4 px-1" dir="rtl">
              <div>
                <p className="mb-1 font-urdu text-sm text-accent/80">اپنا متن یہاں لکھیں</p>
                <h2 id="workspace-heading" className="font-heading text-xl text-foreground sm:text-2xl" dir="ltr">
                  Your Kalam
                </h2>
              </div>
              <div className="hidden h-px flex-1 bg-gradient-to-l from-accent/30 to-transparent sm:block" />
              <span className="font-urdu text-sm text-muted-foreground/70" data-testid="text-preservation-note">
                متن میں کوئی تبدیلی نہیں
              </span>
            </div>

            <form onSubmit={handleSubmit} className="relative" data-testid="form-irab">
              <div className="overflow-hidden rounded-[1.35rem] border border-accent/25 bg-card/75 shadow-[0_20px_70px_hsl(340_25%_2%/0.45)] backdrop-blur-xl transition-colors focus-within:border-accent/60">
                <div className="flex items-center justify-between border-b border-accent/10 bg-background/25 px-4 py-3 sm:px-6" dir="rtl">
                  <div className="flex items-center gap-2 font-urdu text-sm text-muted-foreground">
                    <Feather size={15} className="text-accent/80" aria-hidden="true" />
                    <span>کلام</span>
                  </div>
                  <span
                    className={characterCount > MAX_CHARACTERS ? "text-destructive" : "text-muted-foreground"}
                    dir="ltr"
                    data-testid="text-character-count"
                    aria-live="polite"
                  >
                    {characterCount.toLocaleString("en-US")} / {MAX_CHARACTERS.toLocaleString("en-US")}
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    setValidationError(null);
                    setApiError(null);
                    setCopied(false);
                  }}
                  dir="rtl"
                  lang="ur"
                  aria-label="اپنا کلام یہاں درج کریں"
                  placeholder="اپنا کلام یہاں درج کریں"
                  className="min-h-[20rem] w-full resize-y bg-transparent px-5 py-7 font-urdu text-xl leading-[2.35] text-foreground outline-none placeholder:text-muted-foreground/45 sm:min-h-[25rem] sm:px-8 sm:py-9 sm:text-2xl"
                  data-testid="textarea-irab-input"
                />
                <div className="flex flex-col gap-4 border-t border-accent/10 bg-background/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" dir="rtl">
                  <p className="font-urdu text-xs leading-7 text-muted-foreground/75 sm:text-sm">
                    سطری وقفے اور اصل انداز محفوظ رہیں گے۔
                  </p>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="group inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-primary px-6 py-3 font-urdu text-base text-primary-foreground shadow-[0_8px_25px_hsl(var(--primary)/0.28)] transition-[transform,background-color,opacity] hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-44"
                    data-testid="button-submit-irab"
                  >
                    {isPending ? (
                      <>
                        <span className="h-4 w-4 animate-pulse rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground" aria-hidden="true" />
                        <span>اِعْراب لگ رہے ہیں…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={17} aria-hidden="true" />
                        <span>اِعْراب لگائیں</span>
                        <ArrowUpLeft size={17} className="transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {(validationError || apiError) && (
              <div
                className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-right font-urdu text-sm leading-8 text-destructive-foreground"
                role="alert"
                data-testid="status-irab-error"
                dir="rtl"
              >
                {validationError || apiError}
              </div>
            )}

            {isPending && (
              <div className="mt-8 overflow-hidden rounded-[1.35rem] border border-accent/15 bg-card/45 p-5 sm:p-7" data-testid="status-irab-processing" aria-live="polite">
                <div className="mb-5 flex items-center justify-between" dir="rtl">
                  <span className="font-urdu text-base text-accent">اِعْراب لگ رہے ہیں…</span>
                  <span className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground/60" dir="ltr">Working</span>
                </div>
                <div className="space-y-3" aria-hidden="true">
                  <div className="ml-auto h-3 w-11/12 animate-pulse rounded bg-muted/70" />
                  <div className="ml-auto h-3 w-4/5 animate-pulse rounded bg-muted/55" />
                  <div className="ml-auto h-3 w-3/5 animate-pulse rounded bg-muted/40" />
                </div>
              </div>
            )}

            {result !== null && !isPending && (
              <section className="mt-8 overflow-hidden rounded-[1.35rem] border border-accent/35 bg-card shadow-[0_18px_60px_hsl(340_25%_2%/0.4)]" aria-labelledby="result-heading" data-testid="section-irab-result">
                <div className="flex flex-col gap-4 border-b border-accent/15 bg-accent/[0.045] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7" dir="rtl">
                  <div>
                    <p className="mb-1 font-urdu text-sm text-accent/80">آپ کی درست شدہ عبارت</p>
                    <h2 id="result-heading" className="font-heading text-xl text-foreground sm:text-2xl" dir="ltr">Result</h2>
                  </div>
                  <div className="flex items-center gap-2" dir="ltr">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-accent/35 px-3.5 py-2 text-xs font-medium uppercase tracking-[0.12em] text-accent transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      data-testid="button-copy-result"
                    >
                      {copied ? <Check size={15} aria-hidden="true" /> : <Clipboard size={15} aria-hidden="true" />}
                      <span>Copy Result</span>
                    </button>
                    <button
                      type="button"
                      onClick={clearWorkspace}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-foreground/10 px-3.5 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      data-testid="button-clear-irab"
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>
                <div
                  className="whitespace-pre-wrap px-5 py-8 text-right font-urdu text-xl leading-[2.6] text-foreground sm:px-8 sm:py-10 sm:text-2xl"
                  dir="rtl"
                  lang="ur"
                  data-testid="text-irab-result"
                  tabIndex={0}
                >
                  {result}
                </div>
              </section>
            )}
          </section>

          <aside className="lg:pt-12" dir="rtl" aria-label="e'raab tool information">
            <div className="border-t border-accent/30 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
              <div className="mb-7 flex items-center gap-3 text-accent">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-accent/25 bg-accent/10">
                  <ShieldCheck size={17} aria-hidden="true" />
                </span>
                <span className="font-urdu text-base">احتیاط سے تیار کردہ</span>
              </div>
              <h2 className="font-urdu text-2xl leading-[1.8] text-foreground sm:text-3xl" data-testid="heading-irab-guidance">
                آپ کے لفظ، آپ کی ترتیب
              </h2>
              <p className="mt-4 font-urdu text-base leading-[2.35] text-muted-foreground" data-testid="text-irab-guidance">
                یہ آلہ صرف اِعْراب کا اضافہ کرتا ہے۔ آپ کے الفاظ، مصرعوں کی سطری ساخت اور وقفے اپنی جگہ برقرار رہتے ہیں۔
              </p>

              <div className="mt-9 space-y-5 border-t border-accent/15 pt-6">
                <div className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <p className="font-urdu text-sm leading-[2.2] text-muted-foreground">کلام بیس ہزار حروف تک درج کیا جا سکتا ہے۔</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <p className="font-urdu text-sm leading-[2.2] text-muted-foreground">نتیجہ دیکھیں، کاپی کریں، یا نئے کلام سے دوبارہ آغاز کریں۔</p>
                </div>
              </div>

              <div className="mt-9 rounded-xl border border-primary/25 bg-primary/[0.08] px-4 py-4" data-testid="text-irab-privacy">
                <p className="font-urdu text-sm leading-[2.15] text-foreground/80">
                  اپنا متن بھیجنے سے پہلے اطمینان کر لیں۔ نتیجہ اسی نشست میں آپ کے سامنے دکھایا جائے گا۔
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}