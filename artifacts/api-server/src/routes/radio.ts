import { Router, type IRouter, type RequestHandler } from "express";
import { and, asc, count, desc, eq, ilike, not, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  RADIO_EDITORIAL_STATUSES,
  RADIO_PROCESSING_STATUSES,
  RADIO_RIGHTS_STATUSES,
  radioAudioTable,
  radioPlaylistItemsTable,
  radioPlaylistsTable,
  radioSchedulesTable,
  radioSettingsTable,
} from "@workspace/db/schema";
import type { AdminPayload } from "../middlewares/adminAuth.js";
import { requireAdmin } from "../middlewares/adminAuth.js";
import { radioAdminRateLimit } from "../lib/rateLimit.js";
import { writeAuditLog } from "../lib/audit.js";
import {
  getRadioStorageProvider,
  RadioStorageNotConfiguredError,
} from "../lib/radioStorage.js";
import { getRadioAdminPermissions } from "../lib/config.js";
import {
  isBroadcastEligible,
  broadcastEligibilityCondition,
  getBroadcastEligibilityReasons,
  parsePositiveInt,
  safeExtension,
  validateAudioMetadata,
} from "../lib/radioValidation.js";
import {
  DEFAULT_RADIO_TIMEZONE,
  scheduleValidationError,
} from "../lib/radioSchedule.js";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

function actorFrom(req: Parameters<RequestHandler>[0]): AdminPayload {
  return (req as any).adminUser as AdminPayload;
}

function actorId(req: Parameters<RequestHandler>[0]): number | null {
  return actorFrom(req).userId ?? null;
}

function requireRadioPermission(permission: string): RequestHandler {
  return (req, res, next) => {
    const actor = actorFrom(req);
    if (actor.role === "developer") {
      next();
      return;
    }
    const allowed = getRadioAdminPermissions();
    if (actor.role === "admin" && allowed.has(permission)) {
      next();
      return;
    }
    res.status(403).json({ message: "Radio permission is not granted" });
  };
}

