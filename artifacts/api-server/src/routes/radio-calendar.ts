import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAdmin, type AdminPayload } from "../middlewares/adminAuth.js";
import {
  calendarWeekRange,
  currentCalendarDate,
  RADIO_CALENDAR_TIMEZONE,
  radioCalendarInput,
  RADIO_CALENDAR_STATUSES,
} from "../lib/radioCalendar.js";
import {
  importRadioCalendarProgrammes,
  parseRadioCalendarImport,
  RadioCalendarImportError,
} from "../lib/radioCalendarImport.js";

const router: IRouter = Router();
const adminRouter: IRouter = Router();
const table = "radio_calendar_programmes";
const columns = `id, title_en AS "titleEn", title_ur AS "titleUr",
  description_en AS "descriptionEn", description_ur AS "descriptionUr",
  programme_type AS "programmeType", programme_date AS "programmeDate",
  start_time AS "startTime", end_time AS "endTime", timezone,
  external_link AS "externalLink", public_note AS "publicNote", status,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

function weekFromQuery(value: unknown) {
  const startDate = typeof value === "string" ? value : currentCalendarDate();
  const range = calendarWeekRange(startDate);
  return range ? { ...range, startDate } : null;
}

function requestError(req: Parameters<import("express").RequestHandler>[0], res: Parameters<import("express").RequestHandler>[1]) {
  req.log.error("Radio calendar database request failed.");
  res.status(503).json({ message: "The Radio Calendar is currently unavailable." });
}

router.get("/radio-calendar/programmes", async (req, res): Promise<void> => {
  const range = weekFromQuery(req.query.startDate);
  if (!range) { res.status(400).json({ message: "startDate must be a valid YYYY-MM-DD date." }); return; }
  try {
    const result = await pool.query(
      `SELECT ${columns} FROM ${table} WHERE status = 'published' AND programme_date >= $1 AND programme_date < $2 ORDER BY programme_date, start_time, id`,
      [range.start, range.end],
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({ timezone: RADIO_CALENDAR_TIMEZONE, startDate: range.startDate, programmes: result.rows });
  } catch {
    requestError(req, res);
  }
});

adminRouter.use(requireAdmin);

adminRouter.get("/programmes", async (req, res): Promise<void> => {
  const range = weekFromQuery(req.query.startDate);
  if (!range) { res.status(400).json({ message: "startDate must be a valid YYYY-MM-DD date." }); return; }
  try {
    const result = await pool.query(
      `SELECT ${columns} FROM ${table} WHERE programme_date >= $1 AND programme_date < $2 ORDER BY programme_date, start_time, id`,
      [range.start, range.end],
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({ timezone: RADIO_CALENDAR_TIMEZONE, startDate: range.startDate, programmes: result.rows });
  } catch {
    requestError(req, res);
  }
});

adminRouter.post("/programmes/import", async (req, res): Promise<void> => {
  const parsed = parseRadioCalendarImport(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.message });
    return;
  }
  try {
    const programmes = await importRadioCalendarProgrammes(pool, parsed.data);
    res.status(201).json({ programmes });
  } catch (error) {
    if (error instanceof RadioCalendarImportError) {
      res.status(error.statusCode).json({ message: error.message, issues: error.issues });
      return;
    }
    req.log.error({ err: error }, "Radio Calendar bulk import failed.");
    res.status(503).json({ message: "The Radio Calendar import could not be completed." });
  }
});

adminRouter.post("/programmes", async (req, res): Promise<void> => {
  const parsed = radioCalendarInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid Radio Calendar programme." }); return; }
  const value = parsed.data;
  try {
    const result = await pool.query(
      `INSERT INTO ${table} (title_en, title_ur, description_en, description_ur, programme_type, programme_date, start_time, end_time, timezone, external_link, public_note, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft') RETURNING ${columns}`,
      [value.titleEn, value.titleUr, value.descriptionEn, value.descriptionUr, value.programmeType, value.programmeDate,
        value.startTime, value.endTime, value.timezone, value.externalLink, value.publicNote],
    );
    res.status(201).json({ programme: result.rows[0] });
  } catch {
    requestError(req, res);
  }
});

adminRouter.put("/programmes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = radioCalendarInput.safeParse(req.body);
  if (!Number.isInteger(id) || id < 1 || !parsed.success) {
    res.status(400).json({ message: "Invalid Radio Calendar programme." }); return;
  }
  const value = parsed.data;
  try {
    const result = await pool.query(
      `UPDATE ${table} SET title_en=$1, title_ur=$2, description_en=$3, description_ur=$4,
       programme_type=$5, programme_date=$6, start_time=$7, end_time=$8, timezone=$9,
       external_link=$10, public_note=$11, updated_at=now() WHERE id=$12 RETURNING ${columns}`,
      [value.titleEn, value.titleUr, value.descriptionEn, value.descriptionUr, value.programmeType,
        value.programmeDate, value.startTime, value.endTime, value.timezone, value.externalLink, value.publicNote, id],
    );
    if (!result.rowCount) { res.status(404).json({ message: "Programme not found." }); return; }
    res.json({ programme: result.rows[0] });
  } catch {
    requestError(req, res);
  }
});

async function setStatus(req: Parameters<import("express").RequestHandler>[0], res: Parameters<import("express").RequestHandler>[1], status: typeof RADIO_CALENDAR_STATUSES[number]): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid programme ID." }); return; }
  try {
    const result = await pool.query(
      `UPDATE ${table} SET status=$1, updated_at=now() WHERE id=$2 RETURNING ${columns}`, [status, id],
    );
    if (!result.rowCount) { res.status(404).json({ message: "Programme not found." }); return; }
    res.json({ programme: result.rows[0] });
  } catch {
    requestError(req, res);
  }
}

adminRouter.post("/programmes/:id/publish", async (req, res): Promise<void> => setStatus(req, res, "published"));
adminRouter.post("/programmes/:id/cancel", async (req, res): Promise<void> => setStatus(req, res, "cancelled"));
router.use("/admin/radio-calendar", adminRouter);

export default router;

