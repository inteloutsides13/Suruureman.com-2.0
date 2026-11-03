import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { poemsTable, insertPoemSchema, eventsTable } from "@workspace/db/schema";
import { eq, desc, count, sql, and, inArray, asc, type SQL } from "drizzle-orm";
import { hasActivePrivilegedSession, requireAdmin } from "../middlewares/adminAuth.js";
import { getMissingPoemFields } from "../lib/poemValidation.js";
import { isSupportedPoemLanguage } from "../lib/adminPoemSearch.js";
import { poemLanguageFilterValues, poemLanguageMatchesFilter } from "../lib/poemLanguageAliases.js";
import {
  buildPoemVisibilityWhere,
  filterPoemsForVisibility,
  isPoemVisible,
  mapPublicPoem,
} from "../lib/poemVisibility.js";
import { getDailyPoemStartIndex, getFirstFourUrduLines, getUtcDayKey } from "../lib/dailyPoem.js";
import {
  acquirePoemDuplicateLock,
  duplicateConflictBody,
  findPoemDuplicateInTransaction,
} from "../lib/poemDuplicatePrevention.js";

const router: IRouter = Router();
type DailyPoemResult = {
  day: string;
  poem: null | {
    id: number;
    titleUrdu: string;
    poetNameUrdu: string;
    lines: string[];
  };
};
const dailyPoemCache = new Map<string, Promise<DailyPoemResult>>();
const DAILY_POEM_BATCH_SIZE = 32;

async function loadDailyPoem(day: string): Promise<DailyPoemResult> {
  const conditions = and(eq(poemsTable.status, "published"), eq(poemsTable.language, "urdu"));
  const [{ total }] = await db.select({ total: count() }).from(poemsTable).where(conditions);
  const totalPoems = Number(total);
  if (!Number.isSafeInteger(totalPoems) || totalPoems <= 0) return { day, poem: null };

  let cursor = getDailyPoemStartIndex(day, totalPoems);
  let checked = 0;
  while (checked < totalPoems) {
    if (cursor >= totalPoems) cursor = 0;
    const batchSize = Math.min(DAILY_POEM_BATCH_SIZE, totalPoems - cursor, totalPoems - checked);
    const candidates = await db.select({
      id: poemsTable.id,
      titleUrdu: poemsTable.titleUrdu,
      poetNameUrdu: poemsTable.poetNameUrdu,
      content: poemsTable.content,
    })
      .from(poemsTable)
      .where(conditions)
      .orderBy(asc(poemsTable.id))
      .limit(batchSize)
      .offset(cursor);

    for (const candidate of candidates) {
      const lines = getFirstFourUrduLines(candidate.content);
      if (lines) {
        return {
          day,
          poem: {
            id: candidate.id,
            titleUrdu: candidate.titleUrdu,
            poetNameUrdu: candidate.poetNameUrdu,
            lines,
          },
        };
      }
    }
    checked += candidates.length;
    cursor += candidates.length;
    if (candidates.length === 0) break;
  }

  return { day, poem: null };
}

