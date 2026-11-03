import assert from "node:assert/strict";
import test from "node:test";
import { runRadioScheduleMigrationOnVerifiedTarget } from "./radioScheduleTestRunnerCore.js";
import {
  RADIO_SCHEDULE_TEST_CONFIRMATION,
  resolveRadioScheduleTestTarget,
  type RadioScheduleTestEnvironment,
} from "./radioScheduleTestTarget.js";

const validEnvironment = (): RadioScheduleTestEnvironment => ({
  RADIO_TEST_DATABASE_URL:
    "postgresql://test_user:test_password@test-db.example:5432/radio_schedule_test?sslmode=require",
  RADIO_SCHEDULE_TEST_EXPECTED_HOST: "test-db.example",
  RADIO_SCHEDULE_TEST_EXPECTED_DATABASE: "radio_schedule_test",
  RADIO_SCHEDULE_TEST_EXPECTED_USER: "test_user",
  RADIO_SCHEDULE_TEST_CONFIRM_TARGET:
    "test-db.example:5432/radio_schedule_test",
  RADIO_SCHEDULE_TEST_ALLOW_DATABASE_ACCESS: RADIO_SCHEDULE_TEST_CONFIRMATION,
});

test("refuses to run without explicit database access approval", () => {
  const env = validEnvironment();
  delete env.RADIO_SCHEDULE_TEST_ALLOW_DATABASE_ACCESS;
  assert.throws(
    () => resolveRadioScheduleTestTarget(env),
    /Explicit database-access approval/,
  );
});

test("does not fall back to DATABASE_URL when the dedicated target is missing", () => {
  const env = validEnvironment();
  delete env.RADIO_TEST_DATABASE_URL;
  env.DATABASE_URL =
    "postgresql://runtime_user:runtime_password@runtime.example/radio_schedule_test";
  assert.throws(
    () => resolveRadioScheduleTestTarget(env),
    /Missing required test setting: RADIO_TEST_DATABASE_URL/,
  );
});

test("refuses original-database reuse and a present source credential", () => {
  assert.throws(
    () =>
      resolveRadioScheduleTestTarget({
        ...validEnvironment(),
        MIGRATION_DATABASE_STRATEGY: "unexpected",
      }),
    /migration database settings are present/,
  );
  assert.throws(
    () =>
      resolveRadioScheduleTestTarget({
        ...validEnvironment(),
        SOURCE_DATABASE_URL: "",
      }),
    /source-database setting is present/,
  );
  assert.throws(
    () =>
      resolveRadioScheduleTestTarget({
        ...validEnvironment(),
        MIGRATION_DATABASE_READ_ONLY: "false",
      }),
    /migration database settings are present/,
  );
});

test("refuses production mode and explicitly configured production targets", () => {
  for (const env of [
    { ...validEnvironment(), NODE_ENV: "production" },
    { ...validEnvironment(), PRODUCTION_DATABASE_URL: "" },
    { ...validEnvironment(), PROD_DATABASE_URL: "unused" },
    { ...validEnvironment(), DATABASE_PRODUCTION_URL: "unused" },
  ]) {
    assert.throws(() => resolveRadioScheduleTestTarget(env), /Refusing Radio Schedule test database access/);
  }
});

test("requires a clearly named test database and exact host/database confirmation", () => {
  assert.throws(
    () =>
      resolveRadioScheduleTestTarget({
        ...validEnvironment(),
        RADIO_TEST_DATABASE_URL:
          "postgresql://u:p@test-db.example/prod?sslmode=require",
        RADIO_SCHEDULE_TEST_EXPECTED_DATABASE: "prod",
        RADIO_SCHEDULE_TEST_CONFIRM_TARGET: "test-db.example:5432/prod",
      }),
    /clearly identify a test or sandbox database/,
  );
  assert.throws(
    () =>
      resolveRadioScheduleTestTarget({
        ...validEnvironment(),
        RADIO_SCHEDULE_TEST_CONFIRM_TARGET: "wrong-target",
      }),
    /confirmation does not match/,
  );
});

test("rejects a target that aliases the runtime-managed database", () => {
  const env = validEnvironment();
  env.DATABASE_URL =
    "postgresql://other_user:other_password@test-db.example:5432/radio_schedule_test";
  assert.throws(
    () => resolveRadioScheduleTestTarget(env),
    /must not be the runtime-managed database target/,
  );
});

test("detects direct target aliases despite casing, default ports, or different credentials", () => {
  const env = validEnvironment();
  env.DATABASE_URL =
    "postgresql://runtime_user:runtime_password@TEST-DB.EXAMPLE/radio_schedule_test";
  assert.throws(
    () => resolveRadioScheduleTestTarget(env),
    /must not be the runtime-managed database target/,
  );
});

