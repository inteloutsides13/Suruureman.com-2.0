import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  contributorApplicationsTable,
  usersTable,
  auditLogsTable,
} from "@workspace/db/schema";
import { requireAdmin } from "../middlewares/adminAuth.js";
import type { AdminPayload } from "../middlewares/adminAuth.js";
import { JWT_SECRET } from "../lib/config.js";
import { contributorStatusRateLimit } from "../lib/rateLimit.js";
import { sendContributorApprovalEmail } from "../lib/contributorApprovalEmail.js";

const router: IRouter = Router();
const TERMS_VERSION = "contributor-terms-v1";
const ACTIVATION_TTL_MS = 72 * 60 * 60 * 1000;
const ACTIVATION_ENCRYPTION_KEY = createHash("sha256").update(`${JWT_SECRET}:contributor-activation-link`).digest();

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function encryptActivationToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ACTIVATION_ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decryptActivationToken(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const [ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
    if (!ivEncoded || !tagEncoded || !ciphertextEncoded) return null;
    const iv = Buffer.from(ivEncoded, "base64url");
    const tag = Buffer.from(tagEncoded, "base64url");
    const ciphertext = Buffer.from(ciphertextEncoded, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", ACTIVATION_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function normalizeDateOfBirth(value: unknown): string {
  const date = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  if (
    parsed.getUTCFullYear() !== Number(date.slice(0, 4)) ||
    parsed.getUTCMonth() + 1 !== Number(date.slice(5, 7)) ||
    parsed.getUTCDate() !== Number(date.slice(8, 10))
  ) return "";
  return date;
}

function normalizeLookupName(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function firstNameOf(fullName: string): string {
  return normalizeLookupName(fullName).split(/\s+/)[0] ?? "";
}

function activationUrl(req: any, token: string): string {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0];
  const origin = configured || `${forwardedProto}://${req.get("host")}`;
  return `${origin}/contributor/activate/${token}`;
}

function statusUrl(req: any): string {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0];
  const origin = configured || `${forwardedProto}://${req.get("host")}`;
  return `${origin}/contributor-status`;
}

async function logAudit(actorUserId: number | null, action: string, targetId: number, metadata?: object) {
  try {
    await db.insert(auditLogsTable).values({
      actorUserId,
      action,
      targetType: "contributor_application",
      targetId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch {
    // Audit logging must not make the workflow fail after its primary write.
  }
}

const EMAIL_STATUS_ACTIONS = [
  "contributor_approval_email_sent",
  "contributor_approval_email_failed",
  "contributor_activation_email_sent",
  "contributor_activation_email_failed",
] as const;

type ApprovalEmailStatus = "sent" | "failed" | "not_sent";

function emailStatusFromAction(action: string): ApprovalEmailStatus {
  return action.endsWith("_sent") ? "sent" : "failed";
}

async function getApprovalEmailStatus(applicationId: number): Promise<{ status: ApprovalEmailStatus; message: string | null }> {
  const [entry] = await db.select({
    action: auditLogsTable.action,
    metadata: auditLogsTable.metadata,
  }).from(auditLogsTable).where(and(
    eq(auditLogsTable.targetType, "contributor_application"),
    eq(auditLogsTable.targetId, applicationId),
    inArray(auditLogsTable.action, [...EMAIL_STATUS_ACTIONS]),
  )).orderBy(desc(auditLogsTable.createdAt)).limit(1);

  if (!entry) return { status: "not_sent", message: null };
  let message: string | null = null;
  if (entry.metadata) {
    try {
      const parsed = JSON.parse(entry.metadata) as { reason?: unknown };
      message = typeof parsed.reason === "string" ? parsed.reason : null;
    } catch {
      message = null;
    }
  }
  return { status: emailStatusFromAction(entry.action), message };
}

async function recordEmailDelivery(
  actorUserId: number | null,
  applicationId: number,
  result: Awaited<ReturnType<typeof sendContributorApprovalEmail>>,
  reissued: boolean,
) {
  const action = `${reissued ? "contributor_activation_email" : "contributor_approval_email"}_${result.status}`;
  await logAudit(actorUserId, action, applicationId, result.status === "failed" ? { reason: result.reason } : { provider: "hostinger" });
}

// ── Public application ──────────────────────────────────────────────────────
router.post("/contributor-applications", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const fullName = clean(body.fullName);
  const email = clean(body.email).toLowerCase();
  const dateOfBirth = normalizeDateOfBirth(body.dateOfBirth);
  const contactInformation = clean(body.contactInformation);
  const bio = clean(body.bio);
  const contributionArea = clean(body.contributionArea);
  const preferredLanguage = clean(body.preferredLanguage);
  const category = clean(body.category);
  const portfolio = clean(body.portfolio);
  const termsAccepted = body.termsAccepted === true;

  if (!fullName || !email || !dateOfBirth || !bio || !contributionArea || !preferredLanguage || !category) {
    res.status(400).json({ message: "Please complete all required application fields." });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: "Please provide a valid email address." });
    return;
  }
  if (!termsAccepted) {
    res.status(400).json({ message: "You must accept the Contributor Terms & Conditions." });
    return;
  }
  if (fullName.length > 160 || email.length > 254 || bio.length > 5000 || contributionArea.length > 160 || category.length > 160 || portfolio.length > 2000) {
    res.status(400).json({ message: "One or more fields are too long." });
    return;
  }

  try {
    const [existingUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existingUser) {
      res.status(409).json({ message: "An account already exists for this email address." });
      return;
    }
    const [existingApplication] = await db
      .select({ id: contributorApplicationsTable.id, status: contributorApplicationsTable.status })
      .from(contributorApplicationsTable)
      .where(and(eq(contributorApplicationsTable.email, email), or(eq(contributorApplicationsTable.status, "pending"), eq(contributorApplicationsTable.status, "approved"))))
      .limit(1);
    if (existingApplication) {
      res.status(409).json({ message: "An application for this email is already under review or approved." });
      return;
    }

    const [application] = await db.insert(contributorApplicationsTable).values({
      fullName,
      email,
      dateOfBirth,
      contactInformation: contactInformation || null,
      bio,
      contributionArea,
      preferredLanguage,
      category,
      portfolio: portfolio || null,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      status: "pending",
    }).returning({ id: contributorApplicationsTable.id });

    res.status(201).json({
      id: application?.id,
      status: "pending",
      message: "Your application has been submitted successfully. After approval, you will receive instructions for activating your Contributor account.",
      messageUrdu: "آپ کی درخواست کامیابی سے جمع ہو گئی ہے۔ انتظامیہ کی منظوری کے بعد آپ کو اکاؤنٹ فعال کرنے کا طریقہ فراہم کیا جائے گا۔",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to submit contributor application");
    res.status(500).json({ message: "The application could not be submitted." });
  }
});

// ── Public application status ────────────────────────────────────────────────
router.post("/contributor-application-status", contributorStatusRateLimit, async (req, res) => {
  const firstName = normalizeLookupName(clean(req.body?.firstName));
  const email = clean(req.body?.email).toLowerCase();
  const dateOfBirth = normalizeDateOfBirth(req.body?.dateOfBirth);
  if (!firstName || !email || !dateOfBirth) {
    res.status(400).json({ message: "Enter your first name, date of birth, and email address." });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || firstName.length > 80) {
    res.status(400).json({ message: "Enter a valid first name and email address." });
    return;
  }

  try {
    const candidates = await db.select({
      fullName: contributorApplicationsTable.fullName,
      dateOfBirth: contributorApplicationsTable.dateOfBirth,
      status: contributorApplicationsTable.status,
      userId: contributorApplicationsTable.userId,
      activationTokenHash: contributorApplicationsTable.activationTokenHash,
      activationTokenCiphertext: contributorApplicationsTable.activationTokenCiphertext,
      activationExpiresAt: contributorApplicationsTable.activationExpiresAt,
      activationUsedAt: contributorApplicationsTable.activationUsedAt,
    }).from(contributorApplicationsTable).where(and(
      eq(contributorApplicationsTable.email, email),
      eq(contributorApplicationsTable.dateOfBirth, dateOfBirth),
    )).orderBy(desc(contributorApplicationsTable.createdAt));
    const application = candidates.find((candidate) => firstNameOf(candidate.fullName) === firstName);
    if (!application) {
      res.status(404).json({ message: "Application Not Found", status: "not_found" });
      return;
    }

    let accountStatus: string | null = null;
    if (application.userId) {
      const [user] = await db.select({ status: usersTable.status }).from(usersTable).where(eq(usersTable.id, application.userId));
      accountStatus = user?.status ?? null;
    }

    if (application.status === "approved" && accountStatus === "activation_pending") {
      const token = application.activationTokenHash
        && application.activationExpiresAt
        && application.activationExpiresAt > new Date()
        && !application.activationUsedAt
        ? decryptActivationToken(application.activationTokenCiphertext)
        : null;
      const activationLink = token && application.activationTokenHash === hashToken(token)
        ? activationUrl(req, token)
        : null;
      res.json({
        status: "approved",
        accountStatus,
        activationLink,
        message: activationLink
          ? "Your Contributor application has been approved. Activate your account to continue."
          : "Your Contributor application has been approved, but the activation link is no longer available. Please contact an Administrator or Developer for a fresh link.",
      });
      return;
    }

    if (application.status === "approved" && accountStatus === "active") {
      res.json({
        status: "approved",
        accountStatus,
        loginPath: "/admin/login",
        message: "Your Contributor application has been approved and your account is already active.",
      });
      return;
    }

    if (application.status === "approved") {
      res.json({
        status: "approved",
        accountStatus,
        message: "Your Contributor application has been approved.",
      });
      return;
    }

    if (application.status === "rejected") {
      res.json({
        status: "rejected",
        message: "Your Contributor application was not approved.",
      });
      return;
    }

    res.json({
      status: "pending",
      message: "Your Contributor application has been received and is currently under review.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to look up contributor application status");
    res.status(500).json({ message: "The application status could not be checked." });
  }
});

// ── Public activation ────────────────────────────────────────────────────────
router.get("/contributor-activation/:token", async (req, res) => {
  const token = clean(req.params.token);
  if (!token || token.length > 256) {
    res.status(400).json({ valid: false, message: "This activation link is invalid or expired." });
    return;
  }
  try {
    const [application] = await db.select({
      id: contributorApplicationsTable.id,
      fullName: contributorApplicationsTable.fullName,
      status: contributorApplicationsTable.status,
      userId: contributorApplicationsTable.userId,
      activationExpiresAt: contributorApplicationsTable.activationExpiresAt,
      activationUsedAt: contributorApplicationsTable.activationUsedAt,
    }).from(contributorApplicationsTable).where(eq(contributorApplicationsTable.activationTokenHash, hashToken(token)));
    let accountValid = false;
    if (application?.userId) {
      const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(and(
        eq(usersTable.id, application.userId),
        eq(usersTable.role, "contributor"),
        eq(usersTable.status, "activation_pending"),
      ));
      accountValid = Boolean(user);
    }
    const valid = Boolean(application && accountValid && application.status === "approved" && !application.activationUsedAt && application.activationExpiresAt && application.activationExpiresAt > new Date());
    if (!valid) {
      res.status(400).json({ valid: false, message: "This activation link is invalid or expired." });
      return;
    }
    res.json({ valid: true, fullName: application?.fullName });
  } catch (err) {
    req.log.error({ err }, "Failed to validate activation link");
    res.status(400).json({ valid: false, message: "This activation link is invalid or expired." });
  }
});

router.post("/contributor-activation/:token", async (req, res) => {
  const token = clean(req.params.token);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const confirmation = typeof req.body?.confirmation === "string" ? req.body.confirmation : "";
  if (!token || token.length > 256 || password.length < 8 || password !== confirmation) {
    res.status(400).json({ message: password.length < 8 ? "Password must be at least 8 characters." : "Passwords do not match." });
    return;
  }

  const tokenHash = hashToken(token);
  try {
    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute(sql`
        SELECT id, user_id, full_name
        FROM contributor_applications
        WHERE activation_token_hash = ${tokenHash}
          AND status = 'approved'
          AND activation_used_at IS NULL
          AND activation_expires_at > NOW()
        FOR UPDATE
      `);
      const row = (locked as any).rows?.[0] as { id: number; user_id: number; full_name: string } | undefined;
      if (!row) return null;

      const passwordHash = await bcrypt.hash(password, 12);
      const updatedUser = await tx.update(usersTable).set({
        passwordHash,
        status: "active",
        activationPendingAt: null,
        tokenRevokedAt: null,
      } as any).where(and(eq(usersTable.id, row.user_id), eq(usersTable.role, "contributor"), eq(usersTable.status, "activation_pending"))).returning({ id: usersTable.id });
      if (!updatedUser[0]) return null;

      await tx.update(contributorApplicationsTable).set({
        activationUsedAt: new Date(),
        activationTokenHash: null,
        activationTokenCiphertext: null,
        activationExpiresAt: null,
        updatedAt: new Date(),
      }).where(eq(contributorApplicationsTable.id, row.id));
      return { fullName: row.full_name };
    });

    if (!result) {
      res.status(400).json({ message: "This activation link is invalid, expired, or already used." });
      return;
    }
    res.json({ message: "Account Activated Successfully", fullName: result.fullName });
  } catch (err) {
    req.log.error({ err }, "Failed to activate contributor account");
    res.status(500).json({ message: "The account could not be activated." });
  }
});

// ── Admin/Developer review ───────────────────────────────────────────────────
router.get("/admin/contributor-applications", requireAdmin, async (req, res) => {
  try {
    const query = req.query as Record<string, string>;
    const status = ["pending", "approved", "rejected"].includes(query.status) ? query.status : undefined;
    const search = clean(query.search);
    const conditions = [];
    if (status) conditions.push(eq(contributorApplicationsTable.status, status as any));
    if (search) conditions.push(or(ilike(contributorApplicationsTable.fullName, `%${search}%`), ilike(contributorApplicationsTable.email, `%${search}%`)));
    const applications = await db.select({
      id: contributorApplicationsTable.id,
      fullName: contributorApplicationsTable.fullName,
      email: contributorApplicationsTable.email,
      dateOfBirth: contributorApplicationsTable.dateOfBirth,
      contributionArea: contributorApplicationsTable.contributionArea,
      preferredLanguage: contributorApplicationsTable.preferredLanguage,
      category: contributorApplicationsTable.category,
      status: contributorApplicationsTable.status,
      rejectionReason: contributorApplicationsTable.rejectionReason,
      reviewedAt: contributorApplicationsTable.reviewedAt,
      userId: contributorApplicationsTable.userId,
      activationUsedAt: contributorApplicationsTable.activationUsedAt,
      activationExpiresAt: contributorApplicationsTable.activationExpiresAt,
      createdAt: contributorApplicationsTable.createdAt,
      updatedAt: contributorApplicationsTable.updatedAt,
    }).from(contributorApplicationsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(contributorApplicationsTable.createdAt))
      .limit(Math.min(Number(query.limit) || 100, 200));
    const emailLogs = applications.length
      ? await db.select({
        targetId: auditLogsTable.targetId,
        action: auditLogsTable.action,
        metadata: auditLogsTable.metadata,
        createdAt: auditLogsTable.createdAt,
      }).from(auditLogsTable).where(and(
        eq(auditLogsTable.targetType, "contributor_application"),
        inArray(auditLogsTable.targetId, applications.map((application) => application.id)),
        inArray(auditLogsTable.action, [...EMAIL_STATUS_ACTIONS]),
      )).orderBy(desc(auditLogsTable.createdAt))
      : [];
    const emailStatusByApplication = new Map<number, { status: ApprovalEmailStatus; message: string | null }>();
    for (const log of emailLogs) {
      if (log.targetId === null || emailStatusByApplication.has(log.targetId)) continue;
      let message: string | null = null;
      if (log.metadata) {
        try {
          const parsed = JSON.parse(log.metadata) as { reason?: unknown };
          message = typeof parsed.reason === "string" ? parsed.reason : null;
        } catch {
          message = null;
        }
      }
      emailStatusByApplication.set(log.targetId, { status: emailStatusFromAction(log.action), message });
    }
    res.json({
      applications: applications.map((application) => ({
        ...application,
        approvalEmailStatus: emailStatusByApplication.get(application.id)?.status ?? "not_sent",
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list contributor applications");
    res.status(500).json({ message: "Applications could not be loaded." });
  }
});

router.get("/admin/contributor-applications/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ message: "Invalid application ID." }); return; }
  try {
    const [application] = await db.select().from(contributorApplicationsTable).where(eq(contributorApplicationsTable.id, id));
    if (!application) { res.status(404).json({ message: "Application not found." }); return; }
    const { activationTokenHash: _activationTokenHash, activationTokenCiphertext: _activationTokenCiphertext, ...safeApplication } = application;
    let accountStatus: string | null = null;
    let accountLastLoginAt: Date | null = null;
    if (application.userId) {
      const [user] = await db.select({ status: usersTable.status, lastLoginAt: usersTable.lastLoginAt })
        .from(usersTable).where(eq(usersTable.id, application.userId));
      accountStatus = user?.status ?? null;
      accountLastLoginAt = user?.lastLoginAt ?? null;
    }
    const approvalEmail = await getApprovalEmailStatus(id);
    res.json({ application: { ...safeApplication, approvalEmailStatus: approvalEmail.status, approvalEmailMessage: approvalEmail.message }, accountStatus, accountLastLoginAt });
  } catch (err) {
    req.log.error({ err }, "Failed to load contributor application");
    res.status(500).json({ message: "Application could not be loaded." });
  }
});

router.post("/admin/contributor-applications/:id/approve", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const actor = (req as any).adminUser as AdminPayload;
  if (!Number.isInteger(id)) { res.status(400).json({ message: "Invalid application ID." }); return; }

  try {
    const result = await db.transaction(async (tx) => {
      const [application] = await tx.select().from(contributorApplicationsTable).where(eq(contributorApplicationsTable.id, id));
      if (!application) return { error: "not_found" as const };
      if (application.status !== "pending") return { error: "not_pending" as const };

      const [existingUser] = await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, application.email));
      if (existingUser) return { error: "email_exists" as const };

      const token = randomBytes(32).toString("hex");
      const placeholderHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
      const [user] = await tx.insert(usersTable).values({
        email: application.email,
        passwordHash: placeholderHash,
        role: "contributor",
        name: application.fullName,
        status: "activation_pending" as any,
        activationPendingAt: new Date(),
      } as any).returning({ id: usersTable.id });
      if (!user) throw new Error("Account creation failed");

      await tx.update(contributorApplicationsTable).set({
        status: "approved",
        reviewedByUserId: actor.userId ?? null,
        reviewedAt: new Date(),
        userId: user.id,
        activationTokenHash: hashToken(token),
         activationTokenCiphertext: encryptActivationToken(token),
        activationExpiresAt: new Date(Date.now() + ACTIVATION_TTL_MS),
        rejectionReason: null,
        updatedAt: new Date(),
      }).where(eq(contributorApplicationsTable.id, id));
      return { token, userId: user.id, fullName: application.fullName, email: application.email };
    });

    if ("error" in result) {
      const messages = { not_found: "Application not found.", not_pending: "Only pending applications can be approved.", email_exists: "An account already exists for this email. No account was created." };
      const message = result.error === "not_found"
        ? messages.not_found
        : result.error === "not_pending"
          ? messages.not_pending
          : messages.email_exists;
      res.status(result.error === "not_found" ? 404 : 409).json({ message });
      return;
    }
    const activationLink = activationUrl(req, result.token);
    const emailResult = await sendContributorApprovalEmail({
      applicantName: result.fullName,
      recipientEmail: result.email,
      activationUrl: activationLink,
      statusUrl: statusUrl(req),
    });
    await logAudit(actor.userId ?? null, "contributor_application_approved", id, { userId: result.userId });
    await recordEmailDelivery(actor.userId ?? null, id, emailResult, false);
    if (emailResult.status === "failed") {
      req.log.warn({ applicationId: id }, "Contributor approval email was not sent; Status activation remains available");
    }
    res.json({
      status: "approved",
      userId: result.userId,
      activationLink,
      approvalEmailStatus: emailResult.status,
      approvalEmailMessage: emailResult.status === "failed" ? emailResult.reason : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to approve contributor application");
    res.status(500).json({ message: "The application could not be approved. No partial account should be used." });
  }
});

router.post("/admin/contributor-applications/:id/reject", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const actor = (req as any).adminUser as AdminPayload;
  const reason = clean(req.body?.reason);
  if (!Number.isInteger(id)) { res.status(400).json({ message: "Invalid application ID." }); return; }
  if (reason.length > 2000) { res.status(400).json({ message: "Rejection reason is too long." }); return; }

  try {
    const [application] = await db.select({ status: contributorApplicationsTable.status, userId: contributorApplicationsTable.userId }).from(contributorApplicationsTable).where(eq(contributorApplicationsTable.id, id));
    if (!application) { res.status(404).json({ message: "Application not found." }); return; }
    if (application.status !== "pending") { res.status(409).json({ message: "Only pending applications can be rejected." }); return; }
    if (application.userId) { res.status(409).json({ message: "This application already has an account and cannot be rejected." }); return; }
    await db.update(contributorApplicationsTable).set({
      status: "rejected",
      rejectionReason: reason || null,
      reviewedByUserId: actor.userId ?? null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(contributorApplicationsTable.id, id));
    await logAudit(actor.userId ?? null, "contributor_application_rejected", id, { hasReason: Boolean(reason) });
    res.json({ status: "rejected" });
  } catch (err) {
    req.log.error({ err }, "Failed to reject contributor application");
    res.status(500).json({ message: "The application could not be rejected." });
  }
});

router.post("/admin/contributor-applications/:id/reissue-activation", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const actor = (req as any).adminUser as AdminPayload;
  if (!Number.isInteger(id)) { res.status(400).json({ message: "Invalid application ID." }); return; }
  try {
    const [application] = await db.select({
      fullName: contributorApplicationsTable.fullName,
      email: contributorApplicationsTable.email,
      userId: contributorApplicationsTable.userId,
    }).from(contributorApplicationsTable).where(and(
      eq(contributorApplicationsTable.id, id),
      eq(contributorApplicationsTable.status, "approved"),
      sql`user_id IS NOT NULL`,
    ));
    if (!application || !application.userId) {
      res.status(409).json({ message: "Only an approved application with an account can receive a new activation link." });
      return;
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + ACTIVATION_TTL_MS);
    const updated = await db.update(contributorApplicationsTable).set({
      activationTokenHash: hashToken(token),
      activationTokenCiphertext: encryptActivationToken(token),
      activationExpiresAt: expiresAt,
      activationUsedAt: null,
      updatedAt: new Date(),
    }).where(eq(contributorApplicationsTable.id, id)).returning({ id: contributorApplicationsTable.id });
    if (!updated[0]) { res.status(409).json({ message: "Only an approved application with an account can receive a new activation link." }); return; }
    await logAudit(actor.userId ?? null, "contributor_activation_reissued", id);
    const link = activationUrl(req, token);
    const [account] = await db.select({ status: usersTable.status }).from(usersTable).where(eq(usersTable.id, application.userId));
    let emailResult: Awaited<ReturnType<typeof sendContributorApprovalEmail>> | null = null;
    if (account?.status === "activation_pending") {
      emailResult = await sendContributorApprovalEmail({
        applicantName: application.fullName,
        recipientEmail: application.email,
        activationUrl: link,
        statusUrl: statusUrl(req),
      });
      await recordEmailDelivery(actor.userId ?? null, id, emailResult, true);
      if (emailResult.status === "failed") {
        req.log.warn({ applicationId: id }, "Contributor activation email was not sent; Status activation remains available");
      }
    }
    res.json({
      activationLink: link,
      expiresAt: expiresAt.toISOString(),
      approvalEmailStatus: emailResult?.status ?? "not_sent",
      approvalEmailMessage: emailResult?.status === "failed" ? emailResult.reason : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to reissue activation link");
    res.status(500).json({ message: "A new activation link could not be generated." });
  }
});

export default router;