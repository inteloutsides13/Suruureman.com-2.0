import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { radioManifestsTable, radioPlayHistoryTable } from "@workspace/db/schema";
import { requireRadioMachineAuth } from "../lib/radioMachineAuth.js";
import { writeAuditLog } from "../lib/audit.js";

const router: IRouter = Router();
router.use(requireRadioMachineAuth);

router.get("/manifest", async (req, res) => {
  try {
    const [manifest] = await db.select({
      version: radioManifestsTable.version,
      payload: radioManifestsTable.payload,
      sha256: radioManifestsTable.sha256,
      publishedAt: radioManifestsTable.publishedAt,
    }).from(radioManifestsTable)
      .where(eq(radioManifestsTable.status, "active"))
      .orderBy(desc(radioManifestsTable.version))
      .limit(1);

    if (!manifest) {
      res.status(404).json({ message: "No active Radio manifest" });
      return;
    }
    res.json({ manifest });
  } catch (err) {
    req.log.error({ err }, "Failed to read Radio manifest");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/events", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const eventType = body.eventType;
  if (eventType !== "playback_started" && eventType !== "playback_completed" && eventType !== "playback_failed" && eventType !== "playback_skipped") {
    res.status(400).json({ message: "Invalid Radio event type" });
    return;
  }

  const parseDate = (value: unknown, fallback?: Date): Date | null => {
    if (value === undefined && fallback) return fallback;
    if (typeof value !== "string") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const startedAt = parseDate(body.startedAt, new Date());
  const endedAt = body.endedAt === undefined ? null : parseDate(body.endedAt);
  const manifestVersion = Number(body.manifestVersion);
  if (!startedAt || !Number.isInteger(manifestVersion) || manifestVersion < 1 || (body.endedAt !== undefined && !endedAt)) {
    res.status(400).json({ message: "Invalid Radio event fields" });
    return;
  }

  const audioId = body.audioId === undefined ? null : Number(body.audioId);
  const playlistId = body.playlistId === undefined ? null : Number(body.playlistId);
  const scheduleId = body.scheduleId === undefined ? null : Number(body.scheduleId);
  if ([audioId, playlistId, scheduleId].some((value) => value !== null && (!Number.isInteger(value) || value < 1))) {
    res.status(400).json({ message: "Invalid Radio event resource ID" });
    return;
  }

  try {
    const [history] = await db.insert(radioPlayHistoryTable).values({
      audioId,
      playlistId,
      scheduleId,
      manifestVersion,
      startedAt,
      endedAt,
      expectedDurationMs: typeof body.expectedDurationMs === "number" ? body.expectedDurationMs : null,
      actualDurationMs: typeof body.actualDurationMs === "number" ? body.actualDurationMs : null,
      result:
        eventType === "playback_started"
          ? "started"
          : eventType === "playback_completed"
            ? "completed"
            : eventType === "playback_failed"
              ? "failed"
              : "skipped",
      failureCode: typeof body.failureCode === "string" ? body.failureCode.slice(0, 200) : null,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata as Record<string, unknown> : null,
    }).returning({ id: radioPlayHistoryTable.id });
    await writeAuditLog(null, "radio_playback_event", "radio_play_history", history!.id, {
      eventType,
      manifestVersion,
      audioId,
    });
    res.status(202).json({ accepted: true, historyId: history!.id });
  } catch (err) {
    req.log.error({ err }, "Failed to record Radio event");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/cache-report", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const status = body.status;
  const manifestVersion = Number(body.manifestVersion);
  if (!["healthy", "degraded", "failed"].includes(String(status)) || !Number.isInteger(manifestVersion) || manifestVersion < 1) {
    res.status(400).json({ message: "Invalid Radio cache report" });
    return;
  }
  await writeAuditLog(null, "radio_cache_report", "radio_cache", undefined, {
    status,
    manifestVersion,
    cachedCount: typeof body.cachedCount === "number" ? body.cachedCount : null,
    failedCount: typeof body.failedCount === "number" ? body.failedCount : null,
  });
  res.status(202).json({ accepted: true });
});

export default router;