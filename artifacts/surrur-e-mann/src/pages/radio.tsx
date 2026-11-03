import { motion } from "framer-motion";
import { ArrowUpRight, CalendarClock, Radio } from "lucide-react";
import { Link } from "wouter";
import { useRadioStatus } from "@/hooks/use-radio-status";
import { useSeo } from "@/hooks/use-seo";
import { RadioCalendarPublic } from "@/components/radio-calendar-public";

function scheduleDays(value: string) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  try {
    const days = JSON.parse(value) as unknown;
    if (Array.isArray(days) && days.length > 0) {
      return days.map((day) => typeof day === "number" && names[day] ? names[day] : String(day)).join(" · ");
    }
  } catch {
    if (value.trim()) return value;
  }
  return "Weekly schedule";
}

export default function RadioPage() {
  useSeo({
    title: "Suruur FM | Urdu Literary Radio",
    description: "شاعری، آواز اور احساس — Surrur FM پر۔",
    ogTitle: "Suruur FM | Suruureman",
  });

  const radio = useRadioStatus();

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[44rem] bg-[radial-gradient(ellipse_at_70%_14%,hsl(var(--radio-ember)/.14),transparent_55%),radial-gradient(ellipse_at_15%_20%,hsl(var(--accent)/.08),transparent_45%)]" />

      <main className="relative mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10 lg:px-8 lg:pb-28">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <h1 className="max-w-3xl font-urdu text-5xl leading-[1.8] text-foreground sm:text-6xl lg:text-7xl" dir="rtl">
              لفظ، آواز، <span className="text-accent text-glow-gold">سُرور</span>
            </h1>
            <p className="mt-3 max-w-xl font-heading text-2xl leading-relaxed text-foreground/90 sm:text-3xl">
              Radio Suruur FM
            </p>
            <p className="mt-4 max-w-xl font-urdu text-xl leading-[2] text-muted-foreground sm:text-2xl" dir="rtl">
              شاعری، آواز اور احساس — ایک ہی جگہ۔
            </p>
            <div className="mt-6">
              <Link href="/poems" data-testid="link-radio-poetry" className="inline-flex items-center gap-2 text-sm text-accent/85 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                شاعری پڑھیے
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </motion.div>

          <motion.div id="listen" className="min-w-0" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }}>
            <section
              className="relative overflow-hidden rounded-[1.75rem] border border-accent/20 bg-[hsl(var(--radio-ink))] shadow-[0_18px_70px_hsl(340_25%_2%_/_0.6)]"
              aria-labelledby="gocast-listener-title"
            >
              <div className="radio-grid pointer-events-none absolute inset-0 opacity-40" />
              <div className="relative z-10 p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent">
                    <Radio size={18} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 id="gocast-listener-title" className="font-urdu text-2xl leading-[1.8] text-accent">
                      سُرور ایف ایم
                    </h2>
                    <p className="font-urdu text-base leading-[1.8] text-muted-foreground" dir="rtl">
                      سننے کے لیے نیچے موجود سُرور ایف ایم پلیئر استعمال کریں۔
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        </section>

        {radio.schedules.length > 0 && (
          <section className="mt-16 border-t border-accent/10 pt-10 sm:mt-20 sm:pt-12" aria-labelledby="radio-schedule-heading">
            <div className="mb-7 flex items-center justify-between gap-4">
              <h2 id="radio-schedule-heading" className="font-urdu text-3xl leading-[1.8] text-foreground sm:text-4xl" dir="rtl">
                نشریاتی پروگرام
              </h2>
              <CalendarClock size={21} className="shrink-0 text-accent/70" aria-hidden="true" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {radio.schedules.map((schedule) => (
                <article key={schedule.id} className="rounded-2xl border border-accent/15 bg-card/45 p-5 transition-colors hover:border-accent/30 hover:bg-card/60">
                  <h3 className="font-heading text-xl text-foreground">{schedule.programName || schedule.name}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {schedule.startLocalTime}–{schedule.endLocalTime} · {scheduleDays(schedule.daysOfWeek)} · {schedule.timezone}
                  </p>
                  {schedule.occurrenceLocalDate && <p className="mt-2 text-xs text-muted-foreground/80">{schedule.occurrenceLocalDate}</p>}
                  {schedule.attribution && <p className="mt-2 text-xs text-muted-foreground/80">{schedule.attribution}</p>}
                </article>
              ))}
            </div>
          </section>
        )}
        <RadioCalendarPublic />
      </main>
    </div>
  );
}