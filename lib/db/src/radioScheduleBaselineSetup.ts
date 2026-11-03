import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolveRadioScheduleTestTarget } from "./radioScheduleTestTarget.js";
import { prepareRadioScheduleBaseline } from "./radioScheduleBaselineSetupCore.js";

const { Pool } = pg;

async function main(): Promise<void> {
  let target;
  try {
    target = resolveRadioScheduleTestTarget(process.env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid isolated test database configuration.";
    console.error(`Radio Schedule baseline setup refused: ${message}`);
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({
    connectionString: target.connectionString,
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.user,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  const succeeded = await prepareRadioScheduleBaseline(target, {
    pool,
    loadSql: async () => ({
      baseline: await readFile(new URL("../proposals/radio-schedule-test-baseline/0000_application_baseline.proposed.sql", import.meta.url), "utf8"),
      migrations: await Promise.all([
        readFile(new URL("../migrations/0001_radio_foundation.sql", import.meta.url), "utf8"),
        readFile(new URL("../migrations/0002_radio_editorial.sql", import.meta.url), "utf8"),
        readFile(new URL("../migrations/0003_radio_timezone_berlin.sql", import.meta.url), "utf8"),
      ]) as Promise<[string, string, string]>,
    }),
    onSuccess: () => {
      console.info(`Radio Schedule pre-0004 schema prepared and verified on ${target.host}:${target.port}/${target.database}.`);
      console.info("The database contains schema only. Run the separate integration test to apply migration 0004.");
    },
    onFailure: () => {
      console.error(`Radio Schedule baseline setup failed for ${target.host}:${target.port}/${target.database}; database diagnostics withheld. Any partial setup is left untouched.`);
    },
  });
  if (!succeeded) process.exitCode = 1;
}

void main().catch(() => {
  console.error("Radio Schedule baseline setup failed to initialize; diagnostics withheld.");
  process.exitCode = 1;
});
