import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  poemsTable, poetsTable, videosTable, eventsTable,
  categoriesTable, settingsTable, backupsTable, contactMessagesTable,
  usersTable, auditLogsTable, toolsTable,
  radioAudioTable, radioPlaylistItemsTable, radioPlaylistsTable, radioSchedulesTable,
} from "@workspace/db/schema";
import { count, sum, desc, sql, and, gte, lte, eq, asc, or, ilike, inArray } from "drizzle-orm";
import { JWT_SECRET, requireAdmin, requireDeveloper } from "../middlewares/adminAuth.js";
import type { AdminPayload } from "../middlewares/adminAuth.js";
import { adminLoginRateLimit } from "../lib/rateLimit.js";
import { ListAdminPoemsResponse } from "@workspace/api-zod";
import {
  buildAdminPoemSearchWhereClause,
  parseAdminPoemsQuery,
} from "../lib/adminPoemSearch.js";
import {
  acquirePoemDuplicateLock,
  duplicateConflictBody,
  findPoemDuplicateInTransaction,
} from "../lib/poemDuplicatePrevention.js";
import {
  createBackupSnapshot,
  describeBackupData,
  hasRestoreConfirmation,
  mergeBackupDatasets,
  parseBackupData,
} from "../lib/backup-snapshots.js";

const router: IRouter = Router();

