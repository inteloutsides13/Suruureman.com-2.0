import type { RadioScheduleTestTarget } from "./radioScheduleTestTarget.js";

export const RADIO_SCHEDULE_DEV_APPROVAL =
  "I_APPROVE_RADIO_SCHEDULE_MIGRATION_ON_REPLIT_DEVELOPMENT";
export const RADIO_SCHEDULE_DEV_TARGET_CONFIRMATION =
  "DEVELOPMENT_SELECTED_IN_REPLIT_DATABASE_PANE";

export type RadioScheduleReplitDevelopmentEnvironment = Record<
  string,
  string | undefined
>;

function required(
  env: RadioScheduleReplitDevelopmentEnvironment,
  key: string,
): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required Development setting: ${key}.`);
  return value;
}

function decode(value: string, label: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`${label} contains invalid URL encoding.`);
  }
}

export function resolveRadioScheduleReplitDevelopmentTarget(
  env: RadioScheduleReplitDevelopmentEnvironment,
): RadioScheduleTestTarget {
  if (
    env.RADIO_SCHEDULE_DEV_DATABASE_APPROVAL !== RADIO_SCHEDULE_DEV_APPROVAL
  ) {
    throw new Error(
      "Explicit approval for the Replit Development database is required.",
    );
  }
  if (
    env.RADIO_SCHEDULE_DEV_DATABASE_TARGET !==
    RADIO_SCHEDULE_DEV_TARGET_CONFIRMATION
  ) {
    throw new Error("Confirm the Replit Database pane is set to Development.");
  }
  if (!env.REPLIT_DEV_DOMAIN?.trim()) {
    throw new Error(
      "This verification path must run in the Replit Development workspace.",
    );
  }

  // DATABASE_URL is Replit's environment-selected database connection. Deliberately
  // do not inspect or fall back to SOURCE_DATABASE_URL or migration strategy settings.
  const connectionString = required(env, "DATABASE_URL");
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(
      "The Replit Development database connection is not a valid PostgreSQL URL.",
    );
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname.slice(1) ||
    !url.username ||
    !url.password ||
    url.hash
  ) {
    throw new Error(
      "The Replit Development setting must identify a PostgreSQL database.",
    );
  }

  const queryKeys = [...url.searchParams.keys()];
  if (queryKeys.some((key) => key !== "sslmode")) {
    throw new Error(
      "The Replit Development connection has unsupported target overrides.",
    );
  }
  const sslModes = url.searchParams.getAll("sslmode");
  if (
    sslModes.length !== 1 ||
    !["require", "verify-full"].includes(sslModes[0])
  ) {
    throw new Error(
      "The Replit Development connection must specify one secure TLS mode.",
    );
  }

  const database = decode(url.pathname.slice(1), "Database name");
  const user = decode(url.username, "Database user");
  const host = url.hostname.toLowerCase();
  const port = url.port ? Number(url.port) : 5432;
  if (
    !database ||
    !user ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      "The Replit Development connection has an invalid database identity.",
    );
  }

  return { connectionString, host, port, database, user };
}
