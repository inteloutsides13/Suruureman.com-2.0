import { and, eq, gte, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import {
  RADIO_CATEGORIES,
  RADIO_RIGHTS_STATUSES,
  radioAudioTable,
  type RadioAudio,
} from "@workspace/db/schema";

export const MAX_RADIO_AUDIO_BYTES = 500 * 1024 * 1024;
export const MAX_RADIO_AUDIO_DURATION_MS = 120 * 60 * 1000;
const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "aac"]);

export function parsePositiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function validateAudioMetadata(input: unknown): {
  ok: true;
  value: {
    title: string;
    titleUrdu: string;
    description: string;
    category: (typeof RADIO_CATEGORIES)[number] | null;
    originalFilename: string;
    sizeBytes: number;
    durationMs: number;
    contentType: string;
    extension: string;
    rightsStatus: (typeof RADIO_RIGHTS_STATUSES)[number];
    rightsNotes: string | null;
    rightsValidFrom: Date | null;
    rightsValidUntil: Date | null;
    poetId: number | null;
    poemId: number | null;
  };
} | { ok: false; message: string } {
  if (!input || typeof input !== "object") return { ok: false, message: "Audio metadata must be an object" };
  const body = input as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const titleUrdu = typeof body.titleUrdu === "string" ? body.titleUrdu.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = body.category === undefined || body.category === null || body.category === ""
    ? null
    : typeof body.category === "string" && RADIO_CATEGORIES.includes(body.category as (typeof RADIO_CATEGORIES)[number])
      ? body.category as (typeof RADIO_CATEGORIES)[number]
      : "invalid";
  const originalFilename = typeof body.originalFilename === "string" ? body.originalFilename.trim() : "";
  const sizeBytes = parsePositiveInt(body.sizeBytes);
  const durationMs = parsePositiveInt(body.durationMs);
  const contentType = typeof body.contentType === "string" ? body.contentType.toLowerCase().trim() : "";

  if (!title || title.length > 200) return { ok: false, message: "Title is required and must be at most 200 characters" };
  if (titleUrdu.length > 200) return { ok: false, message: "Urdu title must be at most 200 characters" };
  if (description.length > 5_000) return { ok: false, message: "Description must be at most 5000 characters" };
  if (category === "invalid") return { ok: false, message: "Invalid Radio category" };
  if (!originalFilename || originalFilename.length > 255 || originalFilename.includes("\0")) {
    return { ok: false, message: "A valid original filename is required" };
  }
  if (!sizeBytes || sizeBytes > MAX_RADIO_AUDIO_BYTES) {
    return { ok: false, message: "Audio must be larger than zero and no larger than 500 MB" };
  }
  if (!durationMs || durationMs > MAX_RADIO_AUDIO_DURATION_MS) {
    return { ok: false, message: "Audio duration must be no longer than 120 minutes" };
  }

  const extension = originalFilename.split(".").pop()?.toLowerCase() ?? "";
  if (!AUDIO_EXTENSIONS.has(extension)) return { ok: false, message: "Only MP3, M4A, and AAC audio is supported" };
  if (!["audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a"].includes(contentType)) {
    return { ok: false, message: "Unsupported audio content type" };
  }

  const rightsStatus = body.rightsStatus ?? "unknown";
  if (!RADIO_RIGHTS_STATUSES.includes(rightsStatus as (typeof RADIO_RIGHTS_STATUSES)[number])) {
    return { ok: false, message: "Invalid rights status" };
  }

  const parseDate = (value: unknown): Date | null | "invalid" => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") return "invalid";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "invalid" : date;
  };
  const rightsValidFrom = parseDate(body.rightsValidFrom);
  const rightsValidUntil = parseDate(body.rightsValidUntil);
  if (rightsValidFrom === "invalid" || rightsValidUntil === "invalid") {
    return { ok: false, message: "Rights validity dates must be valid ISO dates" };
  }
  if (rightsValidFrom && rightsValidUntil && rightsValidFrom > rightsValidUntil) {
    return { ok: false, message: "Rights validity start must precede its end" };
  }

  const parseOptionalId = (value: unknown): number | null | "invalid" => {
    if (value === undefined || value === null || value === "") return null;
    const id = parsePositiveInt(value);
    return id ?? "invalid";
  };
  const poetId = parseOptionalId(body.poetId);
  const poemId = parseOptionalId(body.poemId);
  if (poetId === "invalid" || poemId === "invalid") return { ok: false, message: "Poet and poem IDs must be positive integers" };

  return {
    ok: true,
    value: {
      title,
      titleUrdu,
      description,
      category,
      originalFilename,
      sizeBytes,
      durationMs,
      contentType,
      extension,
      rightsStatus: rightsStatus as (typeof RADIO_RIGHTS_STATUSES)[number],
      rightsNotes: typeof body.rightsNotes === "string" ? body.rightsNotes.trim().slice(0, 5000) || null : null,
      rightsValidFrom,
      rightsValidUntil,
      poetId,
      poemId,
    },
  };
}

