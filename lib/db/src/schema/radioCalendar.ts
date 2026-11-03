import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  pgTable,
  text,
  time,
  timestamp,
} from "drizzle-orm/pg-core";

export const radioCalendarProgrammesTable = pgTable(
  "radio_calendar_programmes",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    titleEn: text("title_en").notNull(),
    titleUr: text("title_ur").notNull(),
    descriptionEn: text("description_en"),
    descriptionUr: text("description_ur"),
    programmeType: text("programme_type").notNull(),
    programmeDate: date("programme_date", { mode: "string" }).notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    timezone: text("timezone").notNull().default("Europe/Berlin"),
    externalLink: text("external_link"),
    publicNote: text("public_note"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "radio_calendar_programmes_programme_type_check",
      sql`${table.programmeType} IN ('Auto DJ', 'Live Radio', 'Recorded Show', 'Poetry Hour', 'TikTok Live', 'Announcement/Break')`,
    ),
    check("radio_calendar_programmes_end_time_check", sql`${table.endTime} <> ${table.startTime}`),
    check("radio_calendar_programmes_timezone_check", sql`${table.timezone} = 'Europe/Berlin'`),
    check(
      "radio_calendar_programmes_status_check",
      sql`${table.status} IN ('draft', 'published', 'cancelled')`,
    ),
  ],
);

export type RadioCalendarProgramme = typeof radioCalendarProgrammesTable.$inferSelect;
export type NewRadioCalendarProgramme = typeof radioCalendarProgrammesTable.$inferInsert;