test("rejects connection parameters that could override the URL's target", () => {
  const env = validEnvironment();
  env.RADIO_TEST_DATABASE_URL =
    "postgresql://test_user:test_password@test-db.example:5432/radio_schedule_test?sslmode=require&host=prod-db.example";
  assert.throws(
    () => resolveRadioScheduleTestTarget(env),
    /unsupported connection overrides/,
  );
});

test("rejects duplicate TLS parameters so the driver cannot select a weaker value", () => {
  const env = validEnvironment();
  env.RADIO_TEST_DATABASE_URL =
    "postgresql://test_user:test_password@test-db.example:5432/radio_schedule_test?sslmode=verify-full&sslmode=disable";
  assert.throws(
    () => resolveRadioScheduleTestTarget(env),
    /TLS mode exactly once/,
  );
});

test("rejects malformed URLs, missing TLS, and a target URL with a source-style strategy", () => {
  const env = validEnvironment();
  env.RADIO_TEST_DATABASE_URL = "not-a-postgresql-url";
  assert.throws(
    () => resolveRadioScheduleTestTarget(env),
    /valid PostgreSQL URL/,
  );
  env.RADIO_TEST_DATABASE_URL =
    "postgresql://test_user:test_password@test-db.example/radio_schedule_test";
  assert.throws(
    () => resolveRadioScheduleTestTarget(env),
    /explicitly require TLS/,
  );
});

test("returns only the parsed non-secret target identity alongside the connection string", () => {
  const result = resolveRadioScheduleTestTarget(validEnvironment());
  assert.equal(result.host, "test-db.example");
  assert.equal(result.port, 5432);
  assert.equal(result.database, "radio_schedule_test");
  assert.equal(result.user, "test_user");
  assert.equal(
    result.connectionString,
    validEnvironment().RADIO_TEST_DATABASE_URL,
  );
});

test("does not include supplied URLs or passwords in validation errors", () => {
  const secretUrl = "postgresql://private_user:never-print-me@db.example/prod";
  assert.throws(
    () =>
      resolveRadioScheduleTestTarget({
        ...validEnvironment(),
        RADIO_SCHEDULE_TEST_DATABASE_URL: secretUrl,
        RADIO_SCHEDULE_TEST_EXPECTED_HOST: "different.example",
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes(secretUrl), false);
      assert.equal(error.message.includes("never-print-me"), false);
      return true;
    },
  );
});

test("checks database and role identity before loading or executing migration SQL", async () => {
  const target = resolveRadioScheduleTestTarget(validEnvironment());
  const queryOrder: string[] = [];
  let migrationLoads = 0;
  let failureLogs = 0;
  const result = await runRadioScheduleMigrationOnVerifiedTarget(target, {
    pool: {
      async connect() {
        return {
          async query(query) {
            queryOrder.push(query);
            return {
              rows: [
                {
                  database_name: "different_database",
                  database_user: target.user,
                },
              ],
            };
          },
          release() {},
        };
      },
      async end() {},
    },
    async loadMigration() {
      migrationLoads += 1;
      return "DO NOT EXECUTE";
    },
    onSuccess() {
      assert.fail("Unexpected successful migration.");
    },
    onFailure() {
      failureLogs += 1;
    },
  });
  assert.equal(result, false);
  assert.deepEqual(queryOrder, [
    "BEGIN",
    "SELECT current_database() AS database_name, current_user AS database_user",
    "ROLLBACK",
  ]);
  assert.equal(migrationLoads, 0);
  assert.equal(failureLogs, 1);
});

test("requires the baseline table before migration and applies SQL only after the identity check", async () => {
  const target = resolveRadioScheduleTestTarget(validEnvironment());
  const queryOrder: string[] = [];
  let migrationLoads = 0;
  const result = await runRadioScheduleMigrationOnVerifiedTarget(target, {
    pool: {
      async connect() {
        return {
          async query(query) {
            queryOrder.push(query);
            if (query.includes("current_database")) {
              return {
                rows: [
                  {
                    database_name: target.database,
                    database_user: target.user,
                  },
                ],
              };
            }
            return { rows: [{ schedule_table: null }] };
          },
          release() {},
        };
      },
      async end() {},
    },
    async loadMigration() {
      migrationLoads += 1;
      return "DO NOT EXECUTE";
    },
    onSuccess() {
      assert.fail("Unexpected successful migration.");
    },
    onFailure() {},
  });
  assert.equal(result, false);
  assert.deepEqual(queryOrder, [
    "BEGIN",
    "SELECT current_database() AS database_name, current_user AS database_user",
    "SELECT to_regclass('public.radio_schedules')::text AS schedule_table",
    "ROLLBACK",
  ]);
  assert.equal(migrationLoads, 0);
});

