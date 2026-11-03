import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDatabaseConnection } from "./connection.js";
import { resolveRadioScheduleDbConnection } from "./radioScheduleDbConnection.js";

const explicitTestEnvironment = {
  RADIO_SCHEDULE_DB_TEST_MODE: "1",
  RADIO_SCHEDULE_TEST_ALLOW_DATABASE_ACCESS:
    "I_CONFIRM_RADIO_SCHEDULE_TEST_DATABASE",
  RADIO_TEST_DATABASE_URL:
    "postgresql://tester:unused@test-radio.example/radio_test?sslmode=require",
  RADIO_SCHEDULE_TEST_EXPECTED_HOST: "test-radio.example",
  RADIO_SCHEDULE_TEST_EXPECTED_DATABASE: "radio_test",
  RADIO_SCHEDULE_TEST_EXPECTED_USER: "tester",
  RADIO_SCHEDULE_TEST_CONFIRM_TARGET: "test-radio.example:5432/radio_test",
};

test("integration mode resolves only the explicitly approved test target", () => {
  const url = explicitTestEnvironment.RADIO_TEST_DATABASE_URL;
  assert.equal(resolveRadioScheduleDbConnection(explicitTestEnvironment), url);
});

test("integration mode refuses source and runtime targets rather than falling back", () => {
  assert.throws(
    () =>
      resolveRadioScheduleDbConnection({
        ...explicitTestEnvironment,
        DATABASE_URL:
          "postgresql://runtime:unused@runtime.example/runtime?sslmode=require",
        SOURCE_DATABASE_URL:
          "postgresql://source:unused@source.example/source?sslmode=require",
      }),
    /source-database setting is present/,
  );
});

test("an invalid integration-mode marker fails closed", () => {
  assert.throws(
    () =>
      resolveRadioScheduleDbConnection({
        ...explicitTestEnvironment,
        RADIO_SCHEDULE_DB_TEST_MODE: "true",
      }),
    /must be explicitly enabled/,
  );
});

test("normal application mode keeps resolving DATABASE_URL when no migration mode is set", () => {
  const url =
    "postgresql://runtime:private@runtime.example/runtime?sslmode=require";
  assert.equal(resolveDatabaseConnection({ DATABASE_URL: url }), url);
});
