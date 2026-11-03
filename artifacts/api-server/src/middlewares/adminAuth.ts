import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { JWT_SECRET } from "../lib/config.js";
import { matchesActiveAccount, verifyOptionalPrivilegedToken } from "../lib/adminTokenPolicy.js";

export { JWT_SECRET };

export interface AdminPayload {
  userId?: number;
  email: string;
  role: "developer" | "admin" | "contributor";
  name?: string;
  iat?: number;
  exp?: number;
}

export const IRAB_ALLOWED_ROLES = ["developer", "admin", "contributor"] as const;
export type IrabAllowedRole = (typeof IRAB_ALLOWED_ROLES)[number];

export function hasIrabAccessRole(role: unknown): role is IrabAllowedRole {
  return IRAB_ALLOWED_ROLES.includes(role as IrabAllowedRole);
}

function extractPayload(req: Request, res: Response): AdminPayload | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const token = auth.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET) as AdminPayload;
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return null;
  }
}

async function validateActivePrivilegedUser(payload: AdminPayload): Promise<AdminPayload | null> {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      name: usersTable.name,
      status: usersTable.status,
      tokenRevokedAt: usersTable.tokenRevokedAt,
    })
    .from(usersTable)
    .where(payload.userId ? eq(usersTable.id, payload.userId) : eq(usersTable.email, payload.email));

  if (!matchesActiveAccount(payload, user)) return null;
  return { ...payload, userId: user.id, email: user.email, name: user.name };
}

/** Optional visibility privilege for public poem routes; validation failures stay public. */
export async function hasActivePrivilegedSession(req: Request): Promise<boolean> {
  const payload = verifyOptionalPrivilegedToken(req.headers.authorization, JWT_SECRET);
  if (!payload) return false;

  try {
    return Boolean(await validateActivePrivilegedUser(payload));
  } catch {
    return false;
  }
}

/** Admin + Developer access. Blocks contributors and checks revocation state. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const payload = extractPayload(req, res);
  if (!payload) return;
  if (payload.role !== "admin" && payload.role !== "developer") {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  try {
    const activePayload = await validateActivePrivilegedUser(payload);
    if (!activePayload) {
      res.status(401).json({ message: "Session expired or account is disabled" });
      return;
    }
    (req as any).adminUser = activePayload;
    next();
  } catch {
    res.status(500).json({ message: "Authentication error" });
  }
}

/** Developer-only access with revocation checks. */
export async function requireDeveloper(req: Request, res: Response, next: NextFunction): Promise<void> {
  const payload = extractPayload(req, res);
  if (!payload) return;
  if (payload.role !== "developer") {
    res.status(403).json({ message: "Forbidden — Developer access only" });
    return;
  }
  try {
    const activePayload = await validateActivePrivilegedUser(payload);
    if (!activePayload) {
      res.status(401).json({ message: "Session expired or account is disabled" });
      return;
    }
    (req as any).adminUser = activePayload;
    next();
  } catch {
    res.status(500).json({ message: "Authentication error" });
  }
}

/**
 * Contributor-only access.
 * Performs a DB check on every request to verify:
 * - Account still exists
 * - Account is not disabled
 * - Token was not revoked (password reset / disable action)
 */
export async function requireContributor(req: Request, res: Response, next: NextFunction) {
  const payload = extractPayload(req, res);
  if (!payload) return;
  if (payload.role !== "contributor") {
    res.status(403).json({ message: "Forbidden — Contributor access only" });
    return;
  }
  try {
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, status: usersTable.status, tokenRevokedAt: usersTable.tokenRevokedAt })
      .from(usersTable)
      .where(eq(usersTable.email, payload.email));

    if (!user) {
      res.status(401).json({ message: "Account not found" });
      return;
    }
    if (user.status !== "active" || user.role !== "contributor") {
      res.status(403).json({ message: "Account is disabled" });
      return;
    }
    // Token revocation check: token issued before revocation date is invalid
    if (user.tokenRevokedAt && payload.iat) {
      const revokedAt = user.tokenRevokedAt.getTime() / 1000;
      if (payload.iat < revokedAt) {
        res.status(401).json({ message: "Session expired — please log in again" });
        return;
      }
    }
    // Attach userId (may not be in legacy tokens)
    (req as any).adminUser = { ...payload, userId: payload.userId ?? user.id };
    next();
  } catch {
    res.status(500).json({ message: "Authentication error" });
  }
}

/** Allows any authenticated role (admin, developer, or contributor). */
export async function requireAnyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const payload = extractPayload(req, res);
  if (!payload) return;
  if (payload.role === "contributor") {
    // Full DB check for contributors
    try {
      const [user] = await db
        .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, status: usersTable.status, tokenRevokedAt: usersTable.tokenRevokedAt })
        .from(usersTable)
        .where(eq(usersTable.email, payload.email));

      if (!user || user.role !== payload.role || user.status !== "active") {
        res.status(403).json({ message: "Account is disabled" });
        return;
      }
      if (user.tokenRevokedAt && payload.iat) {
        const revokedAt = user.tokenRevokedAt.getTime() / 1000;
        if (payload.iat < revokedAt) {
          res.status(401).json({ message: "Session expired" });
          return;
        }
      }
      (req as any).adminUser = { ...payload, userId: payload.userId ?? user.id };
    } catch {
      res.status(500).json({ message: "Authentication error" });
      return;
    }
  } else {
    (req as any).adminUser = payload;
  }
  next();
}

/** Authenticated access for the public اِعْراب — e'raab tool. */
export async function requireIrabAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const payload = extractPayload(req, res);
  if (!payload) return;
  if (!hasIrabAccessRole(payload.role)) {
    res.status(403).json({ message: "Forbidden — اِعْراب — e'raab access only" });
    return;
  }

  try {
    const activePayload = await validateActivePrivilegedUser(payload);
    if (!activePayload) {
      res.status(401).json({ message: "Session expired or account is disabled" });
      return;
    }
    (req as any).adminUser = activePayload;
    next();
  } catch {
    res.status(500).json({ message: "Authentication error" });
  }
}
