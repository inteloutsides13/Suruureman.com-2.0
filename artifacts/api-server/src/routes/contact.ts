import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactMessagesTable, insertContactMessageSchema } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth.js";

const router: IRouter = Router();

router.post("/", async (req, res) => {
  try {
    const parsed = insertContactMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Name, email, and message are required" });
      return;
    }
    const [msg] = await db.insert(contactMessagesTable).values(parsed.data).returning();
    res.status(201).json({ message: "Message sent successfully", id: msg!.id });
  } catch (err) {
    req.log.error({ err }, "Failed to save contact message");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/messages", requireAdmin, async (req, res) => {
  try {
    const messages = await db.select().from(contactMessagesTable).orderBy(desc(contactMessagesTable.createdAt));
    res.json({ messages });
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/messages/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
    const [deleted] = await db.delete(contactMessagesTable).where(eq(contactMessagesTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ message: "Message not found" }); return; }
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete message");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
