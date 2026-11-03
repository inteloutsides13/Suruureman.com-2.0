import jwt from "jsonwebtoken";

export interface OptionalPrivilegedToken {
  userId?: number;
  email: string;
  role: "admin" | "developer";
  iat?: number;
}

export interface AccountTokenState {
  id: number;
  email: string;
  role: string;
  status: string;
  tokenRevokedAt: Date | null;
}

/** Invalid or non-privileged bearer tokens are treated as unauthenticated. */
export function verifyOptionalPrivilegedToken(
  authorization: string | undefined,
  secret: string,
): OptionalPrivilegedToken | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded !== "object" || decoded === null) return null;
    if (
      (decoded.role !== "admin" && decoded.role !== "developer") ||
      typeof decoded.email !== "string" ||
      decoded.email.trim().length === 0
    ) {
      return null;
    }
    if (
      decoded.userId !== undefined &&
      (typeof decoded.userId !== "number" ||
        !Number.isSafeInteger(decoded.userId) ||
        decoded.userId < 1)
    ) {
      return null;
    }
    if (decoded.iat !== undefined && (typeof decoded.iat !== "number" || !Number.isFinite(decoded.iat))) {
      return null;
    }

    return {
      ...(decoded.userId === undefined ? {} : { userId: decoded.userId }),
      email: decoded.email,
      role: decoded.role,
      ...(decoded.iat === undefined ? {} : { iat: decoded.iat }),
    };
  } catch {
    return null;
  }
}

export function matchesActiveAccount(
  payload: { email: string; role: string; iat?: number },
  account: AccountTokenState | null | undefined,
): boolean {
  if (
    !account ||
    account.email !== payload.email ||
    account.role !== payload.role ||
    account.status !== "active"
  ) {
    return false;
  }

  if (account.tokenRevokedAt) {
    if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) return false;
    const revokedAt = account.tokenRevokedAt.getTime() / 1000;
    if (!Number.isFinite(revokedAt) || payload.iat < revokedAt) return false;
  }

  return true;
}