function parseLimitOffset(req: Parameters<RequestHandler>[0]): { limit: number; offset: number } {
  const rawLimit = Number(req.query.limit ?? 50);
  const rawOffset = Number(req.query.offset ?? 0);
  return {
    limit: Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50,
    offset: Number.isInteger(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
}

const DEFAULT_AUDIO_PAGE_SIZE = 50;
const MAX_AUDIO_PAGE_SIZE = 100;

function parseAudioPagination(req: Parameters<RequestHandler>[0]):
  | { page: number; pageSize: number; offset: number }
  | { error: string } {
  const hasPageParams = req.query.page !== undefined || req.query.pageSize !== undefined;
  if (hasPageParams) {
    const rawPage = Number(req.query.page ?? 1);
    const rawPageSize = Number(req.query.pageSize ?? DEFAULT_AUDIO_PAGE_SIZE);
    if (!Number.isInteger(rawPage) || rawPage < 1) {
      return { error: "Page must be a positive integer" };
    }
    if (!Number.isInteger(rawPageSize) || rawPageSize < 1 || rawPageSize > MAX_AUDIO_PAGE_SIZE) {
      return { error: `Page size must be an integer between 1 and ${MAX_AUDIO_PAGE_SIZE}` };
    }
    return { page: rawPage, pageSize: rawPageSize, offset: (rawPage - 1) * rawPageSize };
  }

  const { limit, offset } = parseLimitOffset(req);
  return { page: Math.floor(offset / limit) + 1, pageSize: limit, offset };
}

function parseId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalDate(value: unknown): Date | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

function parseOptionalPositiveInt(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const parsed = parsePositiveInt(value);
  return parsed ?? "invalid";
}

const PLAYLIST_MODES = ["sequential", "weighted", "random"] as const;
const PLAYLIST_STATUSES = ["draft", "active", "archived"] as const;
const SCHEDULE_STATUSES = ["draft", "active", "archived"] as const;
const EMERGENCY_TYPES = ["poetry", "message", "playlist"] as const;

router.use(requireAdmin, radioAdminRateLimit);

router.get("/audio", requireRadioPermission("radio.audio.read"), async (req, res) => {
  try {
    const pagination = parseAudioPagination(req);
    if ("error" in pagination) {
      res.status(400).json({ message: pagination.error });
      return;
    }
    const { page, pageSize, offset } = pagination;
    const editorialStatus = typeof req.query.editorialStatus === "string" ? req.query.editorialStatus : undefined;
    const processingStatus = typeof req.query.processingStatus === "string" ? req.query.processingStatus : undefined;
    const rightsStatus = typeof req.query.rightsStatus === "string" ? req.query.rightsStatus : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const eligibility = typeof req.query.eligibility === "string" ? req.query.eligibility : "all";
    if (editorialStatus && !RADIO_EDITORIAL_STATUSES.includes(editorialStatus as (typeof RADIO_EDITORIAL_STATUSES)[number])) {
      res.status(400).json({ message: "Invalid editorial status filter" });
      return;
    }
    if (processingStatus && !RADIO_PROCESSING_STATUSES.includes(processingStatus as (typeof RADIO_PROCESSING_STATUSES)[number])) {
      res.status(400).json({ message: "Invalid processing status filter" });
      return;
    }
    if (rightsStatus && !RADIO_RIGHTS_STATUSES.includes(rightsStatus as (typeof RADIO_RIGHTS_STATUSES)[number])) {
      res.status(400).json({ message: "Invalid rights status filter" });
      return;
    }
    if (!["all", "eligible", "ineligible"].includes(eligibility)) {
      res.status(400).json({ message: "Invalid broadcast eligibility filter" });
      return;
    }
    const now = new Date();
    const eligibilityCondition = broadcastEligibilityCondition(now);
    const filters = [
      editorialStatus ? eq(radioAudioTable.editorialStatus, editorialStatus as any) : undefined,
      processingStatus ? eq(radioAudioTable.processingStatus, processingStatus as any) : undefined,
      rightsStatus ? eq(radioAudioTable.rightsStatus, rightsStatus as any) : undefined,
      search ? or(
        ilike(radioAudioTable.title, `%${search}%`),
        ilike(radioAudioTable.titleUrdu, `%${search}%`),
        ilike(radioAudioTable.originalFilename, `%${search}%`),
      ) : undefined,
      eligibility === "eligible" ? eligibilityCondition : undefined,
      eligibility === "ineligible" && eligibilityCondition ? not(eligibilityCondition) : undefined,
    ];
    const scope = and(...filters);
    const eligibleScope = and(scope, eligibilityCondition);
    const [totalRows, eligibleRows, rows] = await Promise.all([
      db.select({ total: count() }).from(radioAudioTable).where(scope),
      db.select({ eligible: count() }).from(radioAudioTable).where(eligibleScope),
      db
        .select({
          id: radioAudioTable.id,
          title: radioAudioTable.title,
          titleUrdu: radioAudioTable.titleUrdu,
          description: radioAudioTable.description,
          category: radioAudioTable.category,
          originalFilename: radioAudioTable.originalFilename,
          objectVersion: radioAudioTable.objectVersion,
          sizeBytes: radioAudioTable.sizeBytes,
          durationMs: radioAudioTable.durationMs,
          container: radioAudioTable.container,
          codec: radioAudioTable.codec,
          processingStatus: radioAudioTable.processingStatus,
          editorialStatus: radioAudioTable.editorialStatus,
          rightsStatus: radioAudioTable.rightsStatus,
          rightsNotes: radioAudioTable.rightsNotes,
          rightsValidFrom: radioAudioTable.rightsValidFrom,
          rightsValidUntil: radioAudioTable.rightsValidUntil,
          createdByUserId: radioAudioTable.createdByUserId,
          approvedByUserId: radioAudioTable.approvedByUserId,
          approvedAt: radioAudioTable.approvedAt,
          archivedAt: radioAudioTable.archivedAt,
          rejectionReason: radioAudioTable.rejectionReason,
          rejectedByUserId: radioAudioTable.rejectedByUserId,
          rejectedAt: radioAudioTable.rejectedAt,
          objectKey: radioAudioTable.objectKey,
          processedObjectKey: radioAudioTable.processedObjectKey,
          sha256: radioAudioTable.sha256,
          normalizationStatus: radioAudioTable.normalizationStatus,
          createdAt: radioAudioTable.createdAt,
          updatedAt: radioAudioTable.updatedAt,
        })
        .from(radioAudioTable)
        .where(scope)
        .orderBy(desc(radioAudioTable.createdAt), desc(radioAudioTable.id))
        .limit(pageSize)
        .offset(offset),
    ]);
    const total = totalRows[0]?.total ?? 0;
    const eligible = eligibleRows[0]?.eligible ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const enriched = rows.map((row) => {
      const broadcastEligibilityReasons = getBroadcastEligibilityReasons(row, now);
      return {
        ...row,
        broadcastEligibilityReasons,
        broadcastEligible: broadcastEligibilityReasons.length === 0,
      };
    });
    res.json({
      audio: enriched,
      limit: pageSize,
      offset,
      counts: { total, eligible },
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: totalPages > 0 && page < totalPages,
        hasPreviousPage: page > 1 && total > 0,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list Radio audio");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/audio", requireRadioPermission("radio.audio.create"), async (req, res) => {
  const validation = validateAudioMetadata(req.body);
  if (!validation.ok) {
    res.status(400).json({ message: validation.message });
    return;
  }

  try {
    const input = validation.value;
    const [audio] = await db.insert(radioAudioTable).values({
      title: input.title,
      titleUrdu: input.titleUrdu,
      description: input.description,
      category: input.category,
      originalFilename: input.originalFilename,
      sizeBytes: input.sizeBytes,
      durationMs: input.durationMs,
      container: input.extension,
      rightsStatus: input.rightsStatus,
      rightsNotes: input.rightsNotes,
      rightsValidFrom: input.rightsValidFrom,
      rightsValidUntil: input.rightsValidUntil,
      poetId: input.poetId,
      poemId: input.poemId,
      createdByUserId: actorId(req),
      editorialStatus: "draft",
      processingStatus: "not_started",
    }).returning();

    await writeAuditLog(actorId(req), "radio_audio_created", "radio_audio", audio!.id, {
      title: audio!.title,
      originalFilename: audio!.originalFilename,
    });
    res.status(201).json({ audio, broadcastEligible: false });
  } catch (err) {
    req.log.error({ err }, "Failed to create Radio audio metadata");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/audio/upload-sessions", requireRadioPermission("radio.audio.create"), async (req, res) => {
  const validation = validateAudioMetadata(req.body);
  if (!validation.ok) {
    res.status(400).json({ message: validation.message });
    return;
  }

  const input = validation.value;
  let audioId: number | null = null;
  try {
    const [audio] = await db.insert(radioAudioTable).values({
      title: input.title,
      titleUrdu: input.titleUrdu,
      description: input.description,
      category: input.category,
      originalFilename: input.originalFilename,
      sizeBytes: input.sizeBytes,
      durationMs: input.durationMs,
      container: input.extension,
      rightsStatus: input.rightsStatus,
      rightsNotes: input.rightsNotes,
      rightsValidFrom: input.rightsValidFrom,
      rightsValidUntil: input.rightsValidUntil,
      poetId: input.poetId,
      poemId: input.poemId,
      createdByUserId: actorId(req),
      editorialStatus: "uploading",
      processingStatus: "not_started",
    }).returning({ id: radioAudioTable.id });
    audioId = audio!.id;

    const objectKey = `radio/audio/${audioId}/1/pending-${randomUUID()}.${safeExtension(input.extension)}`;
    await db.update(radioAudioTable)
      .set({ objectKey, updatedAt: new Date() })
      .where(eq(radioAudioTable.id, audioId));

    const session = await getRadioStorageProvider().createUploadSession({
      audioId,
      objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });
    await db.update(radioAudioTable)
      .set({ uploadSessionId: session.uploadId, updatedAt: new Date() })
      .where(eq(radioAudioTable.id, audioId));

    await writeAuditLog(actorId(req), "radio_audio_upload_session_created", "radio_audio", audioId, {
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
    });
    res.status(201).json({
      audioId,
      uploadId: session.uploadId,
      uploadUrl: session.uploadUrl,
      objectKey: session.objectKey,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    if (audioId && err instanceof RadioStorageNotConfiguredError) {
      await db.delete(radioAudioTable).where(eq(radioAudioTable.id, audioId));
      res.status(503).json({ message: "Radio object storage provider is not configured" });
      return;
    }
    req.log.error({ err: err instanceof Error ? err.message : "unknown" }, "Failed to create Radio upload session");
    res.status(502).json({ message: "Radio storage provider is unavailable" });
  }
});

router.post("/audio/:id/complete", requireRadioPermission("radio.audio.create"), async (req, res) => {
  const audioId = parsePositiveInt(req.params.id);
  if (!audioId) {
    res.status(400).json({ message: "Invalid audio ID" });
    return;
  }
  const uploadId = typeof req.body?.uploadId === "string" ? req.body.uploadId : "";
  if (!uploadId) {
    res.status(400).json({ message: "Upload ID is required" });
    return;
  }

  try {
    const [audio] = await db.select().from(radioAudioTable).where(eq(radioAudioTable.id, audioId));
    if (!audio) {
      res.status(404).json({ message: "Audio not found" });
      return;
    }
    if (!audio.uploadSessionId || audio.uploadSessionId !== uploadId) {
      res.status(400).json({ message: "Upload session does not match the audio record" });
      return;
    }

    const metadata = await getRadioStorageProvider().completeUpload(uploadId);
    if (!/^[a-f0-9]{64}$/i.test(metadata.sha256) || metadata.sizeBytes !== audio.sizeBytes) {
      res.status(400).json({ message: "Uploaded object failed checksum or size validation" });
      return;
    }

    const [updated] = await db.update(radioAudioTable).set({
      objectKey: metadata.objectKey,
      sha256: metadata.sha256.toLowerCase(),
      sizeBytes: metadata.sizeBytes,
      processingStatus: "quarantined",
      editorialStatus: "quarantined",
      updatedAt: new Date(),
    }).where(eq(radioAudioTable.id, audioId)).returning();
    await writeAuditLog(actorId(req), "radio_audio_quarantined", "radio_audio", audioId, {
      sha256: metadata.sha256.toLowerCase(),
      sizeBytes: metadata.sizeBytes,
    });
    res.json({ audio: updated, broadcastEligible: false });
  } catch (err) {
    if (err instanceof RadioStorageNotConfiguredError) {
      res.status(503).json({ message: "Radio object storage provider is not configured" });
      return;
    }
    req.log.error({ err: err instanceof Error ? err.message : "unknown" }, "Failed to complete Radio upload");
    res.status(502).json({ message: "Radio storage provider is unavailable" });
  }
});

router.post("/audio/:id/approve", requireRadioPermission("radio.audio.approve"), async (req, res) => {
  const audioId = parsePositiveInt(req.params.id);
  if (!audioId) {
    res.status(400).json({ message: "Invalid audio ID" });
    return;
  }
  try {
    const [audio] = await db.select().from(radioAudioTable).where(eq(radioAudioTable.id, audioId));
    if (!audio) {
      res.status(404).json({ message: "Audio not found" });
      return;
    }
    if (!isBroadcastEligible(audio)) {
      res.status(400).json({ message: "Audio must be processed, rights-cleared, and ready before approval" });
      return;
    }
    const [approved] = await db.update(radioAudioTable).set({
      editorialStatus: "approved",
      approvedByUserId: actorId(req),
      approvedAt: new Date(),
      rejectedByUserId: null,
      rejectedAt: null,
      rejectionReason: null,
      updatedAt: new Date(),
    }).where(eq(radioAudioTable.id, audioId)).returning();
    await writeAuditLog(actorId(req), "radio_audio_approved", "radio_audio", audioId);
    res.json({ audio: approved, broadcastEligible: true });
  } catch (err) {
    req.log.error({ err }, "Failed to approve Radio audio");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/audio/:id/reject", requireRadioPermission("radio.audio.approve"), async (req, res) => {
  const audioId = parseId(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 5_000) : "";
  if (!audioId) {
    res.status(400).json({ message: "Invalid audio ID" });
    return;
  }
  if (!reason) {
    res.status(400).json({ message: "A rejection reason is required" });
    return;
  }
  try {
    const [audio] = await db.select().from(radioAudioTable).where(eq(radioAudioTable.id, audioId));
    if (!audio) {
      res.status(404).json({ message: "Audio not found" });
      return;
    }
    if (audio.editorialStatus === "archived") {
      res.status(400).json({ message: "Archived audio cannot be rejected" });
      return;
    }
    const rejected = await db.transaction(async (tx) => {
      const [updated] = await tx.update(radioAudioTable).set({
        editorialStatus: "rejected",
        rejectedByUserId: actorId(req),
        rejectedAt: new Date(),
        rejectionReason: reason,
        approvedByUserId: null,
        approvedAt: null,
        updatedAt: new Date(),
      }).where(eq(radioAudioTable.id, audioId)).returning();
      await tx.update(radioPlaylistItemsTable)
        .set({ enabled: false, updatedAt: new Date() })
        .where(eq(radioPlaylistItemsTable.audioId, audioId));
      return updated;
    });
    await writeAuditLog(actorId(req), "radio_audio_rejected", "radio_audio", audioId, { reason });
    res.json({ audio: rejected, broadcastEligible: false });
  } catch (err) {
    req.log.error({ err }, "Failed to reject Radio audio");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/audio/:id/archive", requireRadioPermission("radio.audio.manage"), async (req, res) => {
  const audioId = parseId(req.params.id);
  if (!audioId) {
    res.status(400).json({ message: "Invalid audio ID" });
    return;
  }
  try {
    const archived = await db.transaction(async (tx) => {
      const [updated] = await tx.update(radioAudioTable).set({
        editorialStatus: "archived",
        archivedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(radioAudioTable.id, audioId)).returning();
      await tx.update(radioPlaylistItemsTable)
        .set({ enabled: false, updatedAt: new Date() })
        .where(eq(radioPlaylistItemsTable.audioId, audioId));
      return updated;
    });
    if (!archived) {
      res.status(404).json({ message: "Audio not found" });
      return;
    }
    await writeAuditLog(actorId(req), "radio_audio_archived", "radio_audio", audioId);
    res.json({ audio: archived, broadcastEligible: false });
  } catch (err) {
    req.log.error({ err }, "Failed to archive Radio audio");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/playlists", requireRadioPermission("radio.audio.read"), async (req, res) => {
  try {
    const playlists = await db.select().from(radioPlaylistsTable).orderBy(asc(radioPlaylistsTable.name));
    res.json({ playlists });
  } catch (err) {
    req.log.error({ err }, "Failed to list Radio playlists");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/playlists", requireRadioPermission("radio.playlists.manage"), async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const mode = req.body?.mode ?? "sequential";
  const status = req.body?.status ?? "draft";
  const repeatWindow = parseOptionalPositiveInt(req.body?.repeatWindow);
  if (!name || name.length > 200 || description.length > 5_000 || !PLAYLIST_STATUSES.includes(status) || repeatWindow === "invalid") {
    res.status(400).json({ message: "Playlist name and description are invalid" });
    return;
  }
  if (!["sequential", "weighted", "random"].includes(mode)) {
    res.status(400).json({ message: "Invalid playlist mode" });
    return;
  }
  try {
    const [playlist] = await db.insert(radioPlaylistsTable).values({
      name,
      description,
      mode: mode as "sequential" | "weighted" | "random",
      status,
      repeatWindow,
      createdByUserId: actorId(req),
      updatedByUserId: actorId(req),
    }).returning();
    await writeAuditLog(actorId(req), "radio_playlist_created", "radio_playlist", playlist!.id, { name });
    res.status(201).json({ playlist });
  } catch (err) {
    req.log.error({ err }, "Failed to create Radio playlist");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/playlists/:id", requireRadioPermission("radio.audio.read"), async (req, res) => {
  const playlistId = parseId(req.params.id);
  if (!playlistId) {
    res.status(400).json({ message: "Invalid playlist ID" });
    return;
  }
  try {
    const [playlist] = await db.select().from(radioPlaylistsTable).where(eq(radioPlaylistsTable.id, playlistId));
    if (!playlist) {
      res.status(404).json({ message: "Playlist not found" });
      return;
    }
    const items = await db.select({
      id: radioPlaylistItemsTable.id,
      playlistId: radioPlaylistItemsTable.playlistId,
      audioId: radioPlaylistItemsTable.audioId,
      position: radioPlaylistItemsTable.position,
      weight: radioPlaylistItemsTable.weight,
      enabled: radioPlaylistItemsTable.enabled,
      attribution: radioPlaylistItemsTable.attribution,
      title: radioAudioTable.title,
      category: radioAudioTable.category,
      editorialStatus: radioAudioTable.editorialStatus,
      processingStatus: radioAudioTable.processingStatus,
      rightsStatus: radioAudioTable.rightsStatus,
       rightsValidFrom: radioAudioTable.rightsValidFrom,
       rightsValidUntil: radioAudioTable.rightsValidUntil,
       objectKey: radioAudioTable.objectKey,
       processedObjectKey: radioAudioTable.processedObjectKey,
       sha256: radioAudioTable.sha256,
    }).from(radioPlaylistItemsTable)
      .innerJoin(radioAudioTable, eq(radioAudioTable.id, radioPlaylistItemsTable.audioId))
      .where(eq(radioPlaylistItemsTable.playlistId, playlistId))
      .orderBy(asc(radioPlaylistItemsTable.position));
    const enrichedItems = items.map((item) => {
      const broadcastEligibilityReasons = getBroadcastEligibilityReasons(item);
      return {
        ...item,
        broadcastEligibilityReasons,
        broadcastEligible: broadcastEligibilityReasons.length === 0,
      };
    });
    res.json({ playlist, items: enrichedItems });
  } catch (err) {
    req.log.error({ err }, "Failed to read Radio playlist");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/playlists/:id", requireRadioPermission("radio.playlists.manage"), async (req, res) => {
  const playlistId = parseId(req.params.id);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const mode = req.body?.mode;
  const status = req.body?.status;
  const repeatWindow = parseOptionalPositiveInt(req.body?.repeatWindow);
  if (!playlistId || !name || name.length > 200 || description.length > 5_000 || !PLAYLIST_MODES.includes(mode) || !PLAYLIST_STATUSES.includes(status) || repeatWindow === "invalid") {
    res.status(400).json({ message: "Invalid playlist data" });
    return;
  }
  try {
    if (status === "active") {
      const items = await db.select({ audio: radioAudioTable })
        .from(radioPlaylistItemsTable)
        .innerJoin(radioAudioTable, eq(radioAudioTable.id, radioPlaylistItemsTable.audioId))
        .where(eq(radioPlaylistItemsTable.playlistId, playlistId));
      if (items.some(({ audio }) => !isBroadcastEligible(audio))) {
        res.status(400).json({ message: "All playlist items must be approved, processed, and rights-cleared before activation" });
        return;
      }
    }
    const [playlist] = await db.update(radioPlaylistsTable).set({
      name,
      description,
      mode,
      status,
      repeatWindow,
      updatedByUserId: actorId(req),
      updatedAt: new Date(),
      archivedAt: status === "archived" ? new Date() : null,
    }).where(eq(radioPlaylistsTable.id, playlistId)).returning();
    if (!playlist) {
      res.status(404).json({ message: "Playlist not found" });
      return;
    }
    await writeAuditLog(actorId(req), "radio_playlist_updated", "radio_playlist", playlistId, { status, mode });
    res.json({ playlist });
  } catch (err) {
    req.log.error({ err }, "Failed to update Radio playlist");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/playlists/:id/items", requireRadioPermission("radio.playlists.manage"), async (req, res) => {
  const playlistId = parseId(req.params.id);
  const audioId = parseId(req.body?.audioId);
  if (!playlistId || !audioId) {
    res.status(400).json({ message: "Playlist and approved audio IDs are required" });
    return;
  }
  try {
    const [playlist] = await db.select({
      id: radioPlaylistsTable.id,
      status: radioPlaylistsTable.status,
    }).from(radioPlaylistsTable).where(eq(radioPlaylistsTable.id, playlistId));
    const [audio] = await db.select().from(radioAudioTable).where(eq(radioAudioTable.id, audioId));
    if (!playlist || !audio) {
      res.status(404).json({ message: "Playlist or audio not found" });
      return;
    }
    if (playlist.status === "archived") {
      res.status(400).json({ message: "Archived playlists cannot receive new items" });
      return;
    }
    if (!isBroadcastEligible(audio)) {
      res.status(400).json({ message: "Only approved, processed, rights-cleared audio can be added to a broadcast playlist" });
      return;
    }
    const [existing] = await db.select({ id: radioPlaylistItemsTable.id }).from(radioPlaylistItemsTable)
      .where(and(eq(radioPlaylistItemsTable.playlistId, playlistId), eq(radioPlaylistItemsTable.audioId, audioId)));
    if (existing) {
      res.status(409).json({ message: "Audio is already in this playlist" });
      return;
    }
    const [last] = await db.select({ position: sql<number>`coalesce(max(${radioPlaylistItemsTable.position}), 0)` })
      .from(radioPlaylistItemsTable).where(eq(radioPlaylistItemsTable.playlistId, playlistId));
    const weight = parseOptionalPositiveInt(req.body?.weight);
    if (weight === "invalid") {
      res.status(400).json({ message: "Playlist item weight must be a positive integer" });
      return;
    }
    if (req.body?.enabled !== undefined && typeof req.body.enabled !== "boolean") {
      res.status(400).json({ message: "Playlist item enabled value must be boolean" });
      return;
    }
    const [item] = await db.insert(radioPlaylistItemsTable).values({
      playlistId,
      audioId,
      position: Number(last?.position ?? 0) + 1,
      weight,
      enabled: req.body?.enabled !== false,
      attribution: typeof req.body?.attribution === "string" ? req.body.attribution.trim().slice(0, 500) || null : null,
    }).returning();
    await writeAuditLog(actorId(req), "radio_playlist_item_added", "radio_playlist", playlistId, { audioId });
    res.status(201).json({ item });
  } catch (err) {
    req.log.error({ err }, "Failed to add Radio playlist item");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/playlists/:id/items/:itemId", requireRadioPermission("radio.playlists.manage"), async (req, res) => {
  const playlistId = parseId(req.params.id);
  const itemId = parseId(req.params.itemId);
  if (!playlistId || !itemId) {
    res.status(400).json({ message: "Invalid playlist item ID" });
    return;
  }
  try {
    const [deleted] = await db.delete(radioPlaylistItemsTable).where(and(
      eq(radioPlaylistItemsTable.id, itemId),
      eq(radioPlaylistItemsTable.playlistId, playlistId),
    )).returning({ id: radioPlaylistItemsTable.id });
    if (!deleted) {
      res.status(404).json({ message: "Playlist item not found" });
      return;
    }
    await writeAuditLog(actorId(req), "radio_playlist_item_removed", "radio_playlist", playlistId, { itemId });
    res.json({ removed: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove Radio playlist item");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/playlists/:id/items/reorder", requireRadioPermission("radio.playlists.manage"), async (req, res) => {
  const playlistId = parseId(req.params.id);
  const audioIds: Array<number | null> = Array.isArray(req.body?.audioIds) ? req.body.audioIds.map((value: unknown) => parseId(value)) : [];
  if (!playlistId || audioIds.some((value): value is null => value === null) || new Set(audioIds).size !== audioIds.length) {
    res.status(400).json({ message: "A unique ordered list of audio IDs is required" });
    return;
  }
  try {
    const existing = await db.select({
      id: radioPlaylistItemsTable.id,
      audioId: radioPlaylistItemsTable.audioId,
    }).from(radioPlaylistItemsTable)
      .where(eq(radioPlaylistItemsTable.playlistId, playlistId));
    const existingIds = new Set(existing.map((item) => item.audioId));
    if (existingIds.size !== audioIds.length || audioIds.some((id: number | null) => !existingIds.has(id as number))) {
      res.status(400).json({ message: "Reorder must include exactly the existing playlist items" });
      return;
    }
    const itemByAudioId = new Map(existing.map((item) => [item.audioId, item]));
    await db.transaction(async (tx) => {
      const now = new Date();
      for (const [index, item] of existing.entries()) {
        await tx.update(radioPlaylistItemsTable)
          .set({ position: -(index + 1), updatedAt: now })
          .where(eq(radioPlaylistItemsTable.id, item.id));
      }
      for (const [index, audioId] of audioIds.entries()) {
        const item = itemByAudioId.get(audioId!);
        if (!item) throw new Error("Playlist reorder item disappeared");
        await tx.update(radioPlaylistItemsTable)
          .set({ position: index + 1, updatedAt: now })
          .where(eq(radioPlaylistItemsTable.id, item.id));
      }
    });
    await writeAuditLog(actorId(req), "radio_playlist_reordered", "radio_playlist", playlistId);
    res.json({ reordered: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reorder Radio playlist");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/schedules", requireRadioPermission("radio.audio.read"), async (req, res) => {
  try {
    const schedules = await db.select().from(radioSchedulesTable).orderBy(desc(radioSchedulesTable.priority), asc(radioSchedulesTable.name));
    res.json({ schedules });
  } catch (err) {
    req.log.error({ err }, "Failed to list Radio schedules");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/schedules", requireRadioPermission("radio.schedules.manage"), async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const playlistId = parseId(req.body?.playlistId);
  const timezone = req.body?.timezone ?? DEFAULT_RADIO_TIMEZONE;
  const daysOfWeek = Array.isArray(req.body?.daysOfWeek) ? req.body.daysOfWeek : [];
  const startLocalTime = req.body?.startLocalTime;
  const endLocalTime = req.body?.endLocalTime;
  const status = req.body?.status ?? "draft";
  const effectiveFrom = parseOptionalDate(req.body?.effectiveFrom);
  const effectiveUntil = parseOptionalDate(req.body?.effectiveUntil);
  if (effectiveFrom === "invalid" || effectiveUntil === "invalid") {
    res.status(400).json({ message: "Schedule effective dates must be valid dates." });
    return;
  }
  const scheduleError = scheduleValidationError({ timezone, daysOfWeek, startLocalTime, endLocalTime, effectiveFrom, effectiveUntil });
  if (!name || name.length > 200 || !playlistId || !SCHEDULE_STATUSES.includes(status) || scheduleError) {
    res.status(400).json({ message: scheduleError ?? "Invalid schedule data" });
    return;
  }
  try {
    const [playlist] = await db.select({
      id: radioPlaylistsTable.id,
      status: radioPlaylistsTable.status,
    }).from(radioPlaylistsTable).where(eq(radioPlaylistsTable.id, playlistId));
    if (!playlist) {
      res.status(400).json({ message: "Schedule playlist does not exist" });
      return;
    }
    if (status === "active" && playlist.status !== "active") {
      res.status(400).json({ message: "Active schedules must reference an active playlist" });
      return;
    }
    const [schedule] = await db.insert(radioSchedulesTable).values({
      name,
      playlistId,
      timezone,
      daysOfWeek: JSON.stringify(daysOfWeek),
      startLocalTime,
      endLocalTime,
      status,
      programName: typeof req.body?.programName === "string" ? req.body.programName.trim().slice(0, 200) || null : null,
      attribution: typeof req.body?.attribution === "string" ? req.body.attribution.trim().slice(0, 500) || null : null,
      priority: Number.isInteger(req.body?.priority) ? Math.max(0, Math.min(100, req.body.priority)) : 0,
      effectiveFrom,
      effectiveUntil,
      createdByUserId: actorId(req),
      updatedByUserId: actorId(req),
    }).returning();
    await writeAuditLog(actorId(req), "radio_schedule_created", "radio_schedule", schedule!.id);
    res.status(201).json({ schedule });
  } catch (err) {
    req.log.error({ err }, "Failed to create Radio schedule");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/schedules/:id", requireRadioPermission("radio.schedules.manage"), async (req, res) => {
  const scheduleId = parseId(req.params.id);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const playlistId = parseId(req.body?.playlistId);
  const timezone = req.body?.timezone ?? DEFAULT_RADIO_TIMEZONE;
  const daysOfWeek = Array.isArray(req.body?.daysOfWeek) ? req.body.daysOfWeek : [];
  const status = req.body?.status;
  const effectiveFrom = parseOptionalDate(req.body?.effectiveFrom);
  const effectiveUntil = parseOptionalDate(req.body?.effectiveUntil);
  if (effectiveFrom === "invalid" || effectiveUntil === "invalid") {
    res.status(400).json({ message: "Schedule effective dates must be valid dates." });
    return;
  }
  const scheduleError = scheduleValidationError({ timezone, daysOfWeek, startLocalTime: req.body?.startLocalTime, endLocalTime: req.body?.endLocalTime, effectiveFrom, effectiveUntil });
  if (!scheduleId || !name || !playlistId || !SCHEDULE_STATUSES.includes(status) || scheduleError) {
    res.status(400).json({ message: scheduleError ?? "Invalid schedule data" });
    return;
  }
  try {
    const [playlist] = await db.select({
      id: radioPlaylistsTable.id,
      status: radioPlaylistsTable.status,
    }).from(radioPlaylistsTable).where(eq(radioPlaylistsTable.id, playlistId));
    if (!playlist) {
      res.status(400).json({ message: "Schedule playlist does not exist" });
      return;
    }
    if (status === "active" && playlist.status !== "active") {
      res.status(400).json({ message: "Active schedules must reference an active playlist" });
      return;
    }
    const [schedule] = await db.update(radioSchedulesTable).set({
      name,
      playlistId,
      timezone,
      daysOfWeek: JSON.stringify(daysOfWeek),
      startLocalTime: req.body.startLocalTime,
      endLocalTime: req.body.endLocalTime,
      status,
      programName: typeof req.body?.programName === "string" ? req.body.programName.trim().slice(0, 200) || null : null,
      attribution: typeof req.body?.attribution === "string" ? req.body.attribution.trim().slice(0, 500) || null : null,
      priority: Number.isInteger(req.body?.priority) ? Math.max(0, Math.min(100, req.body.priority)) : 0,
      effectiveFrom,
      effectiveUntil,
      updatedByUserId: actorId(req),
      updatedAt: new Date(),
    }).where(eq(radioSchedulesTable.id, scheduleId)).returning();
    if (!schedule) {
      res.status(404).json({ message: "Schedule not found" });
      return;
    }
    await writeAuditLog(actorId(req), "radio_schedule_updated", "radio_schedule", scheduleId, { status });
    res.json({ schedule });
  } catch (err) {
    req.log.error({ err }, "Failed to update Radio schedule");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/emergency", requireRadioPermission("radio.emergency.read"), async (req, res) => {
  try {
    const rows = await db.select({ key: radioSettingsTable.key, value: radioSettingsTable.value })
      .from(radioSettingsTable)
      .where(sql`${radioSettingsTable.key} in ('emergency_mode', 'emergency_type', 'emergency_audio_id', 'emergency_message', 'emergency_activated_by', 'emergency_activated_at', 'emergency_deactivated_by', 'emergency_deactivated_at')`);
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    res.json({
      enabled: values.emergency_mode === "true",
      type: values.emergency_type ?? null,
      audioId: values.emergency_audio_id ? Number(values.emergency_audio_id) : null,
      message: values.emergency_message ?? null,
      activatedBy: values.emergency_activated_by ? Number(values.emergency_activated_by) : null,
      activatedAt: values.emergency_activated_at ?? null,
      deactivatedBy: values.emergency_deactivated_by ? Number(values.emergency_deactivated_by) : null,
      deactivatedAt: values.emergency_deactivated_at ?? null,
      broadcastExecution: "not_available",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to read Radio emergency state");
    res.status(500).json({ message: "Emergency state could not be loaded" });
  }
});

router.put("/emergency", requireRadioPermission("radio.emergency.manage"), async (req, res) => {
  const enabled = req.body?.enabled;
  const type = req.body?.type;
  const audioId = req.body?.audioId === null || req.body?.audioId === undefined || req.body?.audioId === "" ? null : parseId(req.body.audioId);
  const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 5_000) : "";
  if (typeof enabled !== "boolean" || !EMERGENCY_TYPES.includes(type) || (enabled && type === "playlist" && !audioId) || (enabled && type === "message" && !message)) {
    res.status(400).json({ message: "Emergency state requires a valid enabled flag, type, and content" });
    return;
  }
  try {
    if (audioId) {
      const [audio] = await db.select().from(radioAudioTable).where(eq(radioAudioTable.id, audioId));
      if (!audio || !isBroadcastEligible(audio)) {
        res.status(400).json({ message: "Emergency audio must be approved, processed, and rights-cleared" });
        return;
      }
    }
    const now = new Date().toISOString();
    const actor = String(actorId(req) ?? "");
    const values: Record<string, string> = {
      emergency_mode: String(enabled),
      emergency_type: type,
      emergency_audio_id: audioId ? String(audioId) : "",
      emergency_message: message,
      emergency_activated_by: enabled ? actor : "",
      emergency_activated_at: enabled ? now : "",
      emergency_deactivated_by: enabled ? "" : actor,
      emergency_deactivated_at: enabled ? "" : now,
    };
    await db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(values)) {
        await tx.insert(radioSettingsTable).values({ key, value, updatedAt: new Date() })
          .onConflictDoUpdate({ target: radioSettingsTable.key, set: { value, updatedAt: new Date() } });
      }
    });
    await writeAuditLog(actorId(req), enabled ? "radio_emergency_configured" : "radio_emergency_deactivated", "radio_emergency", undefined, {
      type,
      audioId,
      broadcastExecution: "not_available",
    });
    res.json({ enabled, type, audioId, message: message || null, broadcastExecution: "not_available" });
  } catch (err) {
    req.log.error({ err }, "Failed to update Radio emergency state");
    res.status(500).json({ message: "Emergency state could not be updated" });
  }
});

router.get("/settings", requireRadioPermission("radio.settings.manage"), async (req, res) => {
  try {
    const settings = await db.select({
      key: radioSettingsTable.key,
      value: radioSettingsTable.value,
      updatedAt: radioSettingsTable.updatedAt,
    }).from(radioSettingsTable).orderBy(asc(radioSettingsTable.key));
    res.json({ settings });
  } catch (err) {
    req.log.error({ err }, "Failed to read Radio settings");
    res.status(500).json({ message: "Internal server error" });
  }
});

const SAFE_SETTING_KEYS = new Set([
  "station_name",
  "enabled",
  "public_stream_url",
  "stream_hostname",
  "stream_path",
  "stream_protocol",
  "stream_format",
  "stream_bitrate_kbps",
  "status_message",
  "default_playlist_id",
  "fallback_playlist_id",
  "emergency_audio_id",
  "schedule_timezone",
  "metadata_poll_seconds",
  "configuration_version",
  "now_playing_title",
  "now_playing_artist",
  "now_playing_program",
  "now_playing_content_type",
  "now_playing_artwork_url",
  "now_playing_updated_at",
]);

router.put("/settings", requireRadioPermission("radio.settings.manage"), async (req, res) => {
  const entries = Object.entries((req.body ?? {}) as Record<string, unknown>);
  if (!entries.length || entries.length > 25 || entries.some(([key, value]) => !SAFE_SETTING_KEYS.has(key) || typeof value !== "string" || value.length > 1_000)) {
    res.status(400).json({ message: "Only approved non-secret Radio settings may be updated" });
    return;
  }
  try {
    await db.transaction(async (tx) => {
      for (const [key, rawValue] of entries) {
        const value = rawValue as string;
        await tx.insert(radioSettingsTable).values({ key, value, updatedAt: new Date() })
          .onConflictDoUpdate({ target: radioSettingsTable.key, set: { value, updatedAt: new Date() } });
      }
    });
    await writeAuditLog(actorId(req), "radio_settings_updated", "radio_settings", undefined, { keys: entries.map(([key]) => key) });
    const settings = await db.select({
      key: radioSettingsTable.key,
      value: radioSettingsTable.value,
      updatedAt: radioSettingsTable.updatedAt,
    }).from(radioSettingsTable).orderBy(asc(radioSettingsTable.key));
    res.json({ settings });
  } catch (err) {
    req.log.error({ err }, "Failed to update Radio settings");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;