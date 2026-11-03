import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ExternalLink, Info, X } from "lucide-react";

type PublicProgramme = {
  id: number;
  titleEn: string;
  titleUr: string;
  descriptionEn: string | null;
  descriptionUr: string | null;
  programmeType: string;
  programmeDate: string;
  startTime: string;
  endTime: string;
  externalLink: string | null;
  publicNote: string | null;
};

type CalendarResponse = {
  timezone: string;
  startDate: string;
  programmes: PublicProgramme[];
};

const RADIO_CALENDAR_TIMEZONE = "Europe/Berlin";

function berlinToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RADIO_CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function mondayFor(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return moveDate(date, weekday === 0 ? -6 : 1 - weekday);
}

function moveDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dateForBerlin(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: RADIO_CALENDAR_TIMEZONE })
    .format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function timeLabel(value: string) {
  const [hourText, minute = "00"] = value.slice(0, 5).split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}

function typeBadgeClass(type: string) {
  if (type === "Poetry Hour") return "border-accent/40 bg-accent/10 text-accent";
  return "border-accent/20 bg-card/55 text-muted-foreground";
}

function dayLabel(value: string) {
  return dateForBerlin(value, { weekday: "short" });
}

function dayNumber(value: string) {
  return dateForBerlin(value, { day: "numeric" });
}

