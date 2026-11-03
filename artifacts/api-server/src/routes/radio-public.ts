import { Router, type IRouter, type Response } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { radioPlaylistsTable, radioSchedulesTable, radioSettingsTable } from "@workspace/db/schema";
import {
  DEFAULT_RADIO_TIMEZONE,
  findScheduleOccurrence,
} from "../lib/radioSchedule.js";

const router: IRouter = Router();
const DUBAI_TIMEZONE = "Asia/Dubai";

function dubaiDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBAI_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dateWeekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function publicOccurrence(row: typeof radioSchedulesTable.$inferSelect, date: string) {
  if (!row.programmeType || !row.titleEn || !row.titleUr) return null;
  if (row.scheduleType === "ONE_TIME" && row.scheduledDate !== date) return null;
  if (row.scheduleType === "WEEKLY") {
    let days: unknown;
    try { days = JSON.parse(row.daysOfWeek); } catch { return null; }
    if (!Array.isArray(days) || !days.includes(dateWeekday(date))) return null;
  }
  const [year, month, day] = date.split("-").map(Number);
  const [startHour, startMinute] = row.startLocalTime.split(":").map(Number);
  const [endHour, endMinute] = row.endLocalTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  if (startMinutes === endMinutes) return null;
  const start = new Date(Date.UTC(year, month - 1, day, startHour, startMinute) - 4 * 60 * 60 * 1000);
  const duration = (endMinutes - startMinutes + 1440) % 1440 || 1440;
  const end = new Date(start.getTime() + duration * 60_000);
  return {
    id: row.id,
    titleEn: row.titleEn,
    titleUr: row.titleUr,
    descriptionEn: row.descriptionEn,
    descriptionUr: row.descriptionUr,
    programmeType: row.programmeType,
    poetName: row.poetName,
    externalUrl: row.externalUrl,
    thumbnailUrl: row.thumbnailUrl,
    publicNote: row.publicNote,
    scheduleType: row.scheduleType,
    date,
    startLocalTime: row.startLocalTime,
    endLocalTime: row.endLocalTime,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    timezone: DUBAI_TIMEZONE,
  };
}

async function publicOccurrences(startDate: string, dayCount: number) {
  const rows = await db.select().from(radioSchedulesTable).where(eq(radioSchedulesTable.status, "published"));
  return Array.from({ length: dayCount }, (_, offset) => shiftDate(startDate, offset))
    .flatMap((date) => rows.map((row) => publicOccurrence(row, date)).filter((item) => item !== null))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function noScheduleCache(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
}

const PUBLIC_SETTING_KEYS = [
  "station_name",
  "enabled",
  "public_stream_url",
  "stream_hostname",
  "stream_path",
  "stream_protocol",
  "stream_format",
  "stream_bitrate_kbps",
  "status_message",
  "schedule_timezone",
  "now_playing_title",
  "now_playing_artist",
  "now_playing_program",
  "now_playing_content_type",
  "now_playing_artwork_url",
  "now_playing_updated_at",
] as const;

router.get("/schedule/today", async (_req, res): Promise<void> => {
  noScheduleCache(res);
  const date = dubaiDate();
  res.json({ date, timezone: DUBAI_TIMEZONE, programmes: await publicOccurrences(date, 1) });
});

router.get("/schedule/date/:date", async (req, res): Promise<void> => {
  noScheduleCache(res);
  const date = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;
  if (!validCalendarDate(date)) {
    res.status(400).json({ message: "Date must use YYYY-MM-DD format" }); return;
  }
  res.json({ date, timezone: DUBAI_TIMEZONE, programmes: await publicOccurrences(date, 1) });
});

router.get("/schedule/weekly", async (req, res): Promise<void> => {
  noScheduleCache(res);
  const raw = typeof req.query.startDate === "string" ? req.query.startDate : dubaiDate();
  if (!validCalendarDate(raw)) {
    res.status(400).json({ message: "startDate must use YYYY-MM-DD format" }); return;
  }
  res.json({ startDate: raw, timezone: DUBAI_TIMEZONE, programmes: await publicOccurrences(raw, 7) });
});

router.get("/schedule/current", async (_req, res): Promise<void> => {
  noScheduleCache(res);
  const now = new Date();
  const items = await publicOccurrences(shiftDate(dubaiDate(now), -1), 9);
  const current = items.find((item) => Date.parse(item.startsAt) <= now.getTime() && Date.parse(item.endsAt) > now.getTime()) ?? null;
  res.json({ timezone: DUBAI_TIMEZONE, currentlyScheduledProgramme: current });
});

router.get("/schedule/next", async (_req, res): Promise<void> => {
  noScheduleCache(res);
  const now = new Date();
  const items = await publicOccurrences(dubaiDate(now), 15);
  const next = items.find((item) => Date.parse(item.startsAt) > now.getTime()) ?? null;
  res.json({ timezone: DUBAI_TIMEZONE, nextScheduledProgramme: next });
});

router.get("/schedule/upcoming", async (req, res): Promise<void> => {
  noScheduleCache(res);
  const rawLimit = Number(req.query.limit ?? 20);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
    res.status(400).json({ message: "limit must be an integer between 1 and 100" }); return;
  }
  const now = new Date();
  const items = await publicOccurrences(dubaiDate(now), 15);
  res.json({
    timezone: DUBAI_TIMEZONE,
    programmes: items.filter((item) => Date.parse(item.startsAt) > now.getTime()).slice(0, rawLimit),
  });
});

