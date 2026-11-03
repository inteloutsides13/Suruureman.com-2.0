import { z } from "zod";

export const RADIO_CALENDAR_TIMEZONE = "Europe/Berlin";
export const RADIO_CALENDAR_TYPES = [
  "Auto DJ",
  "Live Radio",
  "Recorded Show",
  "Poetry Hour",
  "TikTok Live",
  "Announcement/Break",
] as const;
export const RADIO_CALENDAR_STATUSES = ["draft", "published", "cancelled"] as const;

const safeUrl = z.string().trim().url().max(2000).refine((value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
});

const calendarTime = z.string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/)
  .transform((value) => value.slice(0, 5));

export const radioCalendarInput = z.object({
  titleEn: z.string().trim().min(1).max(200),
  titleUr: z.string().trim().min(1).max(200),
  descriptionEn: z.string().trim().max(2000).nullable(),
  descriptionUr: z.string().trim().max(2000).nullable(),
  programmeType: z.enum(RADIO_CALENDAR_TYPES),
  programmeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }),
  startTime: calendarTime,
  endTime: calendarTime,
  timezone: z.literal(RADIO_CALENDAR_TIMEZONE),
  externalLink: safeUrl.nullable(),
  publicNote: z.string().trim().max(500).nullable(),
}).strict().refine((value) => value.startTime < value.endTime, {
  message: "Start time must be earlier than end time for a same-day programme.",
  path: ["endTime"],
});

export type RadioCalendarInput = z.infer<typeof radioCalendarInput>;

export function calendarWeekRange(startDate: string): { start: string; end: string } | null {
  const date = new Date(`${startDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== startDate) return null;
  date.setUTCDate(date.getUTCDate() + 7);
  return { start: startDate, end: date.toISOString().slice(0, 10) };
}

export function currentCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RADIO_CALENDAR_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

