import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable, poemsTable, insertCategorySchema } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth.js";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const categories = await db.select().from(categoriesTable);
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const [result] = await db
          .select({ count: count() })
          .from(poemsTable)
          .where(eq(poemsTable.category, cat.slug));
        return {
          id: cat.id,
          name: cat.name,
          nameUrdu: cat.nameUrdu,
          slug: cat.slug,
          description: cat.description,
          poemCount: result?.count ?? 0,
        };
      })
    );
    res.json({ categories: withCounts });
  } catch (err) {
    req.log.error({ err }, "Failed to list categories");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid category data" });
      return;
    }
    const [cat] = await db.insert(categoriesTable).values(parsed.data).returning();
    res.status(201).json({ ...cat!, poemCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create category");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid category data" }); return; }
    const [cat] = await db.update(categoriesTable).set(parsed.data).where(eq(categoriesTable.id, id)).returning();
    if (!cat) { res.status(404).json({ message: "Category not found" }); return; }
    res.json(cat);
  } catch (err) {
    req.log.error({ err }, "Failed to update category");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    if (!cat) { res.status(404).json({ message: "Category not found" }); return; }
    const [inUse] = await db.select({ count: count() }).from(poemsTable).where(eq(poemsTable.category, cat.slug));
    if ((inUse?.count ?? 0) > 0) {
      res.status(409).json({ message: `Cannot delete: ${inUse?.count} poems use this category` });
      return;
    }
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete category");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
