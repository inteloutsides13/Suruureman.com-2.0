import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable, poemsTable, poetsTable } from "./poems";

export const RADIO_EDITORIAL_STATUSES = [
  "draft",
  "uploading",
  "quarantined",
  "processing",
  "ready_for_review",
  "approved",
  "rejected",
  "inactive",
  "archived",
] as const;

export const RADIO_RIGHTS_STATUSES = [
  "unknown",
  "cleared",
  "restricted",
  "expired",
  "takedown",
] as const;

export const RADIO_PROCESSING_STATUSES = [
  "not_started",
  "uploaded",
  "quarantined",
  "processing",
  "ready",
  "failed",
] as const;

export const RADIO_PROGRAMME_TYPES = [
  "AUTO_DJ",
  "LIVE_RADIO",
  "RECORDED_SHOW",
  "POETRY_HOUR",
  "TIKTOK_LIVE",
  "SPECIAL_ANNOUNCEMENT",
  "BREAK",
] as const;

export const RADIO_SCHEDULE_TYPES = ["WEEKLY", "ONE_TIME"] as const;

export const RADIO_CATEGORIES = [
  "poetry",
  "ghazal",
  "music",
  "naat_special",
  "literary_program",
  "interview",
  "recorded_program",
  "live_program",
  "station_promo",
] as const;

export const radioAudioTable = pgTable(
  "radio_audio",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    titleUrdu: text("title_urdu").notNull().default(""),
    description: text("description").notNull().default(""),
    category: text("category", { enum: RADIO_CATEGORIES }),
    originalFilename: text("original_filename").notNull(),
    objectKey: text("object_key"),
    uploadSessionId: text("upload_session_id"),
    processedObjectKey: text("processed_object_key"),
    objectVersion: integer("object_version").notNull().default(1),
    sha256: text("sha256"),
    sizeBytes: integer("size_bytes"),
    durationMs: integer("duration_ms"),
    container: text("container"),
    codec: text("codec"),
    bitrateKbps: integer("bitrate_kbps"),
    sampleRateHz: integer("sample_rate_hz"),
    channels: integer("channels"),
    integratedLufs: real("integrated_lufs"),
    truePeakDb: real("true_peak_db"),
    normalizationStatus: text("normalization_status").notNull().default("not_started"),
    processingStatus: text("processing_status", {
      enum: RADIO_PROCESSING_STATUSES,
    }).notNull().default("not_started"),
    editorialStatus: text("editorial_status", {
      enum: RADIO_EDITORIAL_STATUSES,
    }).notNull().default("draft"),
    rightsStatus: text("rights_status", {
      enum: RADIO_RIGHTS_STATUSES,
    }).notNull().default("unknown"),
    rightsNotes: text("rights_notes"),
    rightsValidFrom: timestamp("rights_valid_from", { withTimezone: true }),
    rightsValidUntil: timestamp("rights_valid_until", { withTimezone: true }),
    poetId: integer("poet_id").references(() => poetsTable.id, { onDelete: "set null" }),
    poemId: integer("poem_id").references(() => poemsTable.id, { onDelete: "set null" }),
    createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    approvedByUserId: integer("approved_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedByUserId: integer("rejected_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_radio_audio_editorial_status").on(table.editorialStatus),
    index("idx_radio_audio_processing_status").on(table.processingStatus),
    index("idx_radio_audio_rights_status").on(table.rightsStatus),
    index("idx_radio_audio_created_at").on(table.createdAt),
    index("idx_radio_audio_poem_id").on(table.poemId),
  ],
);

export const radioPlaylistsTable = pgTable(
  "radio_playlists",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    mode: text("mode", { enum: ["sequential", "weighted", "random"] })
      .notNull()
      .default("sequential"),
    status: text("status", { enum: ["draft", "active", "archived"] })
      .notNull()
      .default("draft"),
    repeatWindow: integer("repeat_window"),
    isDefault: boolean("is_default").notNull().default(false),
    isFallback: boolean("is_fallback").notNull().default(false),
    createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_radio_playlists_status").on(table.status),
    index("idx_radio_playlists_fallback").on(table.isFallback),
  ],
);

