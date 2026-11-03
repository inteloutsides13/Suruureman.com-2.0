export const DEFAULT_RADIO_TIMEZONE = "Asia/Dubai";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type ScheduleValidationInput = {
  timezone: unknown;
  daysOfWeek: unknown;
  startLocalTime: unknown;
  endLocalTime: unknown;
  effectiveFrom?: Date | null | "invalid";
  effectiveUntil?: Date | null | "invalid";
};

export type ScheduleOccurrenceInput = {
  timezone: string;
  daysOfWeek: string | number[];
  startLocalTime: string;
  endLocalTime: string;
  effectiveFrom?: Date | string | null;
  effectiveUntil?: Date | string | null;
};

export type ScheduleOccurrence = {
  state: "current" | "upcoming";
  startsAt: Date;
  endsAt: Date;
  localDate: string;
};

const timezonePartsCache = new Map<string, Intl.DateTimeFormat>();

function timezoneFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = timezonePartsCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    timezonePartsCache.set(timezone, formatter);
  }
  return formatter;
}

function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) return false;
  try {
    timezoneFormatter(value).format();
    return true;
  } catch {
    return false;
  }
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

function isValidDays(value: unknown): value is number[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    new Set(value).size === value.length &&
    value.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function scheduleValidationError(input: ScheduleValidationInput): string | null {
  if (!isValidTimezone(input.timezone)) return "Schedule timezone must be a valid IANA timezone.";
  if (!isValidTime(input.startLocalTime) || !isValidTime(input.endLocalTime)) {
    return "Schedule times must use HH:mm format.";
  }
  if (minutesFromTime(input.startLocalTime) === minutesFromTime(input.endLocalTime)) {
    return "Schedule start and end times must be different.";
  }
  if (!isValidDays(input.daysOfWeek)) {
    return "Schedule days must contain unique values from 0 (Sunday) through 6 (Saturday).";
  }
  if (input.effectiveFrom === "invalid" || input.effectiveUntil === "invalid") {
    return "Schedule effective dates must be valid dates.";
  }
  if (input.effectiveFrom && input.effectiveUntil && input.effectiveFrom > input.effectiveUntil) {
    return "Schedule effective-from date must not be after the effective-until date.";
  }
  return null;
}

function parseDays(value: string | number[]): number[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((day): day is number => Number.isInteger(day)) : [];
  } catch {
    return [];
  }
}

function datePartsFor(instant: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = timezoneFormatter(timezone).formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function dateKey(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function localDateTimeToUtc(localDate: string, localTime: string, timezone: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = new Date(naiveUtc);

  // Iterating once after applying the zone offset handles ordinary and DST
  // transitions without relying on the server's local timezone.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = datePartsFor(guess, timezone);
    const representedUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const offset = representedUtc - guess.getTime();
    guess = new Date(naiveUtc - offset);
  }
  return guess;
}

function addDays(year: number, month: number, day: number, days: number): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function findScheduleOccurrence(
  schedule: ScheduleOccurrenceInput,
  now: Date,
  horizonDays = 7,
): ScheduleOccurrence | null {
  if (!isValidTimezone(schedule.timezone) || !isValidTime(schedule.startLocalTime) || !isValidTime(schedule.endLocalTime)) {
    return null;
  }
  const days = parseDays(schedule.daysOfWeek);
  if (!days.length || minutesFromTime(schedule.startLocalTime) === minutesFromTime(schedule.endLocalTime)) {
    return null;
  }

  const effectiveFrom = asDate(schedule.effectiveFrom);
  const effectiveUntil = asDate(schedule.effectiveUntil);
  const localNow = datePartsFor(now, schedule.timezone);

  for (let dayOffset = -1; dayOffset <= horizonDays; dayOffset += 1) {
    const candidateDate = addDays(localNow.year, localNow.month, localNow.day, dayOffset);
    const candidateDay = new Date(Date.UTC(candidateDate.year, candidateDate.month - 1, candidateDate.day)).getUTCDay();
    if (!days.includes(candidateDay)) continue;

    const localDate = dateKey(candidateDate.year, candidateDate.month, candidateDate.day);
    const startsAt = localDateTimeToUtc(localDate, schedule.startLocalTime, schedule.timezone);
    const overnight = minutesFromTime(schedule.endLocalTime) <= minutesFromTime(schedule.startLocalTime);
    const nextDate = addDays(candidateDate.year, candidateDate.month, candidateDate.day, 1);
    const endDate = overnight ? dateKey(nextDate.year, nextDate.month, nextDate.day) : localDate;
    const endsAt = localDateTimeToUtc(endDate, schedule.endLocalTime, schedule.timezone);
    if (endsAt <= startsAt || endsAt <= now) continue;
    if (effectiveFrom && endsAt <= effectiveFrom) continue;
    if (effectiveUntil && startsAt > effectiveUntil) continue;

    return {
      state: startsAt <= now ? "current" : "upcoming",
      startsAt,
      endsAt,
      localDate,
    };
  }
  return null;
}