import assert from "node:assert/strict";
import test from "node:test";
import {
  RADIO_SCHEDULE_DEV_APPROVAL,
  RADIO_SCHEDULE_DEV_TARGET_CONFIRMATION,
  resolveRadioScheduleReplitDevelopmentTarget,
  type RadioScheduleReplitDevelopmentEnvironment,
} from "./radioScheduleReplitDevelopmentTarget.js";

const validEnvironment = (): RadioScheduleReplitDevelopmentEnvironment => ({
  DATABASE_URL:
    "postgresql://dev_user:dev_password@provider-managed.example:5432/appdb?sslmode=require",
  REPLIT_DEV_DOMAIN: "workspace.replit.dev",
  RADIO_SCHEDULE_DEV_DATABASE_APPROVAL: RADIO_SCHEDULE_DEV_APPROVAL,
  RADIO_SCHEDULE_DEV_DATABASE_TARGET: RADIO_SCHEDULE_DEV_TARGET_CONFIRMATION,
});

test("refuses to resolve a Development target without explicit approval", () => {
  const env = validEnvironment();
  delete env.RADIO_SCHEDULE_DEV_DATABASE_APPROVAL;
  assert.throws(
    () => resolveRadioScheduleReplitDevelopmentTarget(env),
    /Explicit approval for the Replit Development database is required/,
  );
});

test("refuses to resolve a target when the Replit Database pane confirmation is missing", () => {
  const env = validEnvironment();
  delete env.RADIO_SCHEDULE_DEV_DATABASE_TARGET;
  assert.throws(
    () => resolveRadioScheduleReplitDevelopmentTarget(env),
    /Confirm the Replit Database pane is set to Development/,
  );
});

test("requires the platform Development workspace marker", () => {
  const env = validEnvironment();
  delete env.REPLIT_DEV_DOMAIN;
  assert.throws(
    () => resolveRadioScheduleReplitDevelopmentTarget(env),
    /must run in the Replit Development workspace/,
  );
});

test("refuses a missing Development connection and never falls back to the source URL", () => {
  const env = validEnvironment();
  delete env.DATABASE_URL;
  env.SOURCE_DATABASE_URL =
    "postgresql://source_user:source_password@source.example/prod";
  assert.throws(
    () => resolveRadioScheduleReplitDevelopmentTarget(env),
    /Missing required Development setting: DATABASE_URL/,
  );
});

test("accepts an ordinary database name without using its hostname or name as isolation proof", () => {
  const target =
    resolveRadioScheduleReplitDevelopmentTarget(validEnvironment());
  assert.equal(target.database, "appdb");
  assert.equal(target.host, "provider-managed.example");
  assert.equal(target.connectionString, validEnvironment().DATABASE_URL);
});

test("rejects non-TLS and target-overriding connection URLs", () => {
  const noTls = validEnvironment();
  noTls.DATABASE_URL =
    "postgresql://dev_user:dev_password@provider.example/appdb";
  assert.throws(
    () => resolveRadioScheduleReplitDevelopmentTarget(noTls),
    /secure TLS mode/,
  );

  const override = validEnvironment();
  override.DATABASE_URL =
    "postgresql://dev_user:dev_password@provider.example/appdb?sslmode=require&host=source.example";
  assert.throws(
    () => resolveRadioScheduleReplitDevelopmentTarget(override),
    /unsupported target overrides/,
  );
});
