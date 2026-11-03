import type { Pool, PoolClient } from "pg";
import {
  RADIO_CALENDAR_TIMEZONE,
  radioCalendarInput,
  type RadioCalendarInput,
} from "./radioCalendar.js";

const MAX_IMPORT_SIZE = 100;
const duplicateKey = (programme: Pick<RadioCalendarInput, "programmeDate" | "titleEn">) =>
  `${programme.programmeDate}|${programme.titleEn.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en")}`;

export type CalendarImportRow = {
  titleEn: string;
  titleUr: string;
  programmeDate: string;
  startTime: string;
  endTime: string;
  status?: string;
};

export type CalendarImportIssue = {
  kind: "duplicate" | "overlap";
  programmeDate: string;
  titleEn: string;
  conflictingTitleEn: string;
};

export class RadioCalendarImportError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly issues: CalendarImportIssue[] = [],
  ) {
    super(message);
    this.name = "RadioCalendarImportError";
  }
}

export function parseRadioCalendarImport(value: unknown):
  | { success: true; data: RadioCalendarInput[] }
  | { success: false; message: string } {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IMPORT_SIZE) {
    return { success: false, message: `Choose a JSON array containing 1–${MAX_IMPORT_SIZE} programmes.` };
  }

  const parsed = radioCalendarInput.array().safeParse(value);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const row = typeof firstIssue?.path[0] === "number" ? firstIssue.path[0] + 1 : null;
    return {
      success: false,
      message: row
        ? `Programme ${row} is invalid: ${firstIssue.message}`
        : `The import contains an invalid programme: ${firstIssue?.message ?? "validation failed"}`,
    };
  }

  if (parsed.data.some((programme) => programme.timezone !== RADIO_CALENDAR_TIMEZONE)) {
    return { success: false, message: `All programme times must use ${RADIO_CALENDAR_TIMEZONE}.` };
  }

  return { success: true, data: parsed.data };
}

function minutes(value: string): number {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

export function findRadioCalendarImportIssues(
  programmes: RadioCalendarInput[],
  existing: CalendarImportRow[],
): CalendarImportIssue[] {
  const issues: CalendarImportIssue[] = [];
  const importedByKey = new Map<string, RadioCalendarInput>();
  const existingByKey = new Map(existing.map((programme) => [duplicateKey(programme), programme]));

  for (const programme of programmes) {
    const key = duplicateKey(programme);
    const duplicate = importedByKey.get(key) ?? existingByKey.get(key);
    if (duplicate) {
      issues.push({
        kind: "duplicate",
        programmeDate: programme.programmeDate,
        titleEn: programme.titleEn,
        conflictingTitleEn: duplicate.titleEn,
      });
    } else {
      importedByKey.set(key, programme);
    }
  }

  const activeExisting = existing.filter((programme) => programme.status !== "cancelled");
  const scheduled = [
    ...programmes.map((programme, index) => ({ ...programme, importedIndex: index, imported: true })),
    ...activeExisting.map((programme) => ({ ...programme, importedIndex: -1, imported: false })),
  ];

  for (let leftIndex = 0; leftIndex < scheduled.length; leftIndex += 1) {
    const left = scheduled[leftIndex];
    if (!left.imported) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < scheduled.length; rightIndex += 1) {
      const right = scheduled[rightIndex];
      if (left.programmeDate !== right.programmeDate) continue;
      if (minutes(left.startTime) < minutes(right.endTime) && minutes(right.startTime) < minutes(left.endTime)) {
        issues.push({
          kind: "overlap",
          programmeDate: left.programmeDate,
          titleEn: left.titleEn,
          conflictingTitleEn: right.titleEn,
        });
      }
    }
  }

  return issues;
}

type ImportPool = Pick<Pool, "connect">;

export async function importRadioCalendarProgrammes(
  pool: ImportPool,
  programmes: RadioCalendarInput[],
): Promise<Record<string, unknown>[]> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");
    // Serialize calendar writes during the preflight and insert so an Admin single-create
    // request cannot race the duplicate/overlap checks.
    await client.query("LOCK TABLE radio_calendar_programmes IN SHARE ROW EXCLUSIVE MODE");

    const dates = [...new Set(programmes.map((programme) => programme.programmeDate))];
    const existingResult = await client.query<CalendarImportRow>(
      `SELECT title_en AS "titleEn", title_ur AS "titleUr",
        programme_date::text AS "programmeDate", start_time::text AS "startTime",
        end_time::text AS "endTime", status
       FROM radio_calendar_programmes
       WHERE programme_date = ANY($1::date[])`,
      [dates],
    );
    const issues = findRadioCalendarImportIssues(programmes, existingResult.rows);
    if (issues.length) {
      const hasDuplicate = issues.some((issue) => issue.kind === "duplicate");
      throw new RadioCalendarImportError(
        hasDuplicate
          ? "The import contains programmes already in the calendar or repeated in the file."
          : "The import conflicts with existing programme times.",
        409,
        issues,
      );
    }

    const inserted: Record<string, unknown>[] = [];
    for (const programme of programmes) {
      const result = await client.query(
        `INSERT INTO radio_calendar_programmes
          (title_en, title_ur, description_en, description_ur, programme_type, programme_date,
           start_time, end_time, timezone, external_link, public_note, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft')
         RETURNING id, title_en AS "titleEn", title_ur AS "titleUr",
           description_en AS "descriptionEn", description_ur AS "descriptionUr",
           programme_type AS "programmeType", programme_date AS "programmeDate",
           start_time AS "startTime", end_time AS "endTime", timezone,
           external_link AS "externalLink", public_note AS "publicNote", status,
           created_at AS "createdAt", updated_at AS "updatedAt"`,
        [
          programme.titleEn,
          programme.titleUr,
          programme.descriptionEn,
          programme.descriptionUr,
          programme.programmeType,
          programme.programmeDate,
          programme.startTime,
          programme.endTime,
          RADIO_CALENDAR_TIMEZONE,
          programme.externalLink,
          programme.publicNote,
        ],
      );
      inserted.push(result.rows[0]);
    }

    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
