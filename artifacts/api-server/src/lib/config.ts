import { randomBytes } from "node:crypto";

export const isProduction = process.env.NODE_ENV === "production";

export const JWT_SECRET = (() => {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) return configured;
  if (isProduction) {
    throw new Error("JWT_SECRET is required in production");
  }
  // Development sessions intentionally do not survive a process restart.
  // This is not a predictable credential and is never persisted or logged.
  return randomBytes(32).toString("hex");
})();

export function getCorsOrigins(): Set<string> {
  const configured = process.env.CORS_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured?.length) return new Set(configured);

  const origins = new Set(
    isProduction
      ? ["https://suruureman.com", "https://www.suruureman.com"]
      : [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:5000",
          "http://127.0.0.1:5000",
        ],
  );
  if (!isProduction && process.env.REPLIT_DEV_DOMAIN) {
    origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }
  return origins;
}

export function getRadioAdminPermissions(): Set<string> {
  const configured = process.env.RADIO_ADMIN_PERMISSIONS
    ?.split(",")
    .map((permission) => permission.trim())
    .filter(Boolean);
  return new Set(configured ?? ["radio.audio.read"]);
}