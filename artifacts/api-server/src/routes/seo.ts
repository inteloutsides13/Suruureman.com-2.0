import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { poemsTable, poetsTable } from "@workspace/db/schema";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { mapPublicPoem } from "../lib/poemVisibility.js";

const router: IRouter = Router();
const DEFAULT_POET_POEM_LIMIT = 12;
const MAX_POET_POEM_LIMIT = 2000;
const MAX_OFFSET = 2_147_483_647;

function parsePositiveId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= MAX_OFFSET ? id : null;
}

function parseBoundedQueryInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

router.get("/poems/:id", async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    res.status(400).json({ message: "Invalid poem ID" });
    return;
  }

  try {
    const [poem] = await db
      .select()
      .from(poemsTable)
      .where(and(eq(poemsTable.id, id), eq(poemsTable.status, "published")));

    if (!poem) {
      res.status(404).json({ message: "Poem not found" });
      return;
    }

    res.json(mapPublicPoem(poem));
  } catch (err) {
    req.log.error({ err }, "Failed to get public SEO poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/poets", async (req, res) => {
  try {
    // Deliberately keep the same un-ordered poet select as the existing public list.
    const poets = await db.select().from(poetsTable);
    const poetNames = poets.map((poet) => poet.name);
    const counts =
      poetNames.length > 0
        ? await db
            .select({ poetName: poemsTable.poetName, total: count() })
            .from(poemsTable)
            .where(
              and(
                eq(poemsTable.status, "published"),
                inArray(poemsTable.poetName, poetNames),
              ),
            )
            .groupBy(poemsTable.poetName)
        : [];

    const countByPoet = new Map(
      counts.map((row) => [row.poetName, Number(row.total)]),
    );

    res.json({
      poets: poets.map((poet) => ({
        id: poet.id,
        name: poet.name,
        nameUrdu: poet.nameUrdu,
        bio: poet.bio,
        bioUrdu: poet.bioUrdu,
        era: poet.era,
        poemCount: countByPoet.get(poet.name) ?? 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list public SEO poets");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/poets/:id", async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    res.status(400).json({ message: "Invalid poet ID" });
    return;
  }

  const limit = parseBoundedQueryInteger(
    req.query.limit,
    DEFAULT_POET_POEM_LIMIT,
    1,
    MAX_POET_POEM_LIMIT,
  );
  const offset = parseBoundedQueryInteger(req.query.offset, 0, 0, MAX_OFFSET);
  if (limit === null || offset === null) {
    res.status(400).json({ message: "Invalid pagination parameters" });
    return;
  }

  try {
    const [poet] = await db
      .select()
      .from(poetsTable)
      .where(eq(poetsTable.id, id));

    if (!poet) {
      res.status(404).json({ message: "Poet not found" });
      return;
    }

    const publishedPoetWhere = and(
      eq(poemsTable.poetName, poet.name),
      eq(poemsTable.status, "published"),
    );
    const [poems, totalRows] = await Promise.all([
      db
        .select()
        .from(poemsTable)
        .where(publishedPoetWhere)
        .orderBy(desc(poemsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(poemsTable)
        .where(publishedPoetWhere),
    ]);
    const poemCount = Number(totalRows[0]?.total ?? 0);

    res.json({
      id: poet.id,
      name: poet.name,
      nameUrdu: poet.nameUrdu,
      bio: poet.bio,
      bioUrdu: poet.bioUrdu,
      era: poet.era,
      poemCount,
      poems: poems.map(mapPublicPoem),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get public SEO poet");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
