import { ArrowUpRight, Radio } from "lucide-react";

type GuideAudience = "admin" | "contributor";

const adminBroadcastSteps = [
  ["Open the GoCast.fm station dashboard.", "GoCast.fm اسٹیشن ڈیش بورڈ کھولیں۔"],
  ["Start the station/AutoDJ or connect an approved broadcaster.", "اسٹیشن/آٹو ڈی جے شروع کریں یا منظور شدہ براڈکاسٹر کو کنیکٹ کریں۔"],
  ["Open the public /radio page and test playback in the player.", "عوامی /radio صفحہ کھولیں اور پلیئر میں آواز چیک کریں۔"],
  ["Stop broadcasting when finished.", "نشریات مکمل ہونے پر انہیں روک دیں۔"],
] as const;

const contributorBroadcastSteps = [
  ["Use the broadcaster setup link and connection details shared privately by the Radio administrator.", "ریڈیو منتظم کی جانب سے نجی طور پر فراہم کردہ براڈکاسٹر سیٹ اپ لنک اور کنکشن تفصیلات استعمال کریں۔"],
  ["Start broadcasting with the approved app or device.", "منظور شدہ ایپ یا ڈیوائس کے ذریعے نشریات شروع کریں۔"],
  ["Test playback in the public /radio player.", "عوامی /radio پلیئر میں آواز چیک کریں۔"],
  ["Stop broadcasting when finished.", "نشریات مکمل ہونے پر انہیں روک دیں۔"],
] as const;

export function MobileBroadcastGuide({ audience = "contributor" }: { audience?: GuideAudience }) {
  const isAdmin = audience === "admin";
  const steps = isAdmin ? adminBroadcastSteps : contributorBroadcastSteps;

  return (
    <section
      className="rounded-xl border border-accent/15 bg-card/30 p-4 sm:p-6"
      aria-labelledby="mobile-broadcast-title"
    >
      <div className="flex items-start gap-3">
        <Radio size={20} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="mobile-broadcast-title" className="font-heading text-xl">
            Broadcasting instructions
          </h2>
          <p className="mt-1 font-urdu text-base leading-7 text-muted-foreground" dir="rtl">
            نشریاتی ہدایات
          </p>
        </div>
      </div>

      <p className="mt-3 rounded-lg border border-accent/15 bg-background/30 p-3 text-sm leading-6 text-muted-foreground">
        Playback cannot be verified by this website. Check playback in the GoCast.fm player on /radio.
      </p>

      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map(([english, urdu], index) => (
          <li key={english} className="flex min-w-0 gap-3 rounded-lg border border-accent/10 bg-background/30 p-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-xs text-accent" aria-hidden="true">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-5 text-foreground/90">{english}</p>
              <p className="mt-1 font-urdu text-sm leading-6 text-muted-foreground" dir="rtl">{urdu}</p>
            </div>
          </li>
        ))}
      </ol>

      {!isAdmin && (
        <a
          href="/radio"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-accent/20 px-4 py-2.5 text-sm text-accent transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Open public Radio page
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      )}
    </section>
  );
}
