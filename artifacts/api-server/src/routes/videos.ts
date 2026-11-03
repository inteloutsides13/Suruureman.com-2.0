import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { videosTable, insertVideoSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth.js";

const router: IRouter = Router();

function extractYoutubeId(input: string): string {
  if (!input) return input;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1).split("?")[0];
    }
    const v = url.searchParams.get("v");
    if (v) return v;
  } catch {
    // not a URL, return as-is
  }
  return trimmed;
}

const mapVideo = (v: typeof videosTable.$inferSelect) => ({
  id: v.id,
  title: v.title,
  titleUrdu: v.titleUrdu,
  description: v.description,
  youtubeId: v.youtubeId,
  thumbnailUrl: v.thumbnailUrl ?? null,
  duration: v.duration,
});

router.get("/", async (req, res) => {
  try {
    const videos = await db.select().from(videosTable);
    res.json({ videos: videos.map(mapVideo) });
  } catch (err) {
    req.log.error({ err }, "Failed to list videos");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid video ID" });
      return;
    }
    const [video] = await db.select().from(videosTable).where(eq(videosTable.id, id));
    if (!video) {
      res.status(404).json({ message: "Video not found" });
      return;
    }
    res.json(mapVideo(video));
  } catch (err) {
    req.log.error({ err }, "Failed to get video");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const body = { ...req.body, youtubeId: extractYoutubeId(req.body.youtubeId || "") };
    const parsed = insertVideoSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid video data" });
      return;
    }
    const [video] = await db.insert(videosTable).values(parsed.data).returning();
    res.status(201).json(mapVideo(video!));
  } catch (err) {
    req.log.error({ err }, "Failed to create video");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid video ID" });
      return;
    }
    const body = { ...req.body, youtubeId: extractYoutubeId(req.body.youtubeId || "") };
    const parsed = insertVideoSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid video data" });
      return;
    }
    const [video] = await db
      .update(videosTable)
      .set(parsed.data)
      .where(eq(videosTable.id, id))
      .returning();
    if (!video) {
      res.status(404).json({ message: "Video not found" });
      return;
    }
    res.json(mapVideo(video));
  } catch (err) {
    req.log.error({ err }, "Failed to update video");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid video ID" });
      return;
    }
    const [deleted] = await db
      .delete(videosTable)
      .where(eq(videosTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ message: "Video not found" });
      return;
    }
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete video");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
