import { Router, type IRouter, type RequestHandler } from "express";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, radioSchedulesTable, radioPlaylistsTable } from "@workspace/db";
import { RADIO_PROGRAMME_TYPES, RADIO_SCHEDULE_TYPES } from "@workspace/db/schema";
import { requireAdmin, type AdminPayload } from "../middlewares/adminAuth.js";
import { radioAdminRateLimit } from "../lib/rateLimit.js";
import { getRadioAdminPermissions } from "../lib/config.js";
import { writeAuditLog } from "../lib/audit.js";
import { DEFAULT_RADIO_TIMEZONE } from "../lib/radioSchedule.js";

const router: IRouter = Router();
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const id = z.number().int().positive().nullable().optional();
const publicUrl = z.string().url().max(2000).refine((value) => {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch { return false; }
});
const programmeSchema = z.object({
  titleEn: z.string().trim().min(1).max(200),
  titleUr: z.string().trim().min(1).max(200),
  descriptionEn: z.string().trim().max(1000).nullable().optional(),
  descriptionUr: z.string().trim().max(1000).nullable().optional(),
  programmeType: z.enum(RADIO_PROGRAMME_TYPES),
  poetName: z.string().trim().max(200).nullable().optional(),
  playlistId: id,
  externalUrl: publicUrl.nullable().optional(),
  thumbnailUrl: publicUrl.nullable().optional(),
  scheduleType: z.enum(RADIO_SCHEDULE_TYPES),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  startLocalTime: time,
  endLocalTime: time,
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }).nullable().optional(),
  timezone: z.string().max(100).default(DEFAULT_RADIO_TIMEZONE),
  publicNote: z.string().trim().max(500).nullable().optional(),
});

function actorId(req: Parameters<RequestHandler>[0]): number | null {
  return ((req as any).adminUser as AdminPayload).userId ?? null;
}

function canManage(req: Parameters<RequestHandler>[0]): boolean {
  const actor = (req as any).adminUser as AdminPayload;
  return actor.role === "developer" ||
    (actor.role === "admin" && getRadioAdminPermissions().has("radio.schedules.manage"));
}

router.use(requireAdmin, radioAdminRateLimit);

