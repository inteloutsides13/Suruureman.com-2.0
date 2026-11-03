import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Edit3, LoaderCircle, Plus, Save, Upload, X } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetch, useAdminAuth } from "@/hooks/use-admin-auth";

const programmeTypes = ["Auto DJ", "Live Radio", "Recorded Show", "Poetry Hour", "TikTok Live", "Announcement/Break"] as const;
const RADIO_CALENDAR_TIMEZONE = "Europe/Berlin";
type ProgrammeType = typeof programmeTypes[number];
type ProgrammeStatus = "draft" | "published" | "cancelled";
type Programme = {
  id: number;
  titleEn: string;
  titleUr: string;
  descriptionEn: string | null;
  descriptionUr: string | null;
  programmeType: ProgrammeType;
  programmeDate: string;
  startTime: string;
  endTime: string;
  timezone: "Europe/Berlin";
  externalLink: string | null;
  publicNote: string | null;
  status: ProgrammeStatus;
};
type Form = Omit<Programme, "id" | "status">;
type ImportPreviewItem = {
  titleEn?: unknown;
  titleUr?: unknown;
  programmeDate?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  programmeType?: unknown;
};

function berlinToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: RADIO_CALENDAR_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function mondayFor(date: string) {
  const weekday = new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay();
  return moveDate(date, weekday === 0 ? -6 : 1 - weekday);
}

function moveDate(date: string, days: number) {
  const value = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: RADIO_CALENDAR_TIMEZONE }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function emptyForm(date: string): Form {
  return {
    titleEn: "",
    titleUr: "",
    descriptionEn: null,
    descriptionUr: null,
    programmeType: programmeTypes[0],
    programmeDate: date,
    startTime: "18:00",
    endTime: "19:00",
    timezone: "Europe/Berlin",
    externalLink: null,
    publicNote: null,
  };
}

function fieldValue(value: string | null) {
  return value ?? "";
}

function statusClass(status: ProgrammeStatus) {
  if (status === "published") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "cancelled") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

