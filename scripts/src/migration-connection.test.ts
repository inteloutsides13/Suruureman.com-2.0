import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDatabaseConnection } from "@workspace/db/connection";

test("normal non-migration startup retains the original database selection", () => {
  assert.equal(resolveDatabaseConnection({ DATABASE_URL: "postgresql://fixture:fixture@localhost/original" }),
    "postgresql://fixture:fixture@localhost/original");
});
test("approved reuse selects the source, never the destination's default database", () => {
  const uri = resolveDatabaseConnection({
    MIGRATION_DATABASE_STRATEGY: "reuse-original",
    SOURCE_DATABASE_URL: "postgresql://fixture:fixture@localhost/source",
    DATABASE_URL: "postgresql://fixture:fixture@localhost/empty",
  });
  assert.equal(new URL(uri).pathname, "/source");
  assert.match(new URL(uri).searchParams.get("options") ?? "", /default_transaction_read_only=on/);
});
test("missing source credentials fail rather than falling back to an empty database", () => {
  assert.throws(() => resolveDatabaseConnection({
    MIGRATION_DATABASE_STRATEGY: "reuse-original",
    DATABASE_URL: "postgresql://fixture:fixture@localhost/empty",
  }), /SOURCE_DATABASE_URL/);
});
test("unsupported strategies and malformed flags fail explicitly", () => {
  assert.throws(() => resolveDatabaseConnection({ MIGRATION_DATABASE_STRATEGY: "other" }), /Unsupported/);
  assert.throws(() => resolveDatabaseConnection({
    MIGRATION_DATABASE_STRATEGY: "reuse-original",
    SOURCE_DATABASE_URL: "postgresql://fixture:fixture@localhost/source",
    MIGRATION_DATABASE_READ_ONLY: "maybe",
  }), /must be true or false/);
});
test("invalid URI errors never expose source credentials", () => {
  assert.throws(() => resolveDatabaseConnection({
    MIGRATION_DATABASE_STRATEGY: "reuse-original", SOURCE_DATABASE_URL: "PRIVATE_FIXTURE_NOT_A_URL",
  }), (error: unknown) => error instanceof Error && !error.message.includes("PRIVATE_FIXTURE"));
});
test("read-only mode preserves existing connection options", () => {
  const uri = resolveDatabaseConnection({
    MIGRATION_DATABASE_STRATEGY: "reuse-original",
    SOURCE_DATABASE_URL: "postgresql://fixture:fixture@localhost/source?options=-c%20statement_timeout%3D5000",
  });
  assert.match(new URL(uri).searchParams.get("options") ?? "", /statement_timeout=5000.*default_transaction_read_only=on/);
});
test("write mode requires an explicit false setting", () => {
  const uri = resolveDatabaseConnection({
    MIGRATION_DATABASE_STRATEGY: "reuse-original",
    SOURCE_DATABASE_URL: "postgresql://fixture:fixture@localhost/source",
    MIGRATION_DATABASE_READ_ONLY: "false",
  });
  assert.equal(new URL(uri).searchParams.get("options"), null);
});
