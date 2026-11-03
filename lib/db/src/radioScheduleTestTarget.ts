export const RADIO_SCHEDULE_TEST_CONFIRMATION = "I_CONFIRM_RADIO_SCHEDULE_TEST_DATABASE";

export type RadioScheduleTestTarget = {
  connectionString: string;
  host: string;
  port: number;
  database: string;
  user: string;
};

export type RadioScheduleTestEnvironment = Record<string, string | undefined>;

function required(env: RadioScheduleTestEnvironment, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required test setting: ${key}.`);
  return value;
}

function parsePostgresTarget(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL.`);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error(`${label} must identify a PostgreSQL host and database.`);
  }
  if (!url.username || !url.password || url.hash) {
    throw new Error(`${label} must include URL credentials and must not include a fragment.`);
  }
  return url;
}

function normalizedPort(url: URL): number {
  return url.port ? Number(url.port) : 5432;
}

function sameDatabase(left: URL, right: URL): boolean {
  return left.hostname.toLowerCase() === right.hostname.toLowerCase() &&
    normalizedPort(left) === normalizedPort(right) &&
    decodeURIComponent(left.pathname.slice(1)) === decodeURIComponent(right.pathname.slice(1));
}

function decodeUrlPart(value: string, label: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`${label} contains invalid URL encoding.`);
  }
}

function assertNoTargetOverrides(url: URL): void {
  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => key !== "sslmode")) {
    throw new Error("The database URL contains unsupported connection overrides.");
  }
  const sslModes = url.searchParams.getAll("sslmode");
  if (sslModes.length > 1) throw new Error("The database URL must specify TLS mode exactly once.");
  if (sslModes.length && !["require", "verify-full"].includes(sslModes[0])) {
    throw new Error("The database URL must use sslmode=require or sslmode=verify-full.");
  }
}

export function resolveRadioScheduleTestTarget(
  env: RadioScheduleTestEnvironment,
): RadioScheduleTestTarget {
  if (env.NODE_ENV?.toLowerCase() === "production") {
    throw new Error("Refusing Radio Schedule test database access in production mode.");
  }
  for (const key of ["PRODUCTION_DATABASE_URL", "PROD_DATABASE_URL", "DATABASE_PRODUCTION_URL"]) {
    if (Object.hasOwn(env, key)) {
      throw new Error(`Refusing Radio Schedule test database access while ${key} is present.`);
    }
  }
  if (Object.hasOwn(env, "MIGRATION_DATABASE_STRATEGY") ||
      Object.hasOwn(env, "MIGRATION_DATABASE_READ_ONLY")) {
    throw new Error("Refusing test database access while migration database settings are present.");
  }
  if (Object.hasOwn(env, "SOURCE_DATABASE_URL")) {
    throw new Error("Refusing test database access while the source-database setting is present.");
  }
  if (env.RADIO_SCHEDULE_TEST_ALLOW_DATABASE_ACCESS !== RADIO_SCHEDULE_TEST_CONFIRMATION) {
    throw new Error("Explicit database-access approval is required for the Radio Schedule test runner.");
  }

  const rawUrl = required(env, "RADIO_TEST_DATABASE_URL");
  const expectedHost = required(env, "RADIO_SCHEDULE_TEST_EXPECTED_HOST").toLowerCase();
  const expectedDatabase = required(env, "RADIO_SCHEDULE_TEST_EXPECTED_DATABASE");
  const expectedUser = required(env, "RADIO_SCHEDULE_TEST_EXPECTED_USER");
  const confirmation = required(env, "RADIO_SCHEDULE_TEST_CONFIRM_TARGET");
  const targetUrl = parsePostgresTarget(rawUrl, "Radio Schedule test target");
  const host = targetUrl.hostname.toLowerCase();
  const database = decodeUrlPart(targetUrl.pathname.slice(1), "Database name");
  const port = normalizedPort(targetUrl);
  const user = decodeUrlPart(targetUrl.username, "Database user");
  assertNoTargetOverrides(targetUrl);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(database) || database.includes("..")) {
    throw new Error("The test database name must be a single safe identifier.");
  }
  const sslModes = targetUrl.searchParams.getAll("sslmode");
  const sslMode = sslModes[0];
  if (!sslMode) throw new Error("The test database URL must explicitly require TLS.");

  if (!/(^|[-_])(test|testing|sandbox)([-_]|$)/i.test(database)) {
    throw new Error("The target database name must clearly identify a test or sandbox database.");
  }
  if (host !== expectedHost || database !== expectedDatabase || user !== expectedUser) {
    throw new Error("The test database URL does not match its separately configured expected host, database, and user.");
  }
  if (confirmation !== `${host}:${port}/${database}`) {
    throw new Error("The explicit test target confirmation does not match the parsed database identity.");
  }

  if (Object.hasOwn(env, "DATABASE_URL")) {
    const runtimeValue = required(env, "DATABASE_URL");
    const runtimeUrl = parsePostgresTarget(runtimeValue, "Runtime-managed database target");
    assertNoTargetOverrides(runtimeUrl);
    if (sameDatabase(targetUrl, runtimeUrl)) {
      throw new Error("The Radio Schedule test target must not be the runtime-managed database target.");
    }
  }

  return { connectionString: rawUrl, host, port, database, user };
}
