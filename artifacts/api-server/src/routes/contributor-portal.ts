import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  poemsTable, poetsTable, categoriesTable, auditLogsTable, insertPoetSchema, radioAudioTable,
} from "@workspace/db/schema";
import { eq, desc, count, and } from "drizzle-orm";
import { requireContributor } from "../middlewares/adminAuth.js";
import { getMissingPoemFields } from "../lib/poemValidation.js";
import { validateAudioMetadata } from "../lib/radioValidation.js";
import { isSupportedPoemLanguage } from "../lib/adminPoemSearch.js";
import {
  acquirePoemDuplicateLock,
  duplicateConflictBody,
  findPoemDuplicateInTransaction,
} from "../lib/poemDuplicatePrevention.js";

const router: IRouter = Router();

function getUid(req: any): number {
  return (req as any).adminUser?.userId;
}

async function logAudit(
  actorUserId: number | null,
  action: string,
  targetType?: string,
  targetId?: number,
  metadata?: object,
) {
  try {
    await db.insert(auditLogsTable).values({
      actorUserId,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch { /* non-critical */ }
}

// ── GET /api/contributor/me ─────────────────────────────────────────────────
router.get("/me", requireContributor, async (req, res) => {
  try {
    const user = (req as any).adminUser;
    const uid = getUid(req);

    const [total, pending, published, rejected] = await Promise.all([
      db.select({ c: count() }).from(poemsTable).where(eq(poemsTable.createdByUserId, uid)),
      db.select({ c: count() }).from(poemsTable).where(and(eq(poemsTable.createdByUserId, uid), eq(poemsTable.status, "pending"))),
      db.select({ c: count() }).from(poemsTable).where(and(eq(poemsTable.createdByUserId, uid), eq(poemsTable.status, "published"))),
      db.select({ c: count() }).from(poemsTable).where(and(eq(poemsTable.createdByUserId, uid), eq(poemsTable.status, "rejected"))),
    ]);

    res.json({
      id: uid,
      email: user.email,
      name: user.name,
      role: user.role,
      stats: {
        total: Number(total[0]?.c ?? 0),
        pending: Number(pending[0]?.c ?? 0),
        published: Number(published[0]?.c ?? 0),
        rejected: Number(rejected[0]?.c ?? 0),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get contributor info");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Radio contributor submissions ────────────────────────────────────────────
// Contributors can submit metadata for editorial review. File transfer remains
// a separate, provider-backed operation and is intentionally not implied here.
router.get("/radio/submissions", requireContributor, async (req, res) => {
  try {
    const submissions = await db
      .select({
        id: radioAudioTable.id,
        title: radioAudioTable.title,
        titleUrdu: radioAudioTable.titleUrdu,
        description: radioAudioTable.description,
         category: radioAudioTable.category,
        originalFilename: radioAudioTable.originalFilename,
        editorialStatus: radioAudioTable.editorialStatus,
        processingStatus: radioAudioTable.processingStatus,
        rightsStatus: radioAudioTable.rightsStatus,
        rightsNotes: radioAudioTable.rightsNotes,
        rightsValidFrom: radioAudioTable.rightsValidFrom,
        rightsValidUntil: radioAudioTable.rightsValidUntil,
         rejectionReason: radioAudioTable.rejectionReason,
        createdAt: radioAudioTable.createdAt,
        updatedAt: radioAudioTable.updatedAt,
      })
      .from(radioAudioTable)
      .where(eq(radioAudioTable.createdByUserId, getUid(req)))
      .orderBy(desc(radioAudioTable.createdAt));
    res.json({ submissions });
  } catch (err) {
    req.log.error({ err }, "Failed to list contributor Radio submissions");
    res.status(500).json({ message: "Radio submissions could not be loaded" });
  }
});

router.post("/radio/submissions", requireContributor, async (req, res) => {
  const validation = validateAudioMetadata(req.body);
  if (!validation.ok) {
    res.status(400).json({ message: validation.message });
    return;
  }
  try {
    const input = validation.value;
    const [submission] = await db.insert(radioAudioTable).values({
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
      createdByUserId: getUid(req),
      editorialStatus: "draft",
      processingStatus: "not_started",
    }).returning();
    await logAudit(getUid(req), "radio_audio_submitted", "radio_audio", submission!.id, { title: submission!.title });
    res.status(201).json({ submission });
  } catch (err) {
    req.log.error({ err }, "Failed to create contributor Radio submission");
    res.status(500).json({ message: "Radio submission could not be created" });
  }
});

router.put("/radio/submissions/:id", requireContributor, async (req, res) => {
  const submissionId = Number(req.params.id);
  if (!Number.isInteger(submissionId) || submissionId < 1) {
    res.status(400).json({ message: "Invalid Radio submission ID" });
    return;
  }
  const validation = validateAudioMetadata(req.body);
  if (!validation.ok) {
    res.status(400).json({ message: validation.message });
    return;
  }
  try {
    const [existing] = await db.select().from(radioAudioTable).where(eq(radioAudioTable.id, submissionId));
    if (!existing) {
      res.status(404).json({ message: "Radio submission not found" });
      return;
    }
    if (existing.createdByUserId !== getUid(req)) {
      res.status(403).json({ message: "You can only edit your own Radio submissions" });
      return;
    }
    if (!["draft", "rejected"].includes(existing.editorialStatus)) {
      res.status(403).json({ message: "Only draft or rejected submissions can be resubmitted" });
      return;
    }
    const input = validation.value;
    const [submission] = await db.update(radioAudioTable).set({
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
      editorialStatus: "draft",
      rejectionReason: null,
      rejectedByUserId: null,
      rejectedAt: null,
      updatedAt: new Date(),
    }).where(eq(radioAudioTable.id, submissionId)).returning();
    await logAudit(getUid(req), "radio_audio_resubmitted", "radio_audio", submissionId);
    res.json({ submission });
  } catch (err) {
    req.log.error({ err }, "Failed to resubmit contributor Radio content");
    res.status(500).json({ message: "Radio submission could not be updated" });
  }
});

// ── GET /api/contributor/submissions ────────────────────────────────────────
router.get("/submissions", requireContributor, async (req, res) => {
  try {
    const uid = getUid(req);
    const { status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const parsedLimit = Math.min(parseInt(limit) || 50, 200);
    const parsedOffset = parseInt(offset) || 0;

    const conditions: ReturnType<typeof eq>[] = [eq(poemsTable.createdByUserId, uid)];
    if (status && status !== "all") conditions.push(eq(poemsTable.status, status as any));

    const [poems, totalRes] = await Promise.all([
      db.select({
        id: poemsTable.id,
        title: poemsTable.title,
        titleUrdu: poemsTable.titleUrdu,
        poetName: poemsTable.poetName,
        poetNameUrdu: poemsTable.poetNameUrdu,
        category: poemsTable.category,
        status: poemsTable.status,
        rejectionReason: poemsTable.rejectionReason,
        createdAt: poemsTable.createdAt,
        approvedAt: poemsTable.approvedAt,
        rejectedAt: poemsTable.rejectedAt,
      }).from(poemsTable)
        .where(and(...conditions))
        .orderBy(desc(poemsTable.createdAt))
        .limit(parsedLimit)
        .offset(parsedOffset),
      db.select({ c: count() }).from(poemsTable).where(and(...conditions)),
    ]);

    res.json({ poems, total: Number(totalRes[0]?.c ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Failed to get submissions");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/contributor/poems/:id ──────────────────────────────────────────
router.get("/poems/:id", requireContributor, async (req, res) => {
  try {
    const uid = getUid(req);
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

    const [poem] = await db.select().from(poemsTable).where(eq(poemsTable.id, id));
    if (!poem) { res.status(404).json({ message: "Not found" }); return; }
    if (poem.createdByUserId !== uid) { res.status(403).json({ message: "Forbidden" }); return; }

    res.json(poem);
  } catch (err) {
    req.log.error({ err }, "Failed to get poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

interface ContributorPoemBody {
  title?: string;
  titleUrdu?: string;
  content?: string;
  poetName?: string;
  poetNameUrdu?: string;
  category?: string;
  categoryUrdu?: string;
  language?: string;
  imageUrl?: string | null;
}

// ── POST /api/contributor/poems — create poem (status: pending) ─────────────
router.post("/poems", requireContributor, async (req, res) => {
  try {
    const uid = getUid(req);
    const body = req.body as ContributorPoemBody;
    const missing = getMissingPoemFields(body);
    if (missing.length > 0) {
      res.status(400).json({ message: `Missing required fields: ${missing.join(", ")}` });
      return;
    }
    if (!isSupportedPoemLanguage(body.language)) {
      res.status(400).json({ message: "Please select a supported poem language." });
      return;
    }
    const candidate = {
      title: body.title!.trim(),
      titleUrdu: body.titleUrdu!.trim(),
      content: body.content!.trim(),
      poetName: body.poetName!.trim(),
      poetNameUrdu: body.poetNameUrdu!.trim(),
      category: body.category!.trim(),
      categoryUrdu: body.categoryUrdu!.trim(),
       language: body.language!.trim(),
      imageUrl: body.imageUrl ?? null,
    };
    const result = await db.transaction(async (tx) => {
      await acquirePoemDuplicateLock(tx);
      const duplicate = await findPoemDuplicateInTransaction(tx, candidate);
      if (duplicate) return { duplicate };

      const [poem] = await tx.insert(poemsTable).values({
      ...candidate,
      status: "pending",
      createdByUserId: uid,
      featured: false,
      updatedAt: new Date(),
    } as any).returning();
      return { poem };
    });
    if ("duplicate" in result) {
      const actor = (req as any).adminUser;
      res.status(409).json(duplicateConflictBody(result.duplicate!, {
        role: "contributor",
        userId: actor.userId,
      }));
      return;
    }
    const poem = result.poem!;
    await logAudit(uid, "poem_submitted", "poem", poem!.id, { title: poem!.title });
    res.status(201).json(poem);
  } catch (err) {
    req.log.error({ err }, "Failed to create poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── PUT /api/contributor/poems/:id — edit own pending/draft/rejected poem ───
router.put("/poems/:id", requireContributor, async (req, res) => {
  try {
    const uid = getUid(req);
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

    const body = req.body as ContributorPoemBody;
    const missing = getMissingPoemFields(body);
    if (missing.length > 0) {
      res.status(400).json({ message: `Missing required fields: ${missing.join(", ")}` });
      return;
    }
    if (!isSupportedPoemLanguage(body.language)) {
      res.status(400).json({ message: "Please select a supported poem language." });
      return;
    }

    const actor = (req as any).adminUser;
    const candidate = {
      titleUrdu: body.titleUrdu!.trim(),
      poetName: body.poetName!.trim(),
      poetNameUrdu: body.poetNameUrdu!.trim(),
      content: body.content!.trim(),
      language: body.language!.trim(),
    };
    const result = await db.transaction(async (tx) => {
      await acquirePoemDuplicateLock(tx);
      const [existing] = await tx.select().from(poemsTable).where(eq(poemsTable.id, id));
      if (!existing) return { notFound: true as const };
      if (existing.createdByUserId !== uid) return { forbidden: true as const };
      if (existing.status === "published") return { published: true as const };

      const duplicate = await findPoemDuplicateInTransaction(tx, candidate, {
        excludeId: id,
        previous: existing,
      });
      if (duplicate) return { duplicate };

      const newStatus = existing.status === "rejected" ? "pending" : existing.status;
      const clearRejection = existing.status === "rejected"
        ? { rejectedByUserId: null, rejectedAt: null, rejectionReason: null }
        : {};
      const [poem] = await tx.update(poemsTable).set({
        title: body.title!.trim(),
        ...candidate,
        category: body.category!.trim(),
        categoryUrdu: body.categoryUrdu!.trim(),
        imageUrl: body.imageUrl ?? null,
        status: newStatus as any,
        ...clearRejection,
        updatedAt: new Date(),
      } as any).where(eq(poemsTable.id, id)).returning();
      return { poem, newStatus };
    });
    if ("notFound" in result) { res.status(404).json({ message: "Not found" }); return; }
    if ("forbidden" in result) { res.status(403).json({ message: "Forbidden — not your poem" }); return; }
    if ("published" in result) { res.status(403).json({ message: "Cannot edit a published poem" }); return; }
    if ("duplicate" in result) {
      res.status(409).json(duplicateConflictBody(result.duplicate!, {
        role: "contributor",
        userId: actor.userId,
      }));
      return;
    }

    await logAudit(uid, "poem_edited", "poem", id, { newStatus: result.newStatus });
    res.json(result.poem);
  } catch (err) {
    req.log.error({ err }, "Failed to update poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DELETE /api/contributor/poems/:id — delete own draft only ───────────────
router.delete("/poems/:id", requireContributor, async (req, res) => {
  try {
    const uid = getUid(req);
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

    const [existing] = await db.select().from(poemsTable).where(eq(poemsTable.id, id));
    if (!existing) { res.status(404).json({ message: "Not found" }); return; }
    if (existing.createdByUserId !== uid) { res.status(403).json({ message: "Forbidden" }); return; }
    if (existing.status !== "draft") { res.status(403).json({ message: "Can only delete draft poems" }); return; }

    await db.delete(poemsTable).where(eq(poemsTable.id, id));
    res.json({ message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/contributor/poets — list all poets for selection ────────────────
router.get("/poets", requireContributor, async (req, res) => {
  try {
    const poets = await db.select({
      id: poetsTable.id,
      name: poetsTable.name,
      nameUrdu: poetsTable.nameUrdu,
      era: poetsTable.era,
    }).from(poetsTable).orderBy(poetsTable.name);
    res.json({ poets });
  } catch (err) {
    req.log.error({ err }, "Failed to list poets");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/contributor/poets — create new poet ────────────────────────────
router.post("/poets", requireContributor, async (req, res) => {
  try {
    const uid = getUid(req);
    const parsed = insertPoetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid poet data", errors: parsed.error.issues });
      return;
    }
    const [poet] = await db.insert(poetsTable).values(parsed.data).returning();
    await logAudit(uid, "poet_created", "poet", poet!.id, { name: poet!.name });
    res.status(201).json(poet);
  } catch (err) {
    req.log.error({ err }, "Failed to create poet");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/contributor/categories ──────────────────────────────────────────
router.get("/categories", requireContributor, async (req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    res.json({ categories });
  } catch (err) {
    req.log.error({ err }, "Failed to list categories");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