function validationMessage(body: z.infer<typeof programmeSchema>): string | null {
  if (body.timezone !== DEFAULT_RADIO_TIMEZONE) return "Programme times must use Asia/Dubai.";
  if (body.startLocalTime === body.endLocalTime) return "Start and end times must be different.";
  if (body.scheduleType === "WEEKLY" &&
      (!body.daysOfWeek?.length || new Set(body.daysOfWeek).size !== body.daysOfWeek.length || body.scheduledDate)) {
    return "Weekly programmes need unique weekdays and no specific date.";
  }
  if (body.scheduleType === "ONE_TIME" && (!body.scheduledDate || body.daysOfWeek?.length)) {
    return "One-time programmes need a date and no recurring weekdays.";
  }
  return null;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function conflictsWith(candidate: z.infer<typeof programmeSchema>, existing: typeof radioSchedulesTable.$inferSelect): boolean {
  if (existing.status !== "published" || !existing.programmeType || existing.timezone !== DEFAULT_RADIO_TIMEZONE) return false;
  const candidateDays = candidate.daysOfWeek ?? [];
  const existingDays = (() => {
    try { return JSON.parse(existing.daysOfWeek) as number[]; } catch { return []; }
  })();
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const duration = (start: number, end: number) => ((end - start + 1440) % 1440) || 1440;
  const overlapsOn = (day: number, otherDay: number, aStart: number, aDuration: number, bStart: number, bDuration: number) => {
    for (const shift of [-10080, 0, 10080]) {
      const a = day * 1440 + aStart + shift;
      const b = otherDay * 1440 + bStart;
      if (rangesOverlap(a, a + aDuration, b, b + bDuration)) return true;
    }
    return false;
  };
  const aStart = minutes(candidate.startLocalTime);
  const bStart = minutes(existing.startLocalTime);
  const aDuration = duration(aStart, minutes(candidate.endLocalTime));
  const bDuration = duration(bStart, minutes(existing.endLocalTime));
  if (candidate.scheduleType === "ONE_TIME" && existing.scheduleType === "ONE_TIME") {
    if (candidate.scheduledDate !== existing.scheduledDate) return false;
    return rangesOverlap(aStart, aStart + aDuration, bStart, bStart + bDuration);
  }
  const weekdays = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
  const oneTimeWeeklyOverlap = (date: string, oneStart: number, oneDuration: number, days: number[], weeklyStart: number, weeklyDuration: number) => {
    const day = weekdays(date);
    return [0, -1].some((offset) => {
      const recurringDay = (day + offset + 7) % 7;
      if (!days.includes(recurringDay)) return false;
      const weeklyOccurrenceStart = offset * 1440 + weeklyStart;
      return rangesOverlap(oneStart, oneStart + oneDuration, weeklyOccurrenceStart, weeklyOccurrenceStart + weeklyDuration);
    });
  };
  if (candidate.scheduleType === "ONE_TIME") {
    return oneTimeWeeklyOverlap(candidate.scheduledDate!, aStart, aDuration, existingDays, bStart, bDuration);
  }
  if (existing.scheduleType === "ONE_TIME") {
    return oneTimeWeeklyOverlap(existing.scheduledDate ?? "", bStart, bDuration, candidateDays, aStart, aDuration);
  }
  return candidateDays.some((day) => existingDays.some((otherDay) =>
    overlapsOn(day, otherDay, aStart, aDuration, bStart, bDuration)));
}

async function conflictIds(candidate: z.infer<typeof programmeSchema>, omitId?: number): Promise<number[]> {
  const rows = await db.select().from(radioSchedulesTable)
    .where(omitId
      ? and(eq(radioSchedulesTable.status, "published"), ne(radioSchedulesTable.id, omitId))
      : eq(radioSchedulesTable.status, "published"));
  return rows.filter((row) => conflictsWith(candidate, row)).map((row) => row.id);
}

router.get("/programmes", async (req, res): Promise<void> => {
  if (!canManage(req)) { res.status(403).json({ message: "Radio permission is not granted" }); return; }
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const rawStatus = typeof req.query.status === "string" ? req.query.status.toLowerCase() : undefined;
  if (rawStatus && !["draft", "published", "cancelled"].includes(rawStatus)) {
    res.status(400).json({ message: "Invalid status filter" }); return;
  }
  const status = rawStatus as "draft" | "published" | "cancelled" | undefined;
  const dateFilter = typeof req.query.date === "string" ? req.query.date : undefined;
  if (dateFilter && !validDate(dateFilter)) { res.status(400).json({ message: "date must use a valid YYYY-MM-DD date" }); return; }
  let rows = await db.select().from(radioSchedulesTable)
    .where(status ? eq(radioSchedulesTable.status, status) : undefined)
    .orderBy(desc(radioSchedulesTable.scheduledDate), desc(radioSchedulesTable.id));
  if (dateFilter) rows = rows.filter((row) => matchesDate(row, dateFilter));
  res.json({ programmes: rows.slice(offset, offset + limit), limit, offset, total: rows.length });
});

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function matchesDate(row: typeof radioSchedulesTable.$inferSelect, date: string): boolean {
  if (row.scheduleType === "ONE_TIME") return row.scheduledDate === date;
  try {
    const days = JSON.parse(row.daysOfWeek) as unknown;
    const [year, month, day] = date.split("-").map(Number);
    return Array.isArray(days) && days.includes(new Date(Date.UTC(year, month - 1, day)).getUTCDay());
  } catch { return false; }
}

router.get("/programmes/schedule/weekly", async (req, res): Promise<void> => {
  if (!canManage(req)) { res.status(403).json({ message: "Radio permission is not granted" }); return; }
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : new Date().toISOString().slice(0, 10);
  if (!validDate(startDate)) { res.status(400).json({ message: "startDate must be a valid YYYY-MM-DD date" }); return; }
  const rows = await db.select().from(radioSchedulesTable).orderBy(desc(radioSchedulesTable.scheduledDate));
  const days = Array.from({ length: 7 }, (_, index) => {
    const [year, month, day] = startDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + index)).toISOString().slice(0, 10);
    return { date, programmes: rows.filter((row) => matchesDate(row, date)) };
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ timezone: DEFAULT_RADIO_TIMEZONE, startDate, days });
});