router.get("/", async (req, res) => {
  try {
    const {
      category, featured, limit = "20", offset = "0",
      poetName, search, sort, visualPoetry, language,
    } = req.query as Record<string, string>;

    if (language !== undefined && !isSupportedPoemLanguage(language)) {
      res.status(400).json({ message: "Unsupported poem language." });
      return;
    }

    const canViewUnpublished = await hasActivePrivilegedSession(req);
    const visibilityWhere = buildPoemVisibilityWhere(canViewUnpublished);
    const parsedLimit = Math.min(parseInt(limit) || 20, 2000);
    const parsedOffset = parseInt(offset) || 0;

    if (search?.trim()) {
      const term = search.trim().toLowerCase();
      const allPoems = await db.select().from(poemsTable).where(visibilityWhere);

      const scored = filterPoemsForVisibility(allPoems, canViewUnpublished)
        .map((p) => {
          let score = 0;
          const tl = p.title.toLowerCase();
          const tu = p.titleUrdu;
          const pl = p.poetName.toLowerCase();
          const pu = p.poetNameUrdu;
          const cl = p.content.toLowerCase();
          const cu = p.content;
          if (tl === term || tu === term) score += 100;
          else if (tl.includes(term) || tu.includes(term)) score += 50;
          if (pl === term || pu === term) score += 40;
          else if (pl.includes(term) || pu.includes(term)) score += 20;
          if (cl.includes(term) || cu.includes(term)) score += 5;
          return { poem: p, score };
        })
        .filter((x) => x.score > 0 && (!language || poemLanguageMatchesFilter(x.poem.language, language)))
        .sort((a, b) => b.score - a.score);

      const total = scored.length;
      const paged = scored.slice(parsedOffset, parsedOffset + parsedLimit).map((x) => mapPublicPoem(x.poem));
      res.json({ poems: paged, total });
      return;
    }

    const conditions: SQL[] = [];

    if (visibilityWhere) conditions.push(visibilityWhere);

    if (category) conditions.push(eq(poemsTable.category, category));
    if (featured === "true") conditions.push(eq(poemsTable.featured, true));
    if (poetName) conditions.push(eq(poemsTable.poetName, poetName));
    if (visualPoetry === "true") conditions.push(eq(poemsTable.visualPoetry, true));
    if (language) conditions.push(inArray(poemsTable.language, poemLanguageFilterValues(language)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let orderBy: SQL<unknown>[];
    if (sort === "latest") {
      orderBy = [desc(poemsTable.updatedAt), desc(poemsTable.createdAt), desc(poemsTable.id)];
    } else if (sort === "popular") {
      orderBy = [desc(sql`${poemsTable.likes} * 3 + ${poemsTable.views}`)];
    } else if (sort === "likes") {
      orderBy = [desc(poemsTable.likes)];
    } else if (sort === "views") {
      orderBy = [desc(poemsTable.views)];
    } else {
      orderBy = [desc(poemsTable.createdAt)];
    }

    const [poems, totalResult] = await Promise.all([
      db.select().from(poemsTable).where(whereClause).orderBy(...orderBy).limit(parsedLimit).offset(parsedOffset),
      db.select({ count: count() }).from(poemsTable).where(whereClause),
    ]);

    res.json({ poems: poems.map(mapPublicPoem), total: totalResult[0]?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to list poems");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/daily", async (req, res) => {
  const now = new Date();
  const day = getUtcDayKey(now);
  let selection = dailyPoemCache.get(day);
  if (!selection) {
    selection = loadDailyPoem(day);
    dailyPoemCache.set(day, selection);
    // Bound cache growth while retaining the current selection across requests.
    for (const cachedDay of dailyPoemCache.keys()) {
      if (cachedDay !== day) dailyPoemCache.delete(cachedDay);
    }
  }

  try {
    const nextUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const secondsUntilRollover = Math.max(0, Math.floor((nextUtcMidnight - now.getTime()) / 1000));
    res.setHeader("Cache-Control", `public, max-age=${secondsUntilRollover}, s-maxage=${secondsUntilRollover}`);
    res.json(await selection);
  } catch (err) {
    dailyPoemCache.delete(day);
    req.log.error({ err }, "Failed to load daily poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid poem ID" }); return; }
    const canViewUnpublished = await hasActivePrivilegedSession(req);
    const [poem] = await db.select().from(poemsTable).where(eq(poemsTable.id, id));
    if (!poem || !isPoemVisible((poem as any).status, canViewUnpublished)) {
      res.status(404).json({ message: "Poem not found" });
      return;
    }
    if (process.env.MIGRATION_DATABASE_STRATEGY === "reuse-original"
      && process.env.MIGRATION_DATABASE_READ_ONLY !== "false") {
      res.json(mapPublicPoem(poem));
      return;
    }
    await Promise.all([
      db.update(poemsTable).set({ views: sql`${poemsTable.views} + 1` }).where(eq(poemsTable.id, id)),
      db.insert(eventsTable).values({ type: "view", poemId: id }),
    ]);
    res.json(mapPublicPoem({ ...poem, views: poem.views + 1 }));
  } catch (err) {
    req.log.error({ err }, "Failed to get poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/like", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid poem ID" }); return; }
    const [poem] = await db.update(poemsTable).set({ likes: sql`${poemsTable.likes} + 1` }).where(eq(poemsTable.id, id)).returning();
    if (!poem) { res.status(404).json({ message: "Poem not found" }); return; }
    await db.insert(eventsTable).values({ type: "like", poemId: id });
    res.json({ likes: poem.likes });
  } catch (err) {
    req.log.error({ err }, "Failed to like poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/unlike", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid poem ID" }); return; }
    const [poem] = await db.update(poemsTable).set({ likes: sql`GREATEST(${poemsTable.likes} - 1, 0)` }).where(eq(poemsTable.id, id)).returning();
    if (!poem) { res.status(404).json({ message: "Poem not found" }); return; }
    res.json({ likes: poem.likes });
  } catch (err) {
    req.log.error({ err }, "Failed to unlike poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/share", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid poem ID" }); return; }
    const [poem] = await db.update(poemsTable).set({ shares: sql`${poemsTable.shares} + 1` }).where(eq(poemsTable.id, id)).returning();
    if (!poem) { res.status(404).json({ message: "Poem not found" }); return; }
    await db.insert(eventsTable).values({ type: "share", poemId: id });
    res.json({ shares: poem.shares });
  } catch (err) {
    req.log.error({ err }, "Failed to track share");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/:id/visual", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid poem ID" }); return; }
    const { visualPoetry, imageUrl } = req.body as { visualPoetry?: boolean; imageUrl?: string | null };
    const update: Record<string, unknown> = {};
    if (visualPoetry !== undefined) update.visualPoetry = visualPoetry;
    if (imageUrl !== undefined) update.imageUrl = imageUrl;
    update.updatedAt = new Date();
    const [poem] = await db.update(poemsTable).set(update).where(eq(poemsTable.id, id)).returning();
    if (!poem) { res.status(404).json({ message: "Poem not found" }); return; }
    res.json(mapPublicPoem(poem));
  } catch (err) {
    req.log.error({ err }, "Failed to update visual poetry");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const missing = getMissingPoemFields(req.body);
    if (missing.length > 0) {
      res.status(400).json({
        message: "Please complete all required fields before saving the poem.",
        missingFields: missing,
      });
      return;
    }
    if (!isSupportedPoemLanguage(req.body?.language)) {
      res.status(400).json({ message: "Please select a supported poem language." });
      return;
    }
    const parsed = insertPoemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid poem data", errors: parsed.error.issues });
      return;
    }
    const adminUser = (req as any).adminUser;
    const candidate = { ...parsed.data, language: parsed.data.language! };
    const result = await db.transaction(async (tx) => {
      await acquirePoemDuplicateLock(tx);
      const duplicate = await findPoemDuplicateInTransaction(tx, candidate);
      if (duplicate) return { duplicate };

      const [poem] = await tx.insert(poemsTable).values({
        ...candidate,
        status: "published",
        createdByUserId: adminUser?.userId ?? null,
      } as any).returning();
      return { poem };
    });
    if ("duplicate" in result) {
      res.status(409).json(duplicateConflictBody(result.duplicate!, {
        role: adminUser.role,
        userId: adminUser.userId,
      }));
      return;
    }
    res.status(201).json(mapPublicPoem(result.poem!));
  } catch (err) {
    req.log.error({ err }, "Failed to create poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid poem ID" }); return; }
    const missing = getMissingPoemFields(req.body);
    if (missing.length > 0) {
      res.status(400).json({
        message: "Please complete all required fields before saving the poem.",
        missingFields: missing,
      });
      return;
    }
    if (!isSupportedPoemLanguage(req.body?.language)) {
      res.status(400).json({ message: "Please select a supported poem language." });
      return;
    }
    const parsed = insertPoemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid poem data", errors: parsed.error.issues });
      return;
    }
    const adminUser = (req as any).adminUser;
    const candidate = { ...parsed.data, language: parsed.data.language! };
    const result = await db.transaction(async (tx) => {
      await acquirePoemDuplicateLock(tx);
      const [previous] = await tx.select().from(poemsTable).where(eq(poemsTable.id, id));
      if (!previous) return { notFound: true as const };
      const duplicate = await findPoemDuplicateInTransaction(tx, candidate, {
        excludeId: id,
        previous,
      });
      if (duplicate) return { duplicate };

      const [poem] = await tx.update(poemsTable).set({
        ...candidate,
        updatedAt: new Date(),
      } as any).where(eq(poemsTable.id, id)).returning();
      return { poem };
    });
    if ("notFound" in result) { res.status(404).json({ message: "Poem not found" }); return; }
    if ("duplicate" in result) {
      res.status(409).json(duplicateConflictBody(result.duplicate!, {
        role: adminUser.role,
        userId: adminUser.userId,
      }));
      return;
    }
    res.json(mapPublicPoem(result.poem!));
  } catch (err) {
    req.log.error({ err }, "Failed to update poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid poem ID" }); return; }
    const [deleted] = await db.delete(poemsTable).where(eq(poemsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ message: "Poem not found" }); return; }
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
