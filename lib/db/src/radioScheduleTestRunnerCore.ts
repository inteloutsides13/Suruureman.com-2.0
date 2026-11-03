import type { RadioScheduleTestTarget } from "./radioScheduleTestTarget.js";

export type RadioScheduleTestPool = {
  connect(): Promise<RadioScheduleTestClient>;
  end(): Promise<void>;
};

export type RadioScheduleTestClient = {
  query(
    query: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>> }>;
  release(): void;
};

export type RadioScheduleTestIdentity = Pick<
  RadioScheduleTestTarget,
  "host" | "port" | "database"
>;

export type RadioScheduleTestRunnerDependencies = {
  pool: RadioScheduleTestPool;
  loadMigration(): Promise<string>;
  onSuccess(identity: RadioScheduleTestIdentity): void;
  onFailure(): void;
};

const REQUIRED_COLUMNS = [
  "title_en",
  "title_ur",
  "description_en",
  "description_ur",
  "programme_type",
  "schedule_type",
  "scheduled_date",
  "public_note",
];

export async function runRadioScheduleMigrationOnVerifiedTarget(
  target: RadioScheduleTestTarget,
  dependencies: RadioScheduleTestRunnerDependencies,
): Promise<boolean> {
  let client: RadioScheduleTestClient | undefined;
  let transactionStarted = false;
  try {
    client = await dependencies.pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const identity = await client.query(
      "SELECT current_database() AS database_name, current_user AS database_user",
    );
    if (
      identity.rows[0]?.database_name !== target.database ||
      identity.rows[0]?.database_user !== target.user
    ) {
      throw new Error("Database identity mismatch.");
    }

    const baseline = await client.query(
      "SELECT to_regclass('public.radio_schedules')::text AS schedule_table",
    );
    if (!baseline.rows[0]?.schedule_table)
      throw new Error("Radio Schedule baseline table is missing.");

    const migration = await dependencies.loadMigration();
    await client.query(migration);

    const columns = await client.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'radio_schedules'
          AND column_name = ANY($1::text[])`,
      [REQUIRED_COLUMNS],
    );
    const found = new Set(columns.rows.map((row) => row.column_name));
    if (REQUIRED_COLUMNS.some((column) => !found.has(column))) {
      throw new Error("Migration verification failed.");
    }

    await client.query("COMMIT");
    transactionStarted = false;
    try {
      dependencies.onSuccess({
        host: target.host,
        port: target.port,
        database: target.database,
      });
    } catch {
      // Output callbacks must not turn an already committed migration into a reported DB failure.
    }
    return true;
  } catch {
    // Do not forward database, driver, or server errors; they may contain sensitive details.
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the sanitized failure path if rollback itself fails.
      }
    }
    try {
      dependencies.onFailure();
    } catch {
      // Keep the migration runner's failure result stable even if its logger fails.
    }
    return false;
  } finally {
    client?.release();
    try {
      await dependencies.pool.end();
    } catch {
      // Connection teardown errors are intentionally not exposed.
    }
  }
}