router.get("/programmes/schedule/date/:date", async (req, res): Promise<void> => {
  if (!canManage(req)) { res.status(403).json({ message: "Radio permission is not granted" }); return; }
  const date = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;
  if (!validDate(date)) { res.status(400).json({ message: "date must be a valid YYYY-MM-DD date" }); return; }
  const rows = await db.select().from(radioSchedulesTable).where(eq(radioSchedulesTable.status, "published"));
  res.setHeader("Cache-Control", "no-store");
  res.json({ date, timezone: DEFAULT_RADIO_TIMEZONE, programmes: rows.filter((row) => matchesDate(row, date)) });
});

router.get("/programmes/:id", async (req, res): Promise<void> => {
  if (!canManage(req)) { res.status(403).json({ message: "Radio permission is not granted" }); return; }
  const programmeId = Number(req.params.id);
  if (!Number.isInteger(programmeId) || programmeId < 1) { res.status(400).json({ message: "Invalid programme ID" }); return; }
  const [programme] = await db.select().from(radioSchedulesTable).where(eq(radioSchedulesTable.id, programmeId));
  if (!programme || !programme.programmeType) { res.status(404).json({ message: "Programme not found" }); return; }
  res.json({ programme });
});

router.post("/programmes/validate", async (req, res): Promise<void> => {
  if (!canManage(req)) { res.status(403).json({ message: "Radio permission is not granted" }); return; }
  const parsed = programmeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid programme data" }); return; }
  const message = validationMessage(parsed.data);
  if (message) { res.status(400).json({ message }); return; }
  const conflicts = await conflictIds(parsed.data);
  res.json({ valid: conflicts.length === 0, conflicts });
});

router.post("/programmes", async (req, res): Promise<void> => {
  if (!canManage(req)) { res.status(403).json({ message: "Radio permission is not granted" }); return; }
  const parsed = programmeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid programme data" }); return; }
  const body = parsed.data;
  const message = validationMessage(body);
  if (message) { res.status(400).json({ message }); return; }
  if (body.playlistId) {
    const [playlist] = await db.select({ id: radioPlaylistsTable.id }).from(radioPlaylistsTable).where(eq(radioPlaylistsTable.id, body.playlistId));
    if (!playlist) { res.status(400).json({ message: "Playlist not found" }); return; }
  }
  const [programme] = await db.insert(radioSchedulesTable).values({
    name: body.titleEn, programName: body.titleEn, titleEn: body.titleEn, titleUr: body.titleUr,
    descriptionEn: body.descriptionEn ?? null, descriptionUr: body.descriptionUr ?? null,
    programmeType: body.programmeType, poetName: body.poetName ?? null, playlistId: body.playlistId ?? null,
    externalUrl: body.externalUrl ?? null, thumbnailUrl: body.thumbnailUrl ?? null,
    scheduleType: body.scheduleType, daysOfWeek: JSON.stringify(body.daysOfWeek ?? []),
    startLocalTime: body.startLocalTime, endLocalTime: body.endLocalTime,
    scheduledDate: body.scheduledDate ?? null, timezone: body.timezone, publicNote: body.publicNote ?? null,
    status: "draft", createdByUserId: actorId(req), updatedByUserId: actorId(req),
  }).returning();
  await writeAuditLog(actorId(req), "radio_programme_created", "radio_schedule", programme!.id);
  res.status(201).json({ programme });
});

