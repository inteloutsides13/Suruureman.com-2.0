import { readFile } from "node:fs/promises";
import pg from "pg";
import { runRadioScheduleMigrationOnVerifiedTarget } from "./radioScheduleTestRunnerCore.js";
import { resolveRadioScheduleReplitDevelopmentTarget } from "./radioScheduleReplitDevelopmentTarget.js";

const { Pool } = pg;

async function main(): Promise<void> {
  let target;
  try {
    target = resolveRadioScheduleReplitDevelopmentTarget(process.env);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Invalid Replit Development database configuration.";
    console.error(
      `Radio Schedule Development verification refused to start: ${message}`,
    );
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
    loadMigration: () =>
      readFile(
        new URL(
          "../migrations/0004_radio_programme_schedule.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    onSuccess: (identity) => {
      console.info(
        `Radio Schedule migration 0004 verified on ${identity.host}:${identity.port}/${identity.database}.`,
      );
      console.info(
        "This runner applies only migration 0004; it does not seed, truncate, drop, or reset data.",
      );
    },
    onFailure: () => {
      console.error(
        `Radio Schedule Development verification failed for ${target.host}:${target.port}/${target.database}; database diagnostics withheld.`,
      );
    },
  });
  if (!succeeded) process.exitCode = 1;
}

void main().catch(() => {
  console.error(
    "Radio Schedule Development verification failed to initialize; diagnostics withheld.",
  );
  process.exitCode = 1;
});
