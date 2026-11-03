import { readFile } from "node:fs/promises";
import pg from "pg";
import { runRadioScheduleMigrationOnVerifiedTarget } from "./radioScheduleTestRunnerCore.js";
import { resolveRadioScheduleTestTarget } from "./radioScheduleTestTarget.js";

const { Pool } = pg;

async function main(): Promise<void> {
  let target;
  try {
    target = resolveRadioScheduleTestTarget(process.env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid isolated test database configuration.";
    console.error(`Radio Schedule DB runner refused to start: ${message}`);
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
  const succeeded = await runRadioScheduleMigrationOnVerifiedTarget(target, {
    pool,
    loadMigration: () => readFile(new URL("../migrations/0004_radio_programme_schedule.sql", import.meta.url), "utf8"),
    onSuccess: (verifiedTarget) => {
      console.info(`Radio Schedule migration 0004 verified on ${verifiedTarget.host}:${verifiedTarget.port}/${verifiedTarget.database}.`);
      console.info("This runner applies only migration 0004; it does not seed, truncate, drop, or reset data.");
    },
    onFailure: () => {
      console.error(`Radio Schedule DB runner failed for ${target.host}:${target.port}/${target.database}; database diagnostics withheld.`);
    },
  });
  if (!succeeded) process.exitCode = 1;
}

void main().catch(() => {
  console.error("Radio Schedule DB runner failed to initialize; diagnostics withheld.");
  process.exitCode = 1;
});