router.put("/programmes/:id", async (req, res): Promise<void> => {
  if (!canManage(req)) { res.status(403).json({ message: "Radio permission is not granted" }); return; }
  const programmeId = Number(req.params.id);
  if (!Number.isInteger(programmeId) || programmeId < 1) { res.status(400).json({ message: "Invalid programme ID" }); return; }
  const parsed = programmeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid programme data" }); return; }
  const body = parsed.data;
  const message = validationMessage(body);
  if (message) { res.status(400).json({ message }); return; }
  if (body.playlistId) {
    const [playlist] = await db.select({ id: radioPlaylistsTable.id }).from(radioPlaylistsTable).where(eq(radioPlaylistsTable.id, body.playlistId));
    if (!playlist) { res.status(400).json({ message: "Playlist not found" }); return; }
  }
  const values = {
    name: body.titleEn, programName: body.titleEn, titleEn: body.titleEn, titleUr: body.titleUr,
    descriptionEn: body.descriptionEn ?? null, descriptionUr: body.descriptionUr ?? null,
    programmeType: body.programmeType, poetName: body.poetName ?? null, playlistId: body.playlistId ?? null,
    externalUrl: body.externalUrl ?? null, thumbnailUrl: body.thumbnailUrl ?? null,
    scheduleType: body.scheduleType, daysOfWeek: JSON.stringify(body.daysOfWeek ?? []),
    startLocalTime: body.startLocalTime, endLocalTime: body.endLocalTime,
    scheduledDate: body.scheduledDate ?? null, timezone: body.timezone, publicNote: body.publicNote ?? null,
    updatedByUserId: actorId(req), updatedAt: new Date(),
  };
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(730114209)`);
    const [current] = await tx.select().from(radioSchedulesTable).where(eq(radioSchedulesTable.id, programmeId));
    if (!current || !current.programmeType) return { missing: true as const };
    if (current.status === "published") {
      const rows = await tx.select().from(radioSchedulesTable).where(eq(radioSchedulesTable.status, "published"));
      const conflicts = rows.filter((other) => other.id !== programmeId && conflictsWith(body, other)).map((other) => other.id);
      if (conflicts.length) return { conflicts } as const;
    }
    const [programme] = await tx.update(radioSchedulesTable).set(values)
      .where(eq(radioSchedulesTable.id, programmeId)).returning();
    return { programme };
  });
  if ("missing" in result) { res.status(404).json({ message: "Programme not found" }); return; }
  if ("conflicts" in result) { res.status(409).json({ message: "Programme overlaps an existing published programme", conflicts: result.conflicts }); return; }
  await writeAuditLog(actorId(req), "radio_programme_updated", "radio_schedule", programmeId);
  res.json({ programme: result.programme });
});

async function setStatus(req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], status: "published" | "draft" | "cancelled"): Promise<void> {
  if (!canManage(req)) { res.status(403).json({ message: "Radio permission is not granted" }); return; }
  const programmeId = Number(req.params.id);
  if (!Number.isInteger(programmeId) || programmeId < 1) { res.status(400).json({ message: "Invalid programme ID" }); return; }
  const result = await db.transaction(async (tx) => {
    // Serialize publish checks so simultaneous Admin requests cannot publish an overlap.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(730114209)`);
    const [row] = await tx.select().from(radioSchedulesTable).where(eq(radioSchedulesTable.id, programmeId));
    if (!row || !row.programmeType) return { missing: true as const };
    if (status === "published") {
      let days: unknown;
      try { days = JSON.parse(row.daysOfWeek); } catch { days = null; }
      const body = programmeSchema.safeParse({
        titleEn: row.titleEn, titleUr: row.titleUr, descriptionEn: row.descriptionEn, descriptionUr: row.descriptionUr,
        programmeType: row.programmeType, poetName: row.poetName, playlistId: row.playlistId,
        externalUrl: row.externalUrl, thumbnailUrl: row.thumbnailUrl, scheduleType: row.scheduleType,
        daysOfWeek: days, startLocalTime: row.startLocalTime, endLocalTime: row.endLocalTime,
        scheduledDate: row.scheduledDate, timezone: row.timezone, publicNote: row.publicNote,
      });
      if (!body.success || validationMessage(body.data)) return { invalid: true as const };
      const rows = await tx.select().from(radioSchedulesTable).where(eq(radioSchedulesTable.status, "published"));
      const conflicts = rows.filter((other) => other.id !== programmeId && conflictsWith(body.data, other)).map((other) => other.id);
      if (conflicts.length) return { conflicts } as const;
    }
    const [programme] = await tx.update(radioSchedulesTable)
      .set({ status, updatedByUserId: actorId(req), updatedAt: new Date() })
      .where(eq(radioSchedulesTable.id, programmeId)).returning();
    return { programme };
  });
  if ("missing" in result) { res.status(404).json({ message: "Programme not found" }); return; }
  if ("invalid" in result) { res.status(400).json({ message: "Programme data must be corrected before publishing" }); return; }
  if ("conflicts" in result) { res.status(409).json({ message: "Programme overlaps an existing published programme", conflicts: result.conflicts }); return; }
  const programme = result.programme!;
  await writeAuditLog(actorId(req), `radio_programme_${status}`, "radio_schedule", programmeId);
  res.json({ programme });
}

router.post("/programmes/:id/publish", async (req, res): Promise<void> => setStatus(req, res, "published"));
router.post("/programmes/:id/unpublish", async (req, res): Promise<void> => setStatus(req, res, "draft"));
router.post("/programmes/:id/cancel", async (req, res): Promise<void> => setStatus(req, res, "cancelled"));

export default router;
