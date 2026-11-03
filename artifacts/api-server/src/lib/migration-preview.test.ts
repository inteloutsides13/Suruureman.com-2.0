import assert from "node:assert/strict";
import { test } from "node:test";
import { isReadOnlyMigrationPreview } from "./migrationMode.js";

test("ordinary non-migration requests keep their existing behavior", () => {
  delete process.env.MIGRATION_DATABASE_STRATEGY;
  assert.equal(isReadOnlyMigrationPreview(), false);
});
test("approved reuse defaults to a read-only preview", () => {
  process.env.MIGRATION_DATABASE_STRATEGY = "reuse-original";
  delete process.env.MIGRATION_DATABASE_READ_ONLY;
  assert.equal(isReadOnlyMigrationPreview(), true);
});
test("leaving read-only mode requires explicit configuration", () => {
  process.env.MIGRATION_DATABASE_READ_ONLY = "false";
  assert.equal(isReadOnlyMigrationPreview(), false);
});
test("read-only preview blocks mutations before database or provider access", async () => {
  process.env.MIGRATION_DATABASE_READ_ONLY = "true";
  process.env.SOURCE_DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/unreachable";
  const { default: app } = await import("../app.js");
  const { pool } = await import("@workspace/db");
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    for (const route of ["/api/admin/login", "/api/contact", "/api/poems/1/like", "/api/irab/text/other"]) {
      const response = await fetch(`${origin}${route}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      assert.equal(response.status, 423);
      assert.match((await response.json() as { message: string }).message, /read-only/);
    }
    for (const [route, method] of [
      ["/api/admin/radio-calendar/programmes", "POST"],
      ["/api/admin/radio-calendar/programmes/1", "PUT"],
      ["/api/admin/radio-calendar/programmes/1/publish", "POST"],
      ["/api/admin/radio-calendar/programmes/1/cancel", "POST"],
    ] as const) {
      const response = await fetch(`${origin}${route}`, {
        method, headers: { "Content-Type": "application/json" }, body: "{}",
      });
      assert.equal(response.status, 423);
      assert.match((await response.json() as { message: string }).message, /read-only/);
    }
    const irab = await fetch(`${origin}/api/irab/text`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: '{"text":"یہ کتاب ہے"}',
    });
    assert.equal(irab.status, 401, "stateless text processing must still require original authorization");
    const otherMethod = await fetch(`${origin}/api/irab/text`, { method: "PUT" });
    assert.equal(otherMethod.status, 423, "only the exact stateless POST is allowed");
    const health = await fetch(`${origin}/api/healthz`);
    assert.equal(health.status, 200);
    assert.equal(pool.totalCount, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
