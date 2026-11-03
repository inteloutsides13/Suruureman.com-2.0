import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { logger } from "./logger.js";

const SENSITIVE_KEYS = /password|secret|token|credential|authorization|signedurl|accesskey/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      SENSITIVE_KEYS.test(key) ? "[REDACTED]" : redact(child),
    ]),
  );
}

export async function writeAuditLog(
  actorUserId: number | null,
  action: string,
  targetType?: string,
  targetId?: number,
  metadata?: object,
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      actorUserId,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      metadata: metadata ? JSON.stringify(redact(metadata)) : null,
    });
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : "unknown" }, "Audit log write failed");
  }
}