export function isBroadcastEligible(audio: RadioAudio, now = new Date()): boolean {
  return getBroadcastEligibilityReasons(audio, now).length === 0;
}

export const BROADCAST_ELIGIBILITY_REASONS = [
  "processing_not_ready",
  "editorial_approval_required",
  "rights_not_cleared",
  "rights_not_yet_valid",
  "rights_expired",
  "missing_object_key",
  "missing_checksum",
] as const;

export type BroadcastEligibilityReason = (typeof BROADCAST_ELIGIBILITY_REASONS)[number];

type BroadcastEligibilityAudio = Pick<
  RadioAudio,
  | "processingStatus"
  | "editorialStatus"
  | "rightsStatus"
  | "rightsValidFrom"
  | "rightsValidUntil"
  | "processedObjectKey"
  | "objectKey"
  | "sha256"
>;

export function getBroadcastEligibilityReasons(
  audio: BroadcastEligibilityAudio,
  now = new Date(),
): BroadcastEligibilityReason[] {
  const reasons: BroadcastEligibilityReason[] = [];
  if (audio.processingStatus !== "ready") reasons.push("processing_not_ready");
  if (audio.editorialStatus !== "approved") reasons.push("editorial_approval_required");

  const rightsExpired = Boolean(audio.rightsValidUntil && audio.rightsValidUntil < now);
  if (audio.rightsStatus !== "cleared") {
    reasons.push(rightsExpired || audio.rightsStatus === "expired" ? "rights_expired" : "rights_not_cleared");
  } else {
    if (audio.rightsValidFrom && audio.rightsValidFrom > now) reasons.push("rights_not_yet_valid");
    if (rightsExpired) reasons.push("rights_expired");
  }

  if (!Boolean(audio.processedObjectKey ?? audio.objectKey)) reasons.push("missing_object_key");
  if (!audio.sha256) reasons.push("missing_checksum");
  return reasons;
}

export function broadcastEligibilityCondition(now = new Date()) {
  return and(
    eq(radioAudioTable.processingStatus, "ready"),
    eq(radioAudioTable.editorialStatus, "approved"),
    eq(radioAudioTable.rightsStatus, "cleared"),
    or(isNull(radioAudioTable.rightsValidFrom), lte(radioAudioTable.rightsValidFrom, now)),
    or(isNull(radioAudioTable.rightsValidUntil), gte(radioAudioTable.rightsValidUntil, now)),
    or(
      and(isNotNull(radioAudioTable.processedObjectKey), ne(radioAudioTable.processedObjectKey, "")),
      and(isNull(radioAudioTable.processedObjectKey), isNotNull(radioAudioTable.objectKey), ne(radioAudioTable.objectKey, "")),
    ),
    ne(radioAudioTable.sha256, ""),
  );
}

export function safeExtension(extension: string): string {
  return AUDIO_EXTENSIONS.has(extension) ? extension : "bin";
}