export const radioPlaylistItemsTable = pgTable(
  "radio_playlist_items",
  {
    id: serial("id").primaryKey(),
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => radioPlaylistsTable.id, { onDelete: "cascade" }),
    audioId: integer("audio_id")
      .notNull()
      .references(() => radioAudioTable.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    weight: integer("weight"),
    enabled: boolean("enabled").notNull().default(true),
    cueInMs: integer("cue_in_ms"),
    cueOutMs: integer("cue_out_ms"),
    attribution: text("attribution"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_radio_playlist_item_position").on(table.playlistId, table.position),
    index("idx_radio_playlist_items_audio").on(table.audioId),
  ],
);

export const radioSchedulesTable = pgTable(
  "radio_schedules",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    playlistId: integer("playlist_id")
      .references(() => radioPlaylistsTable.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["draft", "active", "archived", "published", "cancelled"] })
      .notNull()
      .default("draft"),
    timezone: text("timezone").notNull().default("Asia/Dubai"),
    daysOfWeek: text("days_of_week").notNull().default("[]"),
    startLocalTime: text("start_local_time").notNull(),
    endLocalTime: text("end_local_time").notNull(),
    titleEn: text("title_en"),
    titleUr: text("title_ur"),
    descriptionEn: text("description_en"),
    descriptionUr: text("description_ur"),
    programmeType: text("programme_type", { enum: RADIO_PROGRAMME_TYPES }),
    poetName: text("poet_name"),
    externalUrl: text("external_url"),
    thumbnailUrl: text("thumbnail_url"),
    scheduleType: text("schedule_type", { enum: RADIO_SCHEDULE_TYPES }).notNull().default("WEEKLY"),
    scheduledDate: date("scheduled_date", { mode: "string" }),
    publicNote: text("public_note"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    priority: integer("priority").notNull().default(0),
    programName: text("program_name"),
    version: integer("version").notNull().default(1),
    attribution: text("attribution"),
    createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_radio_schedules_status").on(table.status),
    index("idx_radio_schedules_effective").on(table.effectiveFrom, table.effectiveUntil),
  ],
);

export const radioSettingsTable = pgTable("radio_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const radioPlayHistoryTable = pgTable(
  "radio_play_history",
  {
    id: serial("id").primaryKey(),
    audioId: integer("audio_id").references(() => radioAudioTable.id, { onDelete: "set null" }),
    playlistId: integer("playlist_id").references(() => radioPlaylistsTable.id, { onDelete: "set null" }),
    scheduleId: integer("schedule_id").references(() => radioSchedulesTable.id, { onDelete: "set null" }),
    manifestVersion: integer("manifest_version"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    expectedDurationMs: integer("expected_duration_ms"),
    actualDurationMs: integer("actual_duration_ms"),
    result: text("result", { enum: ["started", "completed", "failed", "skipped"] })
      .notNull()
      .default("started"),
    failureCode: text("failure_code"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_radio_play_history_started_at").on(table.startedAt),
    index("idx_radio_play_history_audio").on(table.audioId),
  ],
);

export type RadioManifestPayload = {
  station: { name: string; timezone: string };
  activeSchedule: Record<string, unknown> | null;
  playlist: Record<string, unknown> | null;
  approvedAudio: Array<{ id: number; objectKey: string; sha256: string; title: string }>;
  fallback: { playlistId: number | null; objectKey: string | null };
  emergency: { objectKey: string | null };
};

export const radioManifestsTable = pgTable(
  "radio_manifests",
  {
    id: serial("id").primaryKey(),
    version: integer("version").notNull(),
    status: text("status", { enum: ["draft", "active", "superseded", "invalid"] })
      .notNull()
      .default("draft"),
    payload: jsonb("payload").$type<RadioManifestPayload>().notNull(),
    sha256: text("sha256").notNull(),
    publishedByUserId: integer("published_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_radio_manifest_version").on(table.version),
    index("idx_radio_manifests_status").on(table.status),
  ],
);

export type RadioAudio = typeof radioAudioTable.$inferSelect;
export type RadioPlaylist = typeof radioPlaylistsTable.$inferSelect;
export type RadioPlaylistItem = typeof radioPlaylistItemsTable.$inferSelect;
export type RadioSchedule = typeof radioSchedulesTable.$inferSelect;
export type RadioSetting = typeof radioSettingsTable.$inferSelect;
export type RadioPlayHistory = typeof radioPlayHistoryTable.$inferSelect;
export type RadioManifest = typeof radioManifestsTable.$inferSelect;