export function RadioCalendarPublic() {
  const [startDate, setStartDate] = useState(() => mondayFor(berlinToday()));
  const [selectedDate, setSelectedDate] = useState(berlinToday);
  const [programmes, setProgrammes] = useState<PublicProgramme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [selectedProgramme, setSelectedProgramme] = useState<PublicProgramme | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => moveDate(startDate, index)), [startDate]);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/radio-calendar/programmes?startDate=${encodeURIComponent(startDate)}`, {
        cache: "no-store",
        signal,
      });
      const body = await response.json().catch(() => null) as CalendarResponse | { message?: string } | null;
      if (!response.ok) throw new Error(body && "message" in body && body.message ? body.message : "The programme calendar could not be loaded.");
      if (!body || !("programmes" in body) || !Array.isArray(body.programmes)) {
        throw new Error("The programme calendar returned an incomplete response.");
      }
      if (signal.aborted) return;
      setProgrammes(body.programmes);
    } catch (cause) {
      if (signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "The programme calendar could not be loaded.");
      setProgrammes([]);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [startDate]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refresh]);

  useEffect(() => {
    if (!days.includes(selectedDate)) setSelectedDate(startDate);
  }, [days, selectedDate, startDate]);

  useEffect(() => {
    if (!selectedProgramme) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedProgramme(null);
      if (event.key === "Tab") {
        const focusable = Array.from(document.querySelectorAll<HTMLElement>(
          '[role="dialog"] button:not([disabled]), [role="dialog"] a[href], [role="dialog"] [tabindex]:not([tabindex="-1"])',
        ));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [selectedProgramme]);

  const selectedDayProgrammes = useMemo(
    () => programmes
      .filter((programme) => programme.programmeDate.slice(0, 10) === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [programmes, selectedDate],
  );
  const openDetails = (programme: PublicProgramme, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    setSelectedProgramme(programme);
  };

  return (
    <section id="radio-calendar" className="radio-calendar mx-auto mt-12 max-w-6xl border-t border-accent/15 pt-8 sm:mt-16 sm:pt-10" aria-labelledby="radio-calendar-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div dir="ltr" className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.2em] text-[hsl(var(--radio-brass))]">
            <CalendarDays size={14} aria-hidden="true" />
            <span>Radio schedule</span>
            <span aria-hidden="true" className="text-foreground/35">·</span>
            <span>Europe/Berlin</span>
            <details className="group relative">
              <summary
                role="button"
                aria-label="About schedule times and publication"
                className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden"
              >
                <Info size={14} aria-hidden="true" />
              </summary>
              <p role="tooltip" className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-accent/20 bg-[hsl(var(--radio-ink))] p-3 text-xs normal-case leading-5 tracking-normal text-foreground shadow-xl">
                All schedule times use Europe/Berlin (CET/CEST). Only published programmes are shown; this schedule does not indicate live broadcast status.
              </p>
            </details>
          </div>
          <h2 id="radio-calendar-heading" className="mt-1 font-urdu text-2xl leading-[1.9] text-foreground sm:text-3xl" dir="rtl">
            ریڈیو پروگراموں کا کیلنڈر
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="calendar-this-week"
            onClick={() => { const today = berlinToday(); setStartDate(mondayFor(today)); setSelectedDate(today); }}
            className="min-h-10 rounded-lg border border-accent/25 px-3 text-xs text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            This week
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-accent/15 bg-card/30 p-0.5" aria-label="Calendar week navigation">
            <button
              type="button"
              data-testid="calendar-previous-week"
              aria-label="Show previous week"
              onClick={() => setStartDate((date) => moveDate(date, -7))}
              className="grid h-9 w-9 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <span className="min-w-28 px-1 text-center text-xs text-foreground/80" aria-live="polite">
              {dateForBerlin(startDate, { month: "short", day: "numeric" })} – {dateForBerlin(moveDate(startDate, 6), { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <button
              type="button"
              data-testid="calendar-next-week"
              aria-label="Show next week"
              onClick={() => setStartDate((date) => moveDate(date, 7))}
              className="grid h-9 w-9 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <nav dir="ltr" aria-label="Choose a schedule day" className="grid grid-cols-4 gap-1.5 min-[360px]:grid-cols-7 sm:gap-2">
        {days.map((day) => {
          const active = day === selectedDate;
          const count = programmes.filter((item) => item.programmeDate.slice(0, 10) === day).length;
          return (
            <button
              type="button"
              key={day}
              data-testid={`calendar-day-${day}`}
              aria-label={`${dateForBerlin(day, { weekday: "long", month: "long", day: "numeric" })}${count ? `, ${count} published ${count === 1 ? "programme" : "programmes"}` : ", no published programmes"}`}
              aria-pressed={active}
              onClick={() => setSelectedDate(day)}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center rounded-lg border px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? "border-primary/70 bg-primary/25 text-accent" : "border-accent/15 bg-card/25 text-muted-foreground hover:border-accent/35 hover:text-foreground"}`}
            >
              <span className="text-[0.58rem] uppercase tracking-[0.08em] sm:text-[0.64rem] sm:tracking-[0.12em]">{dayLabel(day)}</span>
              <span className={`font-heading text-base leading-5 sm:text-lg ${active ? "text-accent" : "text-foreground/85"}`}>{dayNumber(day)}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-6">
        <div dir="ltr" className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-accent/20 pb-2.5">
          <h3 className="font-heading text-lg text-foreground sm:text-xl" aria-live="polite">
            {dateForBerlin(selectedDate, { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          <span className="text-xs text-muted-foreground">
            {selectedDayProgrammes.length ? `${selectedDayProgrammes.length} ${selectedDayProgrammes.length === 1 ? "programme" : "programmes"}` : "Schedule"}
          </span>
        </div>

        {loading && (
          <div data-testid="calendar-loading" role="status" aria-label="Loading programme calendar" className="divide-y divide-accent/10">
            {[0, 1].map((item) => <div key={item} className="h-16 motion-safe:animate-pulse bg-card/20" />)}
            <span className="sr-only">Loading programme calendar…</span>
          </div>
        )}
        {!loading && error && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-destructive/20 py-4" role="alert">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 shrink-0 text-destructive" size={16} aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">Schedule unavailable</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <button type="button" data-testid="calendar-retry" onClick={() => setRefresh((value) => value + 1)} className="min-h-10 rounded-lg border border-accent/25 px-3 text-sm text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Try again
            </button>
          </div>
        )}
        {!loading && !error && selectedDayProgrammes.length === 0 && (
          <div data-testid="calendar-empty" className="border-b border-accent/10 py-5">
            <p className="font-urdu text-base leading-[2] text-foreground" dir="rtl">اس دن کے لیے کوئی شائع شدہ پروگرام نہیں۔</p>
            <p className="mt-1 text-sm text-muted-foreground">There are no published programmes for this day.</p>
          </div>
        )}
        {!loading && !error && selectedDayProgrammes.length > 0 && (
          <ol className="divide-y divide-accent/10">
            {selectedDayProgrammes.map((programme) => (
              <li key={programme.id} data-testid={`programme-row-${programme.id}`}>
                <button
                  type="button"
                  aria-label={`Show details for ${programme.titleEn}, ${timeLabel(programme.startTime)}`}
                  onClick={(event) => openDetails(programme, event.currentTarget)}
                  dir="ltr"
                  className="group flex min-h-16 w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset sm:gap-4 sm:py-3.5"
                >
                  <span className="w-[4.25rem] shrink-0 border-r border-accent/20 pr-2.5 font-mono text-sm leading-5 text-[hsl(var(--radio-brass))] sm:w-[4.75rem]">
                    {timeLabel(programme.startTime)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-heading text-base leading-snug text-foreground transition-colors group-hover:text-accent sm:text-lg">{programme.titleEn}</span>
                    {programme.titleUr && <span className="mt-0.5 block break-words font-urdu text-sm leading-[1.9] text-muted-foreground sm:text-base" dir="rtl">{programme.titleUr}</span>}
                    <span className={`mt-1 inline-flex max-w-full rounded-full border px-2 py-0.5 text-[0.58rem] leading-4 sm:text-[0.62rem] ${typeBadgeClass(programme.programmeType)}`}>{programme.programmeType}</span>
                  </span>
                  <ChevronRight className="shrink-0 text-accent/55 transition-transform group-hover:translate-x-0.5" size={17} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {selectedProgramme && (
        <div
          className="fixed inset-0 z-[80] grid place-items-end bg-[hsl(340_25%_2%/.82)] p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProgramme(null); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="programme-detail-title"
            className="radio-detail w-full max-w-xl rounded-t-3xl border border-accent/25 bg-[hsl(var(--radio-ink))] p-6 shadow-2xl sm:rounded-3xl sm:p-8"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[hsl(var(--radio-brass))]">Programme details · Europe/Berlin</p>
                <h3 id="programme-detail-title" className="mt-3 font-heading text-2xl text-foreground">{selectedProgramme.titleEn}</h3>
                <p className="mt-1 font-urdu text-xl leading-[2] text-accent" dir="rtl">{selectedProgramme.titleUr}</p>
              </div>
              <button ref={closeButtonRef} type="button" data-testid="close-programme-details" aria-label="Close programme details" onClick={() => setSelectedProgramme(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-accent/20 text-muted-foreground hover:bg-accent/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-accent/15 py-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><CalendarDays size={15} className="text-accent" aria-hidden="true" />{dateForBerlin(selectedProgramme.programmeDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
              <span className="inline-flex items-center gap-2"><Clock3 size={15} className="text-accent" aria-hidden="true" />{timeLabel(selectedProgramme.startTime)} – {timeLabel(selectedProgramme.endTime)} Berlin time</span>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-foreground">{selectedProgramme.programmeType}</span>
            </div>
            {selectedProgramme.descriptionEn && <p className="mt-5 text-sm leading-7 text-foreground/85">{selectedProgramme.descriptionEn}</p>}
            {selectedProgramme.descriptionUr && <p className="mt-4 font-urdu text-base leading-[2.4] text-foreground/85" dir="rtl">{selectedProgramme.descriptionUr}</p>}
            {selectedProgramme.publicNote && <p className="mt-5 border-l-2 border-accent/60 pl-3 text-sm leading-6 text-accent">{selectedProgramme.publicNote}</p>}
            {selectedProgramme.externalLink && (
              <a href={selectedProgramme.externalLink} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                More information <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