// ── GET /api/admin/poems ──────────────────────────────────────────────────────
router.get("/poems", requireAdmin, async (req, res): Promise<void> => {
  try {
    const query = parseAdminPoemsQuery(req.query);
    if (!query) {
      res.status(400).json({ message: "Invalid poem search or filter parameters." });
      return;
    }
    const whereClause = buildAdminPoemSearchWhereClause(query.search, query.language);
    const contributorJoin = and(
      eq(poemsTable.createdByUserId, usersTable.id),
      eq(usersTable.role, "contributor"),
    );

    const [poems, totalResult] = await Promise.all([
      db.select({
        id: poemsTable.id,
        title: poemsTable.title,
        titleUrdu: poemsTable.titleUrdu,
        content: poemsTable.content,
        poetName: poemsTable.poetName,
        poetNameUrdu: poemsTable.poetNameUrdu,
        category: poemsTable.category,
        categoryUrdu: poemsTable.categoryUrdu,
        featured: poemsTable.featured,
        imageUrl: poemsTable.imageUrl,
        likes: poemsTable.likes,
        views: poemsTable.views,
        shares: poemsTable.shares,
        visualPoetry: poemsTable.visualPoetry,
        language: poemsTable.language,
        status: poemsTable.status,
        createdByUserId: poemsTable.createdByUserId,
        createdAt: poemsTable.createdAt,
        contributorName: usersTable.name,
      })
        .from(poemsTable)
        .leftJoin(usersTable, contributorJoin)
        .where(whereClause)
        .orderBy(desc(poemsTable.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: count() })
        .from(poemsTable)
        .leftJoin(usersTable, contributorJoin)
        .where(whereClause),
    ]);

    res.json(ListAdminPoemsResponse.parse({
      poems: poems.map((poem) => ({
        ...poem,
        imageUrl: poem.imageUrl ?? null,
        createdByUserId: poem.createdByUserId ?? null,
        contributorName: poem.contributorName ?? null,
        createdAt: poem.createdAt.toISOString(),
      })),
      total: Number(totalResult[0]?.count ?? 0),
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to list admin poems");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getActorId(payload: AdminPayload): Promise<number | null> {
  if (payload.userId) return payload.userId;
  const [u] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, payload.email));
  return u?.id ?? null;
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

type ContributorDeleteExecutor = any;

function parseContributorIds(raw: unknown): { ids: number[]; valid: boolean } {
  if (!Array.isArray(raw)) return { ids: [], valid: false };
  const parsed = raw.map((value: unknown): number | null => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  });
  const ids = [...new Set(parsed.filter((value): value is number => value !== null))];
  return { ids, valid: ids.length === raw.length };
}

async function getContributorDeletionImpact(ids: number[], executor: ContributorDeleteExecutor = db) {
  const contributors = await executor
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      status: usersTable.status,
    })
    .from(usersTable)
    .where(and(inArray(usersTable.id, ids), eq(usersTable.role, "contributor")));

  const poemRows = await executor
    .select({ id: poemsTable.id })
    .from(poemsTable)
    .where(inArray(poemsTable.createdByUserId, ids));
  const audioRows = await executor
    .select({ id: radioAudioTable.id })
    .from(radioAudioTable)
    .where(inArray(radioAudioTable.createdByUserId, ids));
  const playlistRows = await executor
    .select({ id: radioPlaylistsTable.id })
    .from(radioPlaylistsTable)
    .where(inArray(radioPlaylistsTable.createdByUserId, ids));
  const playlistIds = playlistRows.map((row: { id: number }) => row.id);
  const scheduleRows = await executor
    .select({ id: radioSchedulesTable.id })
    .from(radioSchedulesTable)
    .where(or(
      inArray(radioSchedulesTable.createdByUserId, ids),
      playlistIds.length ? inArray(radioSchedulesTable.playlistId, playlistIds) : sql`false`,
    ));
  const audioIds = audioRows.map((row: { id: number }) => row.id);
  const playlistItemRows = await executor
    .select({ id: radioPlaylistItemsTable.id })
    .from(radioPlaylistItemsTable)
    .where(or(
      playlistIds.length ? inArray(radioPlaylistItemsTable.playlistId, playlistIds) : sql`false`,
      audioIds.length ? inArray(radioPlaylistItemsTable.audioId, audioIds) : sql`false`,
    ));

  return {
    contributors,
    ids: {
      poems: poemRows.map((row: { id: number }) => row.id),
      radioAudio: audioIds,
      radioPlaylists: playlistIds,
      radioSchedules: scheduleRows.map((row: { id: number }) => row.id),
      radioPlaylistItems: playlistItemRows.map((row: { id: number }) => row.id),
    },
    counts: {
      poems: poemRows.length,
      radioAudio: audioRows.length,
      radioPlaylists: playlistRows.length,
      radioSchedules: scheduleRows.length,
      radioPlaylistItems: playlistItemRows.length,
    },
  };
}

// ── POST /api/admin/login ─────────────────────────────────────────────────────
router.post("/login", adminLoginRateLimit, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
    if (!user) { res.status(401).json({ message: "Invalid credentials" }); return; }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ message: "Invalid credentials" }); return; }

    // Block disabled accounts from logging in
    if ((user as any).status !== "active") {
      res.status(403).json({ message: "Account is disabled" });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Update lastLoginAt (non-blocking)
    db.update(usersTable).set({ lastLoginAt: new Date() } as any).where(eq(usersTable.id, user.id)).catch(() => {});
    await logAudit(user.id, "login", "user", user.id);

    res.json({ token, email: user.email, role: user.role, name: user.name, userId: user.id });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const [poemsR, poetsR, videosR, likesR, viewsR, sharesR, messagesR] = await Promise.all([
      db.select({ count: count() }).from(poemsTable),
      db.select({ count: count() }).from(poetsTable),
      db.select({ count: count() }).from(videosTable),
      db.select({ total: sum(poemsTable.likes) }).from(poemsTable),
      db.select({ total: sum(poemsTable.views) }).from(poemsTable),
      db.select({ total: sum(poemsTable.shares) }).from(poemsTable),
      db.select({ count: count() }).from(contactMessagesTable),
    ]);
    res.json({
      poems: poemsR[0]?.count ?? 0,
      poets: poetsR[0]?.count ?? 0,
      videos: videosR[0]?.count ?? 0,
      totalLikes: Number(likesR[0]?.total ?? 0),
      totalViews: Number(viewsR[0]?.total ?? 0),
      totalShares: Number(sharesR[0]?.total ?? 0),
      messages: messagesR[0]?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/admin/analytics ──────────────────────────────────────────────────
router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    const { range, start, end } = req.query as Record<string, string>;
    let startDate: Date;
    let endDate: Date = new Date();
    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const days = range === "30d" ? 30 : 7;
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }
    const rows = await db
      .select({
        type: eventsTable.type,
        day: sql<string>`date_trunc('day', ${eventsTable.createdAt})::date`,
        count: count(),
      })
      .from(eventsTable)
      .where(and(gte(eventsTable.createdAt, startDate), lte(eventsTable.createdAt, endDate)))
      .groupBy(eventsTable.type, sql`date_trunc('day', ${eventsTable.createdAt})`)
      .orderBy(sql`date_trunc('day', ${eventsTable.createdAt}) ASC`);

    const byDay: Record<string, { likes: number; views: number; shares: number }> = {};
    for (const row of rows) {
      const day = String(row.day);
      if (!byDay[day]) byDay[day] = { likes: 0, views: 0, shares: 0 };
      if (row.type === "like") byDay[day].likes = Number(row.count);
      else if (row.type === "view") byDay[day].views = Number(row.count);
      else if (row.type === "share") byDay[day].shares = Number(row.count);
    }
    const data = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, counts]) => ({ day, ...counts }));
    res.json({ data, startDate: startDate.toISOString(), endDate: endDate.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to get analytics");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/admin/top-poems ──────────────────────────────────────────────────
router.get("/top-poems", requireAdmin, async (req, res) => {
  try {
    const cols = { id: poemsTable.id, title: poemsTable.title, titleUrdu: poemsTable.titleUrdu, poetName: poemsTable.poetName, likes: poemsTable.likes, views: poemsTable.views, shares: poemsTable.shares };
    const [byLikes, byViews, byShares] = await Promise.all([
      db.select(cols).from(poemsTable).orderBy(desc(poemsTable.likes)).limit(5),
      db.select(cols).from(poemsTable).orderBy(desc(poemsTable.views)).limit(5),
      db.select(cols).from(poemsTable).orderBy(desc(poemsTable.shares)).limit(5),
    ]);
    res.json({ byLikes, byViews, byShares });
  } catch (err) {
    req.log.error({ err }, "Failed to get top poems");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Messages ──────────────────────────────────────────────────────────────────
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
    if (!deleted) { res.status(404).json({ message: "Not found" }); return; }
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete message");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Settings ──────────────────────────────────────────────────────────────────
router.get("/settings", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(settingsTable).orderBy(asc(settingsTable.key));
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json({ settings });
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/settings", requireAdmin, async (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      await db.insert(settingsTable).values({ key, value: String(value) })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(value) } });
    }
    const rows = await db.select().from(settingsTable).orderBy(asc(settingsTable.key));
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json({ settings });
  } catch (err) {
    req.log.error({ err }, "Failed to save settings");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/settings/public", async (req, res) => {
  try {
    const publicKeys = [
      "social_facebook",
      "social_twitter",
      "social_youtube",
      "social_tiktok",
      "social_instagram",
    ];
    const rows = await db.select().from(settingsTable)
      .where(inArray(settingsTable.key, publicKeys))
      .orderBy(asc(settingsTable.key));
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json({ settings });
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Backups ───────────────────────────────────────────────────────────────────
router.get("/backups", requireAdmin, async (req, res) => {
  try {
    const storedBackups = await db.select({
      id: backupsTable.id,
      name: backupsTable.name,
      createdAt: backupsTable.createdAt,
      data: backupsTable.data,
    })
      .from(backupsTable).orderBy(desc(backupsTable.createdAt));
    const backups = storedBackups.map(({ data, ...backup }) => ({
      ...backup,
      ...describeBackupData(data),
    }));
    res.json({ backups });
  } catch (err) {
    req.log.error({ err }, "Failed to list backups");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/backups", requireDeveloper, async (req, res) => {
  try {
    const backup = await db.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);
      await tx.execute(sql`LOCK TABLE backups IN EXCLUSIVE MODE`);
      const [poems, poets, videos, categories, settings, tools] = await Promise.all([
        tx.select().from(poemsTable),
        tx.select().from(poetsTable),
        tx.select().from(videosTable),
        tx.select().from(categoriesTable),
        tx.select().from(settingsTable),
        tx.select().from(toolsTable),
      ]);
      const snapshot = createBackupSnapshot({ poems, poets, videos, categories, settings, tools });
      const name = `Backup ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      const [created] = await tx.insert(backupsTable)
        .values({ name, data: JSON.stringify(snapshot) })
        .returning();
      if (!created) throw new Error("Backup insert returned no row.");

      const all = await tx.select({ id: backupsTable.id })
        .from(backupsTable)
        .orderBy(asc(backupsTable.createdAt), asc(backupsTable.id));
      const expiredIds = all.slice(0, Math.max(0, all.length - 5)).map((row) => row.id);
      if (expiredIds.length > 0) {
        await tx.delete(backupsTable).where(inArray(backupsTable.id, expiredIds));
      }
      return created;
    });
    res.status(201).json({
      id: backup.id,
      name: backup.name,
      createdAt: backup.createdAt,
      ...describeBackupData(backup.data),
    });
  } catch (err) {
    req.log.error({ errorName: err instanceof Error ? err.name : "UnknownError" }, "Failed to create backup");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/backups/:id", requireDeveloper, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
    await db.delete(backupsTable).where(eq(backupsTable.id, id));
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete backup");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/backups/:id/restore", requireDeveloper, async (req, res) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ message: "Invalid ID" }); return; }
    if (!hasRestoreConfirmation(req.body, id)) {
      res.status(400).json({ message: "Explicit restore confirmation is required." });
      return;
    }
    const [backup] = await db.select().from(backupsTable).where(eq(backupsTable.id, id));
    if (!backup) { res.status(404).json({ message: "Backup not found" }); return; }
    const snapshot = parseBackupData(backup.data);
    if (!snapshot) {
      res.status(409).json({ message: "This backup is invalid or has failed its integrity check and cannot be restored." });
      return;
    }

    const restoredCounts = await db.transaction(async (tx) => {
      await mergeBackupDatasets({
        async upsert(dataset, rows) {
          switch (dataset) {
            case "poems":
              for (const row of rows as typeof snapshot.datasets.poems) {
                const { id: rowId, ...data } = row;
                await tx.insert(poemsTable).values({ id: rowId, ...data })
                  .onConflictDoUpdate({ target: poemsTable.id, set: data });
              }
              break;
            case "poets":
              for (const row of rows as typeof snapshot.datasets.poets) {
                const { id: rowId, ...data } = row;
                await tx.insert(poetsTable).values({ id: rowId, ...data })
                  .onConflictDoUpdate({ target: poetsTable.id, set: data });
              }
              break;
            case "videos":
              for (const row of rows as typeof snapshot.datasets.videos) {
                const { id: rowId, ...data } = row;
                await tx.insert(videosTable).values({ id: rowId, ...data })
                  .onConflictDoUpdate({ target: videosTable.id, set: data });
              }
              break;
            case "categories":
              for (const row of rows as typeof snapshot.datasets.categories) {
                const { id: rowId, ...data } = row;
                await tx.insert(categoriesTable).values({ id: rowId, ...data })
                  .onConflictDoUpdate({ target: categoriesTable.id, set: data });
              }
              break;
            case "settings":
              for (const row of rows as typeof snapshot.datasets.settings) {
                await tx.insert(settingsTable).values({ key: row.key, value: row.value })
                  .onConflictDoUpdate({ target: settingsTable.key, set: { value: row.value } });
              }
              break;
            case "tools":
              for (const row of rows as typeof snapshot.datasets.tools) {
                const { id: rowId, ...data } = row;
                await tx.insert(toolsTable).values({ id: rowId, ...data })
                  .onConflictDoUpdate({ target: toolsTable.id, set: data });
              }
              break;
          }
        },
      }, snapshot.datasets);
      return snapshot.rowCounts;
    });
    res.json({
      message: "Snapshot merge completed successfully.",
      formatVersion: snapshot.formatVersion,
      includedDatasets: snapshot.includedDatasets,
      restoredCounts,
    });
  } catch (err) {
    req.log.error({ errorName: err instanceof Error ? err.name : "UnknownError" }, "Failed to restore backup");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Developer: Admin/Developer User Management ────────────────────────────────
router.get("/users", requireDeveloper, async (req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id, email: usersTable.email, role: usersTable.role,
      name: usersTable.name, createdAt: usersTable.createdAt,
    }).from(usersTable)
      .where(or(eq(usersTable.role, "admin"), eq(usersTable.role, "developer")))
      .orderBy(asc(usersTable.id));
    res.json({ users });
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/users", requireDeveloper, async (req, res) => {
  try {
    const { email, password, role, name } = req.body as { email?: string; password?: string; role?: string; name?: string };
    if (!email || !password) { res.status(400).json({ message: "Email and password required" }); return; }
    if (role !== "developer" && role !== "admin") { res.status(400).json({ message: "Role must be developer or admin" }); return; }
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase().trim(), passwordHash, role, name: name || "",
    }).returning({ id: usersTable.id, email: usersTable.email, role: usersTable.role, name: usersTable.name, createdAt: usersTable.createdAt });
    res.status(201).json({ user });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ message: "Email already exists" }); return; }
    req.log.error({ err }, "Failed to create user");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/users/:id", requireDeveloper, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
    const { email, password, role, name } = req.body as { email?: string; password?: string; role?: string; name?: string };
    const updates: Partial<{ email: string; passwordHash: string; role: "developer" | "admin" | "contributor"; name: string }> = {};
    if (email) updates.email = email.toLowerCase().trim();
    if (password) updates.passwordHash = await bcrypt.hash(password, 12);
    if (role === "developer" || role === "admin") updates.role = role;
    if (name !== undefined) updates.name = name;
    if (Object.keys(updates).length === 0) { res.status(400).json({ message: "Nothing to update" }); return; }
    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, email: usersTable.email, role: usersTable.role, name: usersTable.name, createdAt: usersTable.createdAt });
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/users/:id", requireDeveloper, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
    const [target] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
    }).from(usersTable).where(eq(usersTable.id, id));
    if (!target) { res.status(404).json({ message: "User not found" }); return; }
    if (target.role === "contributor") {
      res.status(409).json({ message: "Use the Contributor deletion workflow so associated content can be reviewed first." });
      return;
    }
    if (target.role === "admin" || target.role === "developer") {
      res.status(403).json({ message: "Protected Admin and Developer accounts cannot be deleted here." });
      return;
    }
    const adminUser = (req as any).adminUser as AdminPayload;
    if (adminUser?.email) {
      const [self] = await db.select().from(usersTable).where(eq(usersTable.email, adminUser.email));
      if (self?.id === id) { res.status(400).json({ message: "Cannot delete your own account" }); return; }
    }
    const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ message: "User not found" }); return; }
    res.json({ message: "User deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete user");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Admin: Contributor Management ─────────────────────────────────────────────

// GET /api/admin/contributors
router.get("/contributors", requireAdmin, async (req, res) => {
  try {
    const { search, status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const parsedLimit = Math.min(parseInt(limit) || 50, 200);
    const parsedOffset = parseInt(offset) || 0;

    // Build base query for contributors only
    let baseQuery = db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      status: usersTable.status,
      role: usersTable.role,
      lastLoginAt: usersTable.lastLoginAt,
      notes: usersTable.notes,
      createdAt: usersTable.createdAt,
    }).from(usersTable)
      .where(eq(usersTable.role, "contributor"))
      .$dynamic();

    const users = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      status: usersTable.status,
      role: usersTable.role,
      lastLoginAt: usersTable.lastLoginAt,
      notes: usersTable.notes,
      createdAt: usersTable.createdAt,
    }).from(usersTable)
      .where(
        and(
          eq(usersTable.role, "contributor"),
          status ? eq(usersTable.status, status as any) : undefined,
          search
            ? or(
                ilike(usersTable.email, `%${search}%`),
                ilike(usersTable.name, `%${search}%`),
              )
            : undefined,
        ),
      )
      .orderBy(desc(usersTable.createdAt))
      .limit(parsedLimit)
      .offset(parsedOffset);

    // Attach submission counts
    const withCounts = await Promise.all(users.map(async (u) => {
      const [total, pending, approved, rejected] = await Promise.all([
        db.select({ c: count() }).from(poemsTable).where(eq(poemsTable.createdByUserId, u.id)),
        db.select({ c: count() }).from(poemsTable).where(and(eq(poemsTable.createdByUserId, u.id), eq(poemsTable.status, "pending"))),
        db.select({ c: count() }).from(poemsTable).where(and(eq(poemsTable.createdByUserId, u.id), eq(poemsTable.status, "published"))),
        db.select({ c: count() }).from(poemsTable).where(and(eq(poemsTable.createdByUserId, u.id), eq(poemsTable.status, "rejected"))),
      ]);
      return {
        ...u,
        totalSubmissions: Number(total[0]?.c ?? 0),
        pendingSubmissions: Number(pending[0]?.c ?? 0),
        approvedSubmissions: Number(approved[0]?.c ?? 0),
        rejectedSubmissions: Number(rejected[0]?.c ?? 0),
      };
    }));

    const [totalCount] = await db.select({ c: count() }).from(usersTable)
      .where(and(
        eq(usersTable.role, "contributor"),
        status ? eq(usersTable.status, status as any) : undefined,
      ));

    res.json({ contributors: withCounts, total: Number(totalCount?.c ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Failed to list contributors");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/contributors/delete-impact — inspect selected accounts before deletion
router.post("/contributors/delete-impact", requireAdmin, async (req, res) => {
  const parsedIds = parseContributorIds(req.body?.ids);
  if (!parsedIds.valid || !parsedIds.ids.length) {
    res.status(400).json({ message: "Select at least one valid Contributor." });
    return;
  }
  const ids = parsedIds.ids;

  try {
    const impact = await getContributorDeletionImpact(ids);
    if (impact.contributors.length !== ids.length) {
      res.status(404).json({ message: "One or more selected accounts are not Contributors." });
      return;
    }
    const hasAssociatedData = Object.values(impact.counts).some((value) => value > 0);
    res.json({
      selectedCount: ids.length,
      hasAssociatedData,
      contributors: impact.contributors,
      counts: impact.counts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to inspect contributor deletion impact");
    res.status(500).json({ message: "The selected Contributors could not be checked." });
  }
});

// DELETE /api/admin/contributors — permanently delete selected Contributors
router.delete("/contributors", requireAdmin, async (req, res) => {
  const parsedIds = parseContributorIds(req.body?.ids);
  const ids = parsedIds.ids;
  const contentAction = req.body?.contentAction === "delete" || req.body?.contentAction === "retain"
    ? req.body.contentAction
    : null;
  if (!parsedIds.valid || !ids.length) {
    res.status(400).json({ message: "Select at least one valid Contributor." });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const impact = await getContributorDeletionImpact(ids, tx);
      if (impact.contributors.length !== ids.length) {
        return { error: "not_contributors" as const };
      }
      const hasAssociatedData = Object.values(impact.counts).some((value) => value > 0);
      if (hasAssociatedData && !contentAction) {
        return { requiresDataDecision: true as const, impact };
      }

      if (contentAction === "delete") {
        if (impact.ids.radioPlaylistItems.length) {
          await tx.delete(radioPlaylistItemsTable).where(inArray(radioPlaylistItemsTable.id, impact.ids.radioPlaylistItems));
        }
        if (impact.ids.radioSchedules.length) {
          await tx.delete(radioSchedulesTable).where(inArray(radioSchedulesTable.id, impact.ids.radioSchedules));
        }
        if (impact.ids.radioPlaylists.length) {
          await tx.delete(radioPlaylistsTable).where(inArray(radioPlaylistsTable.id, impact.ids.radioPlaylists));
        }
        if (impact.ids.radioAudio.length) {
          await tx.delete(radioAudioTable).where(inArray(radioAudioTable.id, impact.ids.radioAudio));
        }
        if (impact.ids.poems.length) {
          await tx.delete(poemsTable).where(inArray(poemsTable.id, impact.ids.poems));
        }
      }

      const deleted = await tx.delete(usersTable)
        .where(and(inArray(usersTable.id, ids), eq(usersTable.role, "contributor")))
        .returning({ id: usersTable.id });
      return { deletedIds: deleted.map((row: { id: number }) => row.id), contentAction: contentAction ?? "retain", impact };
    });

    if ("error" in result) {
      res.status(404).json({ message: "One or more selected accounts are not Contributors." });
      return;
    }
    if ("requiresDataDecision" in result) {
      res.status(409).json({
        message: "Choose whether associated content should be retained or permanently deleted.",
        requiresDataDecision: true,
        selectedCount: ids.length,
        contributors: result.impact.contributors,
        counts: result.impact.counts,
      });
      return;
    }

    const actor = (req as any).adminUser as AdminPayload;
    const actorId = await getActorId(actor);
    await Promise.all(result.deletedIds.map((deletedId: number) => logAudit(actorId, "contributor_deleted", "user", deletedId, {
      contentAction: result.contentAction,
      counts: result.impact.counts,
    })));
    res.json({
      message: result.contentAction === "delete"
        ? "Contributors and selected associated content were permanently deleted."
        : "Contributors were permanently deleted and associated content was retained.",
      deletedIds: result.deletedIds,
      contentAction: result.contentAction,
      counts: result.impact.counts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to delete contributors");
    res.status(500).json({ message: "The Contributors could not be deleted. No changes were applied." });
  }
});

// GET /api/admin/contributors/:id
router.get("/contributors/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

    const [user] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      status: usersTable.status,
      role: usersTable.role,
      lastLoginAt: usersTable.lastLoginAt,
      notes: usersTable.notes,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.role, "contributor")));

    if (!user) { res.status(404).json({ message: "Contributor not found" }); return; }

    const [total, pending, published, rejected] = await Promise.all([
      db.select({ c: count() }).from(poemsTable).where(eq(poemsTable.createdByUserId, id)),
      db.select({ c: count() }).from(poemsTable).where(and(eq(poemsTable.createdByUserId, id), eq(poemsTable.status, "pending"))),
      db.select({ c: count() }).from(poemsTable).where(and(eq(poemsTable.createdByUserId, id), eq(poemsTable.status, "published"))),
      db.select({ c: count() }).from(poemsTable).where(and(eq(poemsTable.createdByUserId, id), eq(poemsTable.status, "rejected"))),
    ]);

    const recent = await db.select({
      id: poemsTable.id, title: poemsTable.title, titleUrdu: poemsTable.titleUrdu,
      status: poemsTable.status, createdAt: poemsTable.createdAt,
    }).from(poemsTable).where(eq(poemsTable.createdByUserId, id)).orderBy(desc(poemsTable.createdAt)).limit(10);

    res.json({
      ...user,
      stats: {
        total: Number(total[0]?.c ?? 0),
        pending: Number(pending[0]?.c ?? 0),
        published: Number(published[0]?.c ?? 0),
        rejected: Number(rejected[0]?.c ?? 0),
      },
      recentSubmissions: recent,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get contributor");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/admin/contributors/:id/submissions
router.get("/contributors/:id/submissions", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
    const { status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const parsedLimit = Math.min(parseInt(limit) || 50, 200);
    const parsedOffset = parseInt(offset) || 0;

    const conditions: ReturnType<typeof eq>[] = [eq(poemsTable.createdByUserId, id)];
    if (status && status !== "all") conditions.push(eq(poemsTable.status, status as any));

    const [poems, totalRes] = await Promise.all([
      db.select().from(poemsTable).where(and(...conditions)).orderBy(desc(poemsTable.createdAt)).limit(parsedLimit).offset(parsedOffset),
      db.select({ c: count() }).from(poemsTable).where(and(...conditions)),
    ]);
    res.json({ poems, total: Number(totalRes[0]?.c ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Failed to get contributor submissions");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/contributors — create contributor account
router.post("/contributors", requireAdmin, async (req, res) => {
  try {
    const actor = (req as any).adminUser as AdminPayload;
    const { email, password, name, notes } = req.body as { email?: string; password?: string; name?: string; notes?: string };
    if (!email || !password) { res.status(400).json({ message: "Email and password required" }); return; }
    if (!name?.trim()) { res.status(400).json({ message: "Name is required" }); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      role: "contributor",
      name: name.trim(),
      notes: notes || null,
    } as any).returning({
      id: usersTable.id, email: usersTable.email, role: usersTable.role, name: usersTable.name, createdAt: usersTable.createdAt,
    });

    const actorId = await getActorId(actor);
    await logAudit(actorId, "contributor_created", "user", user!.id, { email: user!.email, name: user!.name });

    res.status(201).json({ user });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ message: "Email already exists" }); return; }
    req.log.error({ err }, "Failed to create contributor");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/admin/contributors/:id — update contributor name/email/notes
router.put("/contributors/:id", requireAdmin, async (req, res) => {
  try {
    const actor = (req as any).adminUser as AdminPayload;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

    const [existing] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.role, "contributor")));
    if (!existing) { res.status(404).json({ message: "Contributor not found" }); return; }

    const { email, name, notes } = req.body as { email?: string; name?: string; notes?: string };
    const updates: Record<string, unknown> = {};
    if (email) updates.email = email.toLowerCase().trim();
    if (name !== undefined) updates.name = name;
    if (notes !== undefined) updates.notes = notes;
    if (Object.keys(updates).length === 0) { res.status(400).json({ message: "Nothing to update" }); return; }

    const [user] = await db.update(usersTable).set(updates as any).where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role, status: usersTable.status, createdAt: usersTable.createdAt });

    const actorId = await getActorId(actor);
    await logAudit(actorId, "contributor_edited", "user", id, { changes: Object.keys(updates) });

    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Failed to update contributor");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/contributors/:id/reset-password
router.post("/contributors/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const actor = (req as any).adminUser as AdminPayload;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

    const { password } = req.body as { password?: string };
    if (!password || password.length < 8) { res.status(400).json({ message: "Password must be at least 8 characters" }); return; }

    const [existing] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.role, "contributor")));
    if (!existing) { res.status(404).json({ message: "Contributor not found" }); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    // Also revoke existing tokens so the contributor must re-login
    await db.update(usersTable).set({
      passwordHash,
      tokenRevokedAt: new Date(),
    } as any).where(eq(usersTable.id, id));

    const actorId = await getActorId(actor);
    await logAudit(actorId, "password_reset", "user", id);

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to reset password");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/contributors/:id/disable
router.post("/contributors/:id/disable", requireAdmin, async (req, res) => {
  try {
    const actor = (req as any).adminUser as AdminPayload;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

    const [existing] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.role, "contributor")));
    if (!existing) { res.status(404).json({ message: "Contributor not found" }); return; }

    // Disable account and revoke all tokens instantly
    await db.update(usersTable).set({
      status: "disabled",
      tokenRevokedAt: new Date(),
    } as any).where(eq(usersTable.id, id));

    const actorId = await getActorId(actor);
    await logAudit(actorId, "contributor_disabled", "user", id, { email: existing.email });

    res.json({ message: "Contributor disabled and sessions invalidated" });
  } catch (err) {
    req.log.error({ err }, "Failed to disable contributor");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/contributors/:id/enable
router.post("/contributors/:id/enable", requireAdmin, async (req, res) => {
  try {
    const actor = (req as any).adminUser as AdminPayload;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

    const [existing] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.role, "contributor")));
    if (!existing) { res.status(404).json({ message: "Contributor not found" }); return; }

    await db.update(usersTable).set({ status: "active" } as any).where(eq(usersTable.id, id));

    const actorId = await getActorId(actor);
    await logAudit(actorId, "contributor_enabled", "user", id, { email: existing.email });

    res.json({ message: "Contributor enabled" });
  } catch (err) {
    req.log.error({ err }, "Failed to enable contributor");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Admin: Approval Queue ─────────────────────────────────────────────────────

// GET /api/admin/pending — list pending submissions
router.get("/pending", requireAdmin, async (req, res) => {
  try {
    const { contributorId, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const parsedLimit = Math.min(parseInt(limit) || 50, 200);
    const parsedOffset = parseInt(offset) || 0;

    const conditions: ReturnType<typeof eq>[] = [eq(poemsTable.status, "pending")];
    if (contributorId) conditions.push(eq(poemsTable.createdByUserId, parseInt(contributorId)));

    const [poems, totalRes] = await Promise.all([
      db.select({
        id: poemsTable.id,
        title: poemsTable.title,
        titleUrdu: poemsTable.titleUrdu,
        content: poemsTable.content,
        poetName: poemsTable.poetName,
        poetNameUrdu: poemsTable.poetNameUrdu,
        category: poemsTable.category,
        language: poemsTable.language,
        status: poemsTable.status,
        createdByUserId: poemsTable.createdByUserId,
        createdAt: poemsTable.createdAt,
      }).from(poemsTable)
        .where(and(...conditions))
        .orderBy(asc(poemsTable.createdAt))
        .limit(parsedLimit)
        .offset(parsedOffset),
      db.select({ c: count() }).from(poemsTable).where(and(...conditions)),
    ]);

    // Attach contributor info
    const withContributor = await Promise.all(poems.map(async (p) => {
      if (!p.createdByUserId) return { ...p, contributorName: null, contributorEmail: null };
      const [u] = await db.select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, p.createdByUserId));
      return { ...p, contributorName: u?.name ?? null, contributorEmail: u?.email ?? null };
    }));

    res.json({ poems: withContributor, total: Number(totalRes[0]?.c ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Failed to get pending queue");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/poems/:id/approve
router.post("/poems/:id/approve", requireAdmin, async (req, res) => {
  try {
    const actor = (req as any).adminUser as AdminPayload;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

    const actorId = await getActorId(actor);
    const result = await db.transaction(async (tx) => {
      await acquirePoemDuplicateLock(tx);
      const [existing] = await tx.select().from(poemsTable).where(eq(poemsTable.id, id));
      if (!existing) return { notFound: true as const };
      if (existing.status !== "pending") return { notPending: true as const };

      const duplicate = await findPoemDuplicateInTransaction(tx, {
        titleUrdu: existing.titleUrdu,
        poetName: existing.poetName,
        poetNameUrdu: existing.poetNameUrdu,
        content: existing.content,
        language: existing.language,
      }, { excludeId: id });
      if (duplicate) return { duplicate };

      const [poem] = await tx.update(poemsTable).set({
        status: "published",
        approvedByUserId: actorId,
        approvedAt: new Date(),
        rejectedByUserId: null,
        rejectedAt: null,
        rejectionReason: null,
        updatedAt: new Date(),
      } as any).where(eq(poemsTable.id, id)).returning();
      return { poem, title: existing.title, contributorId: existing.createdByUserId };
    });
    if ("notFound" in result) { res.status(404).json({ message: "Poem not found" }); return; }
    if ("notPending" in result) { res.status(400).json({ message: "Poem is not in pending status" }); return; }
    if ("duplicate" in result) {
      res.status(409).json(duplicateConflictBody(result.duplicate!, {
        role: actor.role,
        userId: actor.userId ?? 0,
      }));
      return;
    }

    await logAudit(actorId, "poem_approved", "poem", id, {
      title: result.title,
      contributorId: result.contributorId,
    });
    res.json({ message: "Poem approved and published", poem: result.poem });
  } catch (err) {
    req.log.error({ err }, "Failed to approve poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/poems/:id/reject
router.post("/poems/:id/reject", requireAdmin, async (req, res) => {
  try {
    const actor = (req as any).adminUser as AdminPayload;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) { res.status(400).json({ message: "Rejection reason is required" }); return; }

    const [existing] = await db.select().from(poemsTable).where(eq(poemsTable.id, id));
    if (!existing) { res.status(404).json({ message: "Poem not found" }); return; }
    if (existing.status !== "pending") { res.status(400).json({ message: "Poem is not in pending status" }); return; }

    const actorId = await getActorId(actor);

    const [poem] = await db.update(poemsTable).set({
      status: "rejected",
      rejectedByUserId: actorId,
      rejectedAt: new Date(),
      rejectionReason: reason.trim(),
    } as any).where(eq(poemsTable.id, id)).returning();

    await logAudit(actorId, "poem_rejected", "poem", id, { title: existing.title, reason: reason.trim(), contributorId: existing.createdByUserId });
    res.json({ message: "Poem rejected", poem });
  } catch (err) {
    req.log.error({ err }, "Failed to reject poem");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/admin/audit-logs ─────────────────────────────────────────────────
router.get("/audit-logs", requireAdmin, async (req, res) => {
  try {
    const { limit = "50", offset = "0" } = req.query as Record<string, string>;
    const parsedLimit = Math.min(parseInt(limit) || 50, 200);
    const parsedOffset = parseInt(offset) || 0;

    const [logs, totalRes] = await Promise.all([
      db.select({
        id: auditLogsTable.id,
        actorUserId: auditLogsTable.actorUserId,
        action: auditLogsTable.action,
        targetType: auditLogsTable.targetType,
        targetId: auditLogsTable.targetId,
        metadata: auditLogsTable.metadata,
        createdAt: auditLogsTable.createdAt,
      }).from(auditLogsTable)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(parsedLimit)
        .offset(parsedOffset),
      db.select({ c: count() }).from(auditLogsTable),
    ]);

    // Attach actor names
    const withActor = await Promise.all(logs.map(async (l) => {
      if (!l.actorUserId) return { ...l, actorName: null, actorEmail: null };
      const [u] = await db.select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, l.actorUserId));
      return { ...l, actorName: u?.name ?? null, actorEmail: u?.email ?? null };
    }));

    res.json({ logs: withActor, total: Number(totalRes[0]?.c ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Failed to get audit logs");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