export default function AdminRadioCalendar() {
  const { role } = useAdminAuth();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [startDate, setStartDate] = useState(() => mondayFor(berlinToday()));
  const [selectedDate, setSelectedDate] = useState(berlinToday);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [form, setForm] = useState<Form>(() => emptyForm(berlinToday()));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewItem[] | null>(null);
  const [importing, setImporting] = useState(false);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => moveDate(startDate, index)), [startDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await adminFetch(`/api/admin/radio-calendar/programmes?startDate=${encodeURIComponent(startDate)}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "The programme calendar could not be loaded.");
      if (!Array.isArray(data?.programmes)) throw new Error("The calendar response was incomplete.");
      setProgrammes(data.programmes as Programme[]);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "The programme calendar could not be loaded.");
      setProgrammes([]);
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!days.includes(selectedDate)) setSelectedDate(startDate);
  }, [days, selectedDate, startDate]);

  const selectedDayProgrammes = useMemo(
    () => programmes
      .filter((programme) => programme.programmeDate.slice(0, 10) === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [programmes, selectedDate],
  );

  function updateField<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function edit(programme: Programme) {
    const { id, status: _status, ...values } = programme;
    setEditingId(id);
    setForm({
      ...values,
      startTime: values.startTime.slice(0, 5),
      endTime: values.endTime.slice(0, 5),
    });
    setError(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm(selectedDate));
    setError(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (form.endTime <= form.startTime) {
      setError("End time must be later than start time. All calendar times use Europe/Berlin.");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      titleEn: form.titleEn.trim(),
      titleUr: form.titleUr.trim(),
      startTime: form.startTime.slice(0, 5),
      endTime: form.endTime.slice(0, 5),
      descriptionEn: form.descriptionEn?.trim() || null,
      descriptionUr: form.descriptionUr?.trim() || null,
      externalLink: form.externalLink?.trim() || null,
      publicNote: form.publicNote?.trim() || null,
    };
    try {
      const response = await adminFetch(
        editingId ? `/api/admin/radio-calendar/programmes/${editingId}` : "/api/admin/radio-calendar/programmes",
        { method: editingId ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Programme could not be saved. Check the required fields and try again.");
      const wasEditing = editingId !== null;
      setNotice(wasEditing ? "Programme changes saved." : "Draft saved. Publish it when it is ready for listeners.");
      setEditingId(null);
      setForm(emptyForm(selectedDate));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Programme could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function readImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);
    setNotice(null);
    setImportPreview(null);
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error("The file must contain a JSON array of programmes.");
      setImportPreview(parsed.map((item) =>
        item && typeof item === "object" ? item as ImportPreviewItem : {},
      ));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The JSON file could not be read.");
    }
  }

  async function importProgrammes() {
    if (!importPreview?.length) return;
    setError(null);
    setNotice(null);
    setImporting(true);
    try {
      const response = await adminFetch("/api/admin/radio-calendar/programmes/import", {
        method: "POST",
        body: JSON.stringify(importPreview),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "The programmes could not be imported.");
      const imported = Array.isArray(data?.programmes) ? data.programmes as Programme[] : [];
      if (imported.length !== importPreview.length) throw new Error("The import response was incomplete; reload the calendar to verify its state.");
      const firstDate = imported[0]?.programmeDate?.slice(0, 10);
      setNotice(`${imported.length} programmes imported as drafts. Review and publish them when ready.`);
      setImportPreview(null);
      if (importInputRef.current) importInputRef.current.value = "";
      if (firstDate) {
        setStartDate(mondayFor(firstDate));
        setSelectedDate(firstDate);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The programmes could not be imported.");
    } finally {
      setImporting(false);
    }
  }

  async function changeStatus(programme: Programme, action: "publish" | "cancel") {
    setError(null);
    setNotice(null);
    if (action === "cancel" && !window.confirm(`Cancel “${programme.titleEn}”? It will no longer appear in the public schedule.`)) return;
    setWorkingId(programme.id);
    try {
      const response = await adminFetch(`/api/admin/radio-calendar/programmes/${programme.id}/${action}`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || `Programme could not be ${action === "publish" ? "published" : "cancelled"}.`);
      setNotice(action === "publish" ? "Programme published to the public calendar." : "Programme cancelled and removed from the public schedule.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Programme status could not be changed.");
    } finally {
      setWorkingId(null);
    }
  }

  const inputClass = "w-full rounded-lg border border-accent/20 bg-[hsl(var(--radio-ink))] px-3.5 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-accent focus:ring-2 focus:ring-accent/15";
  const labelClass = "grid gap-1.5 text-xs font-medium tracking-wide text-muted-foreground";

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-7 pb-10">
        <header className="relative overflow-hidden rounded-2xl border border-accent/15 bg-[linear-gradient(115deg,hsl(var(--primary)/.17),hsl(var(--card)/.52)_58%)] px-5 py-6 sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border border-accent/10" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="flex items-center gap-2 text-[0.66rem] uppercase tracking-[0.24em] text-[hsl(var(--radio-brass))]">
                <CalendarDays size={14} aria-hidden="true" /> Radio desk / Europe/Berlin
              </p>
              <h1 className="mt-2 font-heading text-3xl text-foreground sm:text-4xl">Programme calendar</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Schedule published literary radio programmes. This calendar is independent of stream playback and radio status.</p>
            </div>
            <div className="flex items-center gap-3">
              {(role === "admin" || role === "developer") && (
                <>
                  <input ref={importInputRef} className="sr-only" type="file" accept=".json,application/json" aria-label="Choose Radio Calendar JSON file" onChange={(event) => void readImportFile(event)} />
                  <button type="button" data-testid="choose-radio-calendar-json" onClick={() => importInputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-accent/25 bg-card/50 px-4 text-sm font-medium text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <Upload size={16} aria-hidden="true" /> Import JSON
                  </button>
                </>
              )}
              <div className="hidden h-14 w-14 place-items-center rounded-full border border-accent/25 bg-accent/5 text-accent sm:grid"><CalendarDays size={24} strokeWidth={1.4} aria-hidden="true" /></div>
            </div>
          </div>
        </header>

        {importPreview && (role === "admin" || role === "developer") && (
          <section data-testid="radio-calendar-import-preview" aria-labelledby="radio-calendar-import-heading" className="rounded-2xl border border-accent/20 bg-card/35 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="radio-calendar-import-heading" className="font-heading text-xl text-foreground">Review JSON import</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {importPreview.length} programme{importPreview.length === 1 ? "" : "s"} · Europe/Berlin. Import saves drafts only; nothing is published automatically.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" data-testid="import-radio-calendar-json" onClick={() => void importProgrammes()} disabled={importing || !importPreview.length} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50">
                  {importing ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
                  {importing ? "Importing…" : `Import ${importPreview.length} as drafts`}
                </button>
                <button type="button" onClick={() => { setImportPreview(null); if (importInputRef.current) importInputRef.current.value = ""; }} disabled={importing} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-accent/20 px-3 text-sm text-muted-foreground hover:bg-accent/5 disabled:opacity-50">
                  <X size={15} aria-hidden="true" /> Clear
                </button>
              </div>
            </div>
            {importPreview.length === 0 ? (
              <p className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">The JSON array is empty. Choose a file containing at least one programme.</p>
            ) : (
              <ol className="mt-4 max-h-72 divide-y divide-accent/10 overflow-y-auto rounded-xl border border-accent/10">
                {importPreview.map((item, index) => (
                  <li key={index} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 px-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="mr-2 text-xs text-muted-foreground">{String(item.programmeDate ?? "Invalid date")}</span>
                      <span className="font-medium text-foreground">{String(item.titleEn ?? "Missing English title")}</span>
                      <span className="ml-2 font-urdu text-accent" dir="rtl">{String(item.titleUr ?? "اردو عنوان موجود نہیں")}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {String(item.startTime ?? "??:??")}–{String(item.endTime ?? "??:??")} · {String(item.programmeType ?? "Unknown type")}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {role !== "admin" && role !== "developer" && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Only Admin and Developer accounts can manage the programme calendar.</p>
        )}
        {(error || notice) && (
          <div role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"} className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-accent/25 bg-accent/5 text-accent"}`}>
            {error ? <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}
            <span>{error || notice}</span>
          </div>
        )}

        <div className="grid items-start gap-7 xl:grid-cols-[minmax(19rem,.82fr)_minmax(0,1.35fr)]">
          <form onSubmit={save} className="rounded-2xl border border-accent/15 bg-card/35 p-5 sm:p-6" aria-labelledby="programme-form-title">
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-accent/10 pb-4">
              <div>
                <p className="text-[0.62rem] uppercase tracking-[0.2em] text-primary">{editingId ? "Update entry" : "New entry"}</p>
                <h2 id="programme-form-title" className="mt-1 font-heading text-xl text-foreground">{editingId ? "Edit programme" : "Create a programme"}</h2>
              </div>
              <span className="rounded-full border border-amber-400/25 bg-amber-400/5 px-2.5 py-1 text-[0.65rem] text-amber-200">Saved as draft</span>
            </div>

            <div className="space-y-4">
              <label className={labelClass}>Title (English)
                <input data-testid="programme-title-en" className={inputClass} required maxLength={200} value={form.titleEn} onChange={(event) => updateField("titleEn", event.target.value)} placeholder="A title listeners will recognize" />
              </label>
              <label className={labelClass}>عنوان پروگرام (اردو)
                <input data-testid="programme-title-ur" dir="rtl" className={`${inputClass} font-urdu text-base`} required maxLength={200} value={form.titleUr} onChange={(event) => updateField("titleUr", event.target.value)} placeholder="اردو عنوان" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className={`${labelClass} col-span-2 sm:col-span-1`}>Programme type
                  <select data-testid="programme-type" className={inputClass} value={form.programmeType} onChange={(event) => updateField("programmeType", event.target.value as ProgrammeType)}>
                    {programmeTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className={`${labelClass} col-span-2 sm:col-span-1`}>Date · Berlin
                  <input data-testid="programme-date" className={inputClass} required type="date" value={form.programmeDate.slice(0, 10)} onChange={(event) => updateField("programmeDate", event.target.value)} />
                </label>
                <label className={labelClass}>Start time
                  <input data-testid="programme-start-time" className={inputClass} required type="time" value={form.startTime.slice(0, 5)} onChange={(event) => updateField("startTime", event.target.value)} />
                </label>
                <label className={labelClass}>End time
                  <input data-testid="programme-end-time" className={inputClass} required type="time" value={form.endTime.slice(0, 5)} onChange={(event) => updateField("endTime", event.target.value)} />
                </label>
              </div>

              <p className="flex items-center gap-2 text-[0.68rem] text-[hsl(var(--radio-brass))]"><Clock3 size={13} aria-hidden="true" />Every date and time is interpreted in Europe/Berlin (CET/CEST, daylight saving).</p>

              <label className={labelClass}>Description (English)
                <textarea data-testid="programme-description-en" className={`${inputClass} min-h-24 resize-y leading-6`} maxLength={2000} value={fieldValue(form.descriptionEn)} onChange={(event) => updateField("descriptionEn", event.target.value)} />
              </label>
              <label className={labelClass}>تفصیل (اردو)
                <textarea data-testid="programme-description-ur" dir="rtl" className={`${inputClass} min-h-24 resize-y font-urdu text-sm leading-8`} maxLength={2000} value={fieldValue(form.descriptionUr)} onChange={(event) => updateField("descriptionUr", event.target.value)} />
              </label>
              <label className={labelClass}>External link <span className="font-normal tracking-normal text-muted-foreground/70">Optional</span>
                <input data-testid="programme-link" className={inputClass} type="url" maxLength={2000} value={fieldValue(form.externalLink)} onChange={(event) => updateField("externalLink", event.target.value)} placeholder="https://" />
              </label>
              <label className={labelClass}>Public note <span className="font-normal tracking-normal text-muted-foreground/70">Optional</span>
                <textarea data-testid="programme-public-note" className={`${inputClass} min-h-20 resize-y leading-6`} maxLength={500} value={fieldValue(form.publicNote)} onChange={(event) => updateField("publicNote", event.target.value)} />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-accent/10 pt-4">
              <button data-testid="save-programme" type="submit" disabled={saving || loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-[hsl(var(--radio-brass))] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                {saving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : editingId ? <Save size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                {saving ? "Saving…" : editingId ? "Save changes" : "Save draft"}
              </button>
              {editingId && <button type="button" data-testid="cancel-edit" onClick={resetForm} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-accent/20 px-4 text-sm text-muted-foreground hover:bg-accent/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X size={15} aria-hidden="true" />Discard edits</button>}
            </div>
          </form>

          <section aria-labelledby="admin-week-heading" className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-accent/15 bg-card/30 p-3">
              <button type="button" data-testid="admin-previous-week" aria-label="Previous week" onClick={() => setStartDate((date) => moveDate(date, -7))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ChevronLeft size={19} aria-hidden="true" /></button>
              <div className="text-center">
                <p className="text-[0.62rem] uppercase tracking-[0.2em] text-primary">Schedule / Europe/Berlin</p>
                <h2 id="admin-week-heading" aria-live="polite" className="mt-1 text-sm font-medium text-foreground">
                  {formatDate(startDate, { month: "short", day: "numeric" })} – {formatDate(moveDate(startDate, 6), { month: "short", day: "numeric", year: "numeric" })}
                </h2>
                <button
                  type="button"
                  data-testid="admin-this-week"
                  onClick={() => { const today = berlinToday(); setStartDate(mondayFor(today)); setSelectedDate(today); }}
                  className="mt-1 rounded-full px-2 py-1 text-[0.65rem] text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  This week
                </button>
              </div>
              <button type="button" data-testid="admin-next-week" aria-label="Next week" onClick={() => setStartDate((date) => moveDate(date, 7))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ChevronRight size={19} aria-hidden="true" /></button>
            </div>

            <nav aria-label="Choose a day to manage" className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {days.map((day) => {
                const count = programmes.filter((item) => item.programmeDate.slice(0, 10) === day).length;
                const active = day === selectedDate;
                return (
                  <button key={day} type="button" data-testid={`admin-day-${day}`} aria-pressed={active} onClick={() => setSelectedDate(day)} className={`min-h-[4rem] rounded-lg border px-2 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? "border-primary/50 bg-primary/15 text-foreground" : "border-accent/10 bg-card/25 text-muted-foreground hover:border-accent/25"}`}>
                    <span className="block text-[0.6rem] uppercase tracking-[0.12em]">{formatDate(day, { weekday: "short" })}</span>
                    <span className={`mt-0.5 block font-heading text-lg ${active ? "text-accent" : "text-foreground/80"}`}>{formatDate(day, { day: "numeric" })}</span>
                    <span className="block text-[0.58rem] text-muted-foreground">{count ? `${count} item${count === 1 ? "" : "s"}` : "—"}</span>
                  </button>
                );
              })}
            </nav>

            <h3 className="mb-3 font-heading text-lg text-foreground">{formatDate(selectedDate)}</h3>
            {loading && <div data-testid="admin-calendar-loading" role="status" className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-24 motion-safe:animate-pulse rounded-xl border border-accent/10 bg-card/35" />)}<span className="sr-only">Loading the weekly schedule…</span></div>}
            {!loading && loadError && (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5" role="alert">
                <p className="font-medium text-foreground">Calendar unavailable</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{loadError}</p>
                <button type="button" data-testid="admin-calendar-retry" onClick={() => void load()} className="mt-3 rounded-full border border-accent/30 px-4 py-2 text-sm text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Retry</button>
              </div>
            )}
            {!loading && !loadError && selectedDayProgrammes.length === 0 && (
              <div data-testid="admin-calendar-empty" className="grid min-h-48 place-items-center rounded-xl border border-dashed border-accent/20 bg-card/20 p-6 text-center">
                <div><CalendarDays size={23} className="mx-auto text-accent/60" aria-hidden="true" /><p className="mt-3 text-sm text-foreground">Nothing scheduled for this day.</p><p className="mt-1 text-xs text-muted-foreground">Create a programme draft using the form.</p></div>
              </div>
            )}
            {!loading && !loadError && selectedDayProgrammes.length > 0 && (
              <div className="space-y-3">
                {selectedDayProgrammes.map((programme) => (
                  <article key={programme.id} data-testid={`admin-programme-${programme.id}`} className="rounded-xl border border-accent/15 bg-card/35 p-4 transition-colors hover:border-accent/25 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-[hsl(var(--radio-brass))]">{programme.startTime.slice(0, 5)}–{programme.endTime.slice(0, 5)}</span>
                          <span className="rounded-full border border-accent/15 px-2 py-0.5 text-[0.62rem] text-muted-foreground">{programme.programmeType}</span>
                          <span data-testid={`status-${programme.id}`} className={`rounded-full border px-2 py-0.5 text-[0.62rem] capitalize ${statusClass(programme.status)}`}>{programme.status}</span>
                        </div>
                        <h4 className="mt-2 break-words font-heading text-lg text-foreground">{programme.titleEn}</h4>
                        <p className="mt-0.5 font-urdu text-base leading-[1.9] text-accent" dir="rtl">{programme.titleUr}</p>
                      </div>
                      <button type="button" data-testid={`edit-programme-${programme.id}`} aria-label={`Edit ${programme.titleEn}`} onClick={() => edit(programme)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-accent/20 px-3 text-xs text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Edit3 size={14} aria-hidden="true" />Edit</button>
                    </div>
                    {programme.descriptionEn && <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{programme.descriptionEn}</p>}
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-accent/10 pt-3">
                      {programme.status === "draft" && <button type="button" data-testid={`publish-programme-${programme.id}`} disabled={workingId === programme.id} onClick={() => void changeStatus(programme, "publish")} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 text-xs font-medium text-accent transition-colors hover:bg-accent/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{workingId === programme.id ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}Publish</button>}
                      {programme.status !== "cancelled" && <button type="button" data-testid={`cancel-programme-${programme.id}`} disabled={workingId === programme.id} onClick={() => void changeStatus(programme, "cancel")} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-destructive/25 px-3 text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive">{workingId === programme.id ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <X size={13} aria-hidden="true" />}Cancel programme</button>}
                      {(programme.status === "cancelled") && <span className="py-2 text-xs text-muted-foreground">Cancelled entries remain in the admin record.</span>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
