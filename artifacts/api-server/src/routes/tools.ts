import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { toolsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin, requireDeveloper } from "../middlewares/adminAuth.js";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const tools = await db
      .select()
      .from(toolsTable)
      .where(eq(toolsTable.active, true))
      .orderBy(asc(toolsTable.displayOrder), asc(toolsTable.createdAt));
    res.json({ tools });
  } catch (err) {
    req.log.error({ err }, "Failed to list tools");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const tools = await db
      .select()
      .from(toolsTable)
      .orderBy(asc(toolsTable.displayOrder), asc(toolsTable.createdAt));
    res.json({ tools });
  } catch (err) {
    req.log.error({ err }, "Failed to list tools");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin", requireDeveloper, async (req, res) => {
  try {
    const { title, titleUrdu, description, descriptionUrdu, url, active, displayOrder } =
      req.body as {
        title?: string; titleUrdu?: string; description?: string;
        descriptionUrdu?: string; url?: string; active?: boolean; displayOrder?: number;
      };
    if (!title || !url) {
      res.status(400).json({ message: "Title and URL are required" });
      return;
    }
    const [tool] = await db.insert(toolsTable).values({
      title,
      titleUrdu: titleUrdu || "",
      description: description || "",
      descriptionUrdu: descriptionUrdu || "",
      url,
      active: active !== false,
      displayOrder: displayOrder ?? 0,
    }).returning();
    res.status(201).json({ tool });
  } catch (err) {
    req.log.error({ err }, "Failed to create tool");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/admin/:id", requireDeveloper, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
    const { title, titleUrdu, description, descriptionUrdu, url, active, displayOrder } =
      req.body as {
        title?: string; titleUrdu?: string; description?: string;
        descriptionUrdu?: string; url?: string; active?: boolean; displayOrder?: number;
      };
    const updates: Partial<typeof toolsTable.$inferInsert> = {};
    if (title !== undefined) updates.title = title;
    if (titleUrdu !== undefined) updates.titleUrdu = titleUrdu;
    if (description !== undefined) updates.description = description;
    if (descriptionUrdu !== undefined) updates.descriptionUrdu = descriptionUrdu;
    if (url !== undefined) updates.url = url;
    if (active !== undefined) updates.active = active;
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "Nothing to update" });
      return;
    }
    const [tool] = await db.update(toolsTable).set(updates).where(eq(toolsTable.id, id)).returning();
    if (!tool) { res.status(404).json({ message: "Tool not found" }); return; }
    res.json({ tool });
  } catch (err) {
    req.log.error({ err }, "Failed to update tool");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/admin/:id", requireDeveloper, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
    const [deleted] = await db.delete(toolsTable).where(eq(toolsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ message: "Tool not found" }); return; }
    res.json({ message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete tool");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