function settingValue(settings: Record<string, string>, key: string): string | null {
  const value = settings[key]?.trim();
  return value || null;
}

function parseOptionalNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPrivateHostname(hostname: string): boolean {
  return hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^127\./.test(hostname);
}

function safePublicHostname(value: string | null): string | null {
  if (!value || !/^[a-z0-9.-]+$/i.test(value)) return null;
  const hostname = value.toLowerCase();
  return isPrivateHostname(hostname) ? null : value;
}

function safePublicUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    return isPrivateHostname(hostname) ? null : url.toString();
  } catch {
    return null;
  }
}

router.get("/status", async (req, res) => {
  try {
    const rows = await db
      .select({ key: radioSettingsTable.key, value: radioSettingsTable.value })
      .from(radioSettingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      if ((PUBLIC_SETTING_KEYS as readonly string[]).includes(row.key)) settings[row.key] = row.value;
    }

    const enabled = settings.enabled === "true";
    const streamUrl = enabled ? safePublicUrl(settingValue(settings, "public_stream_url")) : null;
    const artworkUrl = safePublicUrl(settingValue(settings, "now_playing_artwork_url"));
    const hasNowPlaying = Boolean(streamUrl && settingValue(settings, "now_playing_title"));
    const nowPlaying = hasNowPlaying
      ? {
          title: settingValue(settings, "now_playing_title"),
          artist: settingValue(settings, "now_playing_artist"),
          program: settingValue(settings, "now_playing_program"),
          contentType: settingValue(settings, "now_playing_content_type"),
          artworkUrl,
          updatedAt: settingValue(settings, "now_playing_updated_at"),
        }
      : null;

    const now = new Date();
    const schedules = await db
      .select({
        id: radioSchedulesTable.id,
        name: radioSchedulesTable.name,
        timezone: radioSchedulesTable.timezone,
        daysOfWeek: radioSchedulesTable.daysOfWeek,
        startLocalTime: radioSchedulesTable.startLocalTime,
        endLocalTime: radioSchedulesTable.endLocalTime,
        effectiveFrom: radioSchedulesTable.effectiveFrom,
        effectiveUntil: radioSchedulesTable.effectiveUntil,
        programName: radioSchedulesTable.programName,
        attribution: radioSchedulesTable.attribution,
        priority: radioSchedulesTable.priority,
      })
      .from(radioSchedulesTable)
      .innerJoin(radioPlaylistsTable, eq(radioPlaylistsTable.id, radioSchedulesTable.playlistId))
      .where(and(
        eq(radioSchedulesTable.status, "active"),
        eq(radioPlaylistsTable.status, "active"),
      ))
      .orderBy(asc(radioSchedulesTable.startLocalTime), asc(radioSchedulesTable.name));

    const scheduledOccurrences = schedules
      .map((schedule) => {
        const occurrence = findScheduleOccurrence({
          timezone: schedule.timezone,
          daysOfWeek: schedule.daysOfWeek,
          startLocalTime: schedule.startLocalTime,
          endLocalTime: schedule.endLocalTime,
          effectiveFrom: schedule.effectiveFrom,
          effectiveUntil: schedule.effectiveUntil,
        }, now);
        return occurrence ? {
          ...schedule,
          scheduleState: occurrence.state,
          occurrenceStart: occurrence.startsAt.toISOString(),
          occurrenceEnd: occurrence.endsAt.toISOString(),
          occurrenceLocalDate: occurrence.localDate,
        } : null;
      })
      .filter((schedule): schedule is NonNullable<typeof schedule> => Boolean(schedule))
      .sort((left, right) => {
        const stateOrder = left.scheduleState === right.scheduleState
          ? 0
          : left.scheduleState === "current" ? -1 : 1;
        if (stateOrder !== 0) return stateOrder;
        const occurrenceOrder = left.occurrenceStart.localeCompare(right.occurrenceStart);
        if (occurrenceOrder !== 0) return occurrenceOrder;
        return right.priority - left.priority;
      });

    res.json({
      station: {
        name: settingValue(settings, "station_name") ?? "Radio Suruur FM",
        hostname: safePublicHostname(settingValue(settings, "stream_hostname")) ?? "radio.suruureman.com",
        path: settingValue(settings, "stream_path"),
        protocol: settingValue(settings, "stream_protocol") ?? "https",
        format: settingValue(settings, "stream_format") ?? "MP3",
        bitrateKbps: parseOptionalNumber(settingValue(settings, "stream_bitrate_kbps")) ?? 96,
        timezone: settingValue(settings, "schedule_timezone") ?? DEFAULT_RADIO_TIMEZONE,
      },
      // `available` means a usable public stream configuration exists. It is
      // not a provider/runtime health check and must not be presented as live.
      status: streamUrl ? "available" : "offline",
      available: Boolean(streamUrl),
      streamUrl,
      message: settingValue(settings, "status_message") ?? "Radio stream is not configured.",
      nowPlaying,
      schedules: scheduledOccurrences,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to read public Radio status");
    res.status(500).json({ message: "Radio information could not be loaded" });
  }
});

export default router;