test("does not expose database error text in runner failure logs", async () => {
  const target = resolveRadioScheduleTestTarget(validEnvironment());
  let failureArguments: unknown[] = [];
  const result = await runRadioScheduleMigrationOnVerifiedTarget(target, {
    pool: {
      async connect() {
        return {
          async query() {
            throw new Error(
              "password=private-value postgresql://u:secret@host/db",
            );
          },
          release() {},
        };
      },
      async end() {},
    },
    async loadMigration() {
      return "DO NOT EXECUTE";
    },
    onSuccess() {
      assert.fail("Unexpected successful migration.");
    },
    onFailure(...args) {
      failureArguments = args;
    },
  });
  assert.equal(result, false);
  assert.deepEqual(failureArguments, []);
  assert.doesNotMatch(
    JSON.stringify(failureArguments),
    /private-value|secret|postgresql:\/\//,
  );
});

test("on success, verifies schema only after applying migration to the matched database and role", async () => {
  const target = resolveRadioScheduleTestTarget(validEnvironment());
  const calls: string[] = [];
  const requiredColumns = [
    "title_en",
    "title_ur",
    "description_en",
    "description_ur",
    "programme_type",
    "schedule_type",
    "scheduled_date",
    "public_note",
  ];
  let successLogged = false;
  const result = await runRadioScheduleMigrationOnVerifiedTarget(target, {
    pool: {
      async connect() {
        return {
          async query(query) {
            calls.push(query);
            if (query.includes("current_database")) {
              return {
                rows: [
                  {
                    database_name: target.database,
                    database_user: target.user,
                  },
                ],
              };
            }
            if (query.includes("to_regclass"))
              return { rows: [{ schedule_table: "radio_schedules" }] };
            if (query.includes("information_schema.columns")) {
              return {
                rows: requiredColumns.map((column_name) => ({ column_name })),
              };
            }
            if (query === "BEGIN") return { rows: [] };
            if (query === "COMMIT") return { rows: [] };
            if (query === "ROLLBACK") return { rows: [] };
            assert.equal(query, "MIGRATION TEST FIXTURE");
            return { rows: [] };
          },
          release() {},
        };
      },
      async end() {
        calls.push("pool.end");
      },
    },
    async loadMigration() {
      calls.push("load-migration");
      return "MIGRATION TEST FIXTURE";
    },
    onSuccess(identity) {
      assert.deepEqual(identity, {
        host: target.host,
        port: target.port,
        database: target.database,
      });
      successLogged = true;
    },
    onFailure() {
      assert.fail("Unexpected failure.");
    },
  });
  assert.equal(result, true);
  assert.equal(successLogged, true);
  assert.deepEqual(calls.slice(0, 7), [
    "BEGIN",
    "SELECT current_database() AS database_name, current_user AS database_user",
    "SELECT to_regclass('public.radio_schedules')::text AS schedule_table",
    "load-migration",
    "MIGRATION TEST FIXTURE",
    calls[5],
    "COMMIT",
  ]);
  assert.match(calls[5], /information_schema\.columns/);
  assert.equal(calls[7], "pool.end");
});

test("rolls the migration back when post-migration verification fails", async () => {
  const target = resolveRadioScheduleTestTarget(validEnvironment());
  const calls: string[] = [];
  const result = await runRadioScheduleMigrationOnVerifiedTarget(target, {
    pool: {
      async connect() {
        return {
          async query(query) {
            calls.push(query);
            if (query.includes("current_database")) {
              return {
                rows: [
                  {
                    database_name: target.database,
                    database_user: target.user,
                  },
                ],
              };
            }
            if (query.includes("to_regclass"))
              return { rows: [{ schedule_table: "radio_schedules" }] };
            if (query.includes("information_schema.columns"))
              return { rows: [] };
            if (query === "COMMIT")
              assert.fail("A failed verification must not commit.");
            return { rows: [] };
          },
          release() {},
        };
      },
      async end() {},
    },
    async loadMigration() {
      return "MIGRATION TEST FIXTURE";
    },
    onSuccess() {
      assert.fail("Failed verification must not report success.");
    },
    onFailure() {},
  });
  assert.equal(result, false);
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.equal(calls.includes("COMMIT"), false);
});
