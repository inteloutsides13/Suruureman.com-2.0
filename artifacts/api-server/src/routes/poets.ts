import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { poetsTable, poemsTable, insertPoetSchema } from "@workspace/db/schema";
import { eq, count, inArray } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth.js";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const poets = await db.select().from(poetsTable);

    const poetNames = poets.map((p) => p.name);
    const poemCounts =
      poetNames.length > 0
        ? await db
            .select({ poetName: poemsTable.poetName, cnt: count() })
            .from(poemsTable)
            .where(inArray(poemsTable.poetName, poetNames))
            .groupBy(poemsTable.poetName)
        : [];

    const countMap = new Map(poemCounts.map((r) => [r.poetName, r.cnt]));

    const withCounts = poets.map((poet) => ({
      id: poet.id,
      name: poet.name,
      nameUrdu: poet.nameUrdu,
      bio: poet.bio,
      bioUrdu: poet.bioUrdu,
      era: poet.era,
      poemCount: countMap.get(poet.name) ?? 0,
    }));

    res.json({ poets: withCounts });
  } catch (err) {
    req.log.error({ err }, "Failed to list poets");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid poet ID" });
      return;
    }

    const [poet] = await db.select().from(poetsTable).where(eq(poetsTable.id, id));

    if (!poet) {
      res.status(404).json({ message: "Poet not found" });
      return;
    }

    const [result] = await db
      .select({ count: count() })
      .from(poemsTable)
      .where(eq(poemsTable.poetName, poet.name));

    res.json({
      id: poet.id,
      name: poet.name,
      nameUrdu: poet.nameUrdu,
      bio: poet.bio,
      bioUrdu: poet.bioUrdu,
      era: poet.era,
      poemCount: result?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get poet");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const parsed = insertPoetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid poet data" });
      return;
    }
    const [poet] = await db.insert(poetsTable).values(parsed.data).returning();
    res.status(201).json({ ...poet!, poemCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create poet");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid poet ID" });
      return;
    }
    const parsed = insertPoetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid poet data" });
      return;
    }
    const [poet] = await db
      .update(poetsTable)
      .set(parsed.data)
      .where(eq(poetsTable.id, id))
      .returning();
    if (!poet) {
      res.status(404).json({ message: "Poet not found" });
      return;
    }
    res.json({ ...poet, poemCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to update poet");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid poet ID" });
      return;
    }
    const [deleted] = await db
      .delete(poetsTable)
      .where(eq(poetsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ message: "Poet not found" });
      return;
    }
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete poet");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
