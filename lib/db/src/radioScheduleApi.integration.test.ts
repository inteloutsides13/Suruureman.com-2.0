import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import { test } from "node:test";
import pg from "pg";
import { runRadioScheduleMigrationOnVerifiedTarget } from "./radioScheduleTestRunnerCore.js";
import { resolveRadioScheduleTestTarget } from "./radioScheduleTestTarget.js";

const { Pool } = pg;

// Resolve only the dedicated test target. The test runner rejects SOURCE_DATABASE_URL,
// migration-selection settings, missing approvals, and runtime-target aliases before a pool exists.
const target = resolveRadioScheduleTestTarget(process.env);
delete process.env.DATABASE_URL;
process.env.RADIO_SCHEDULE_DB_TEST_MODE = "1";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(32).toString("hex");
process.env.RADIO_ADMIN_PERMISSIONS = "radio.schedules.manage";

function token(userId: number, email: string, role: string): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    userId,
    email,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}`;
  const signature = createHmac("sha256", process.env.JWT_SECRET!)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function nextDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

async function runMigration(
  options: { overrideVerifier?: boolean; failIdentityQuery?: boolean } = {},
): Promise<boolean> {
  const pool = new Pool({ connectionString: target.connectionString, max: 1 });
  return runRadioScheduleMigrationOnVerifiedTarget(target, {
    pool: {
      async connect() {
        const client = await pool.connect();
        return {
          async query(query: string, values?: unknown[]) {
            if (
              options.failIdentityQuery &&
              query.includes("current_database")
            ) {
              throw new Error(
                "Injected integration-test database query failure.",
              );
            }
            if (
              options.overrideVerifier &&
              query.includes("information_schema.columns")
            )
              return { rows: [] };
            return client.query(query, values);
          },
          release() {
            client.release();
          },
        };
      },
      end: () => pool.end(),
    },
    loadMigration: () =>
      readFile(
        new URL(
          "../migrations/0004_radio_programme_schedule.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    onSuccess() {},
    onFailure() {},
  });
}

test("Radio Schedule PostgreSQL migration and API integration", async (t) => {
  const dataPool = new Pool({
    connectionString: target.connectionString,
    max: 2,
  });
  const fixture = randomUUID().replaceAll("-", "");
  const emails = [
    `admin-${fixture}@radio-test.invalid`,
    `developer-${fixture}@radio-test.invalid`,
  ];
  const userIds: number[] = [];
  const scheduleIds: number[] = [];
  let playlistId: number | undefined;
  let server: Server | undefined;
  let appPool: { end(): Promise<void> } | undefined;

  try {
    const identity = await dataPool.query<{
      database_name: string;
      database_user: string;
    }>(
      "SELECT current_database() AS database_name, current_user AS database_user",
    );
    assert.equal(identity.rows[0]?.database_name, target.database);
    assert.equal(identity.rows[0]?.database_user, target.user);
    const oldColumn = await dataPool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='radio_schedules' AND column_name='title_en'",
    );
    assert.equal(
      oldColumn.rowCount,
      0,
      "Use a fresh disposable database with migrations 0001–0003 only.",
    );

    const baseline = await dataPool.query(
      "SELECT to_regclass('public.admin_users') AS users, to_regclass('public.radio_playlists') AS playlists, to_regclass('public.radio_schedules') AS schedules, to_regclass('public.audit_logs') AS audit",
    );
    assert.ok(
      baseline.rows[0]?.users &&
        baseline.rows[0]?.playlists &&
        baseline.rows[0]?.schedules &&
        baseline.rows[0]?.audit,
      "The isolated test database must have the application baseline and radio migrations 0001–0003.",
    );

    const userRows = await dataPool.query<{ id: number }>(
      "INSERT INTO admin_users(email,password_hash,role,name,status) VALUES ($1,'unused-test-hash','admin','Radio integration test','active'),($2,'unused-test-hash','developer','Radio integration test','active') RETURNING id",
      emails,
    );
    userIds.push(...userRows.rows.map((row) => row.id));
    const playlist = await dataPool.query<{ id: number }>(
      "INSERT INTO radio_playlists(name,status) VALUES ($1,'active') RETURNING id",
      [`integration-${fixture}`],
    );
    playlistId = playlist.rows[0].id;

    const legacy = await dataPool.query<{ id: number }>(
      `INSERT INTO radio_schedules
         (name,playlist_id,status,timezone,days_of_week,start_local_time,end_local_time,created_by_user_id)
       VALUES ($1,$2,'draft','Asia/Dubai','[0]','23:00','01:00',$3) RETURNING id`,
      [`legacy-${fixture}`, playlistId, userIds[0]],
    );
    scheduleIds.push(legacy.rows[0].id);

    await t.test(
      "verification failure rolls the migration back on PostgreSQL",
      async () => {
        assert.equal(await runMigration({ overrideVerifier: true }), false);
        const afterFailure = await dataPool.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='radio_schedules' AND column_name='title_en'",
        );
        assert.equal(afterFailure.rowCount, 0);
      },
    );

    await t.test(
      "database query failures fail closed without applying the migration",
      async () => {
        assert.equal(await runMigration({ failIdentityQuery: true }), false);
        const afterFailure = await dataPool.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='radio_schedules' AND column_name='title_en'",
        );
        assert.equal(afterFailure.rowCount, 0);
      },
    );

    await t.test(
      "migration preserves legacy rows, adds the specified schema, and is safe to apply twice",
      async () => {
        assert.equal(await runMigration(), true);
        const preserved = await dataPool.query(
          "SELECT id,name,playlist_id,start_local_time,end_local_time,timezone FROM radio_schedules WHERE id=$1",
          [legacy.rows[0].id],
        );
        assert.deepEqual(preserved.rows[0], {
          id: legacy.rows[0].id,
          name: `legacy-${fixture}`,
          playlist_id: playlistId,
          start_local_time: "23:00",
          end_local_time: "01:00",
          timezone: "Asia/Dubai",
        });

        const columns = await dataPool.query<{
          column_name: string;
          data_type: string;
          is_nullable: string;
          column_default: string | null;
        }>(
          `SELECT column_name,data_type,is_nullable,column_default
           FROM information_schema.columns
          WHERE table_schema='public' AND table_name='radio_schedules'`,
        );
        const byName = new Map(
          columns.rows.map((column) => [column.column_name, column]),
        );
        const nullableText = [
          "title_en",
          "title_ur",
          "description_en",
          "description_ur",
          "programme_type",
          "poet_name",
          "external_url",
          "thumbnail_url",
          "public_note",
        ];
        for (const name of nullableText) {
          assert.equal(byName.get(name)?.data_type, "text", name);
          assert.equal(byName.get(name)?.is_nullable, "YES", name);
          assert.equal(byName.get(name)?.column_default, null, name);
        }
        assert.deepEqual(
          [
            byName.get("schedule_type")?.data_type,
            byName.get("schedule_type")?.is_nullable,
            byName.get("schedule_type")?.column_default,
          ],
          ["text", "NO", "'WEEKLY'::text"],
        );
        assert.deepEqual(
          [
            byName.get("scheduled_date")?.data_type,
            byName.get("scheduled_date")?.is_nullable,
            byName.get("scheduled_date")?.column_default,
          ],
          ["date", "YES", null],
        );
        assert.equal(byName.get("playlist_id")?.is_nullable, "YES");
        assert.match(
          byName.get("timezone")?.column_default ?? "",
          /Asia\/Dubai/,
        );
        const indexes = await dataPool.query<{
          indexname: string;
          indexdef: string;
        }>(
          "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='radio_schedules'",
        );
        assert.ok(
          indexes.rows.some(
            (row) =>
              row.indexname === "idx_radio_schedules_programme_status_date" &&
              /\(status, scheduled_date\)/.test(row.indexdef),
          ),
        );
        assert.ok(
          indexes.rows.some(
            (row) =>
              row.indexname === "idx_radio_schedules_schedule_type" &&
              /\(schedule_type\)/.test(row.indexdef),
          ),
        );
        assert.equal(
          await runMigration(),
          true,
          "The migration should tolerate a second application.",
        );
      },
    );

    const appModuleUrl = new URL(
      "../../../artifacts/api-server/src/app.js",
      import.meta.url,
    );
    const [{ default: app }, dbModule] = await Promise.all([
      import(appModuleUrl.href),
      import("./index.js"),
    ]);
    appPool = dbModule.pool;
    const httpServer = await import("node:http");
    server = httpServer.createServer(app);
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const adminToken = token(userIds[0], emails[0], "admin");
    const developerToken = token(userIds[1], emails[1], "developer");
    const contributorToken = token(
      -1,
      `contributor-${fixture}@radio-test.invalid`,
      "contributor",
    );

    const call = async (
      path: string,
      auth = adminToken,
      method = "GET",
      body?: Record<string, unknown>,
    ) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${auth}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        status: response.status,
        body: (await response.json()) as Record<string, any>,
      };
    };
    const weekly = {
      titleEn: `Weekly ${fixture}`,
      titleUr: "ہفتہ وار",
      descriptionEn: "Integration fixture",
      descriptionUr: null,
      programmeType: "POETRY_HOUR",
      scheduleType: "WEEKLY",
      daysOfWeek: [0],
      startLocalTime: "23:00",
      endLocalTime: "01:00",
      timezone: "Asia/Dubai",
    };
    let weeklyId = 0;
    let oneTimeId = 0;

    await t.test(
      "authorization, CRUD, publication states, conflicts, and public calendar responses",
      async () => {
        assert.equal(
          (await call("/admin/radio/programmes", "", "GET")).status,
          401,
        );
        assert.equal(
          (await call("/admin/radio/programmes", contributorToken, "GET"))
            .status,
          403,
        );
        assert.equal(
          (await call("/admin/radio/programmes", developerToken)).status,
          200,
        );
        const created = await call(
          "/admin/radio/programmes",
          adminToken,
          "POST",
          weekly,
        );
        assert.equal(created.status, 201);
        weeklyId = created.body.programme.id;
        scheduleIds.push(weeklyId);
        const readProgramme = await call(
          `/admin/radio/programmes/${weeklyId}`,
          developerToken,
        );
        assert.equal(readProgramme.status, 200);
        assert.equal(readProgramme.body.programme.id, weeklyId);

        const draftPublic = await call(
          "/radio/schedule/weekly?startDate=2026-10-11",
          "",
          "GET",
        );
        assert.equal(draftPublic.status, 200);
        assert.equal(
          draftPublic.body.programmes.some((item: any) => item.id === weeklyId),
          false,
        );

        const updated = await call(
          `/admin/radio/programmes/${weeklyId}`,
          adminToken,
          "PUT",
          {
            ...weekly,
            titleEn: `Updated ${fixture}`,
          },
        );
        assert.equal(updated.status, 200);
        assert.equal(updated.body.programme.titleEn, `Updated ${fixture}`);
        assert.equal(
          (
            await call(
              `/admin/radio/programmes/${weeklyId}/publish`,
              adminToken,
              "POST",
            )
          ).status,
          200,
        );

        const conflict = await call(
          "/admin/radio/programmes/validate",
          adminToken,
          "POST",
          {
            ...weekly,
            titleEn: `Overlap ${fixture}`,
          },
        );
        assert.equal(conflict.status, 200);
        assert.equal(conflict.body.valid, false);
        assert.ok(conflict.body.conflicts.includes(weeklyId));
        const overlapCreated = await call(
          "/admin/radio/programmes",
          adminToken,
          "POST",
          {
            ...weekly,
            titleEn: `Overlap ${fixture}`,
          },
        );
        assert.equal(overlapCreated.status, 201);
        scheduleIds.push(overlapCreated.body.programme.id);
        const overlapPublish = await call(
          `/admin/radio/programmes/${overlapCreated.body.programme.id}/publish`,
          adminToken,
          "POST",
        );
        assert.equal(overlapPublish.status, 409);

        const publicWeekly = await call(
          "/radio/schedule/date/2026-10-11",
          "",
          "GET",
        );
        const occurrence = publicWeekly.body.programmes.find(
          (item: any) => item.id === weeklyId,
        );
        assert.ok(occurrence);
        assert.equal(occurrence.timezone, "Asia/Dubai");
        assert.equal(
          Date.parse(occurrence.endsAt) - Date.parse(occurrence.startsAt),
          2 * 60 * 60 * 1000,
        );
        assert.equal(
          (
            await call(
              "/admin/radio/programmes/schedule/weekly?startDate=2026-10-11",
            )
          ).body.days.length,
          7,
        );

        const unpublish = await call(
          `/admin/radio/programmes/${weeklyId}/unpublish`,
          adminToken,
          "POST",
        );
        assert.equal(unpublish.body.programme.status, "draft");
        assert.equal(
          (
            await call("/radio/schedule/date/2026-10-11", "", "GET")
          ).body.programmes.some((item: any) => item.id === weeklyId),
          false,
        );
        await call(
          `/admin/radio/programmes/${weeklyId}/publish`,
          adminToken,
          "POST",
        );
        const cancelled = await call(
          `/admin/radio/programmes/${weeklyId}/cancel`,
          adminToken,
          "POST",
        );
        assert.equal(cancelled.body.programme.status, "cancelled");
        assert.equal(
          (
            await call("/radio/schedule/date/2026-10-11", "", "GET")
          ).body.programmes.some((item: any) => item.id === weeklyId),
          false,
        );

        const oneTimeDate = nextDate("2026-10-11", 7);
        const oneTime = await call(
          "/admin/radio/programmes",
          adminToken,
          "POST",
          {
            ...weekly,
            titleEn: `One time ${fixture}`,
            scheduleType: "ONE_TIME",
            daysOfWeek: [],
            scheduledDate: oneTimeDate,
            startLocalTime: "02:00",
            endLocalTime: "03:00",
          },
        );
        assert.equal(oneTime.status, 201);
        oneTimeId = oneTime.body.programme.id;
        scheduleIds.push(oneTimeId);
        assert.equal(
          (
            await call(
              `/admin/radio/programmes/${oneTimeId}/publish`,
              adminToken,
              "POST",
            )
          ).status,
          200,
        );
        const dated = await call(
          `/radio/schedule/date/${oneTimeDate}`,
          "",
          "GET",
        );
        assert.ok(
          dated.body.programmes.some((item: any) => item.id === oneTimeId),
        );

        for (const [path, key] of [
          ["/radio/schedule/today", "programmes"],
          ["/radio/schedule/weekly", "programmes"],
          ["/radio/schedule/current", "currentlyScheduledProgramme"],
          ["/radio/schedule/next", "nextScheduledProgramme"],
          ["/radio/schedule/upcoming?limit=5", "programmes"],
        ]) {
          const response = await call(path, "", "GET");
          assert.equal(response.status, 200, path);
          assert.ok(key in response.body, path);
          assert.equal(response.body.timezone, "Asia/Dubai", path);
        }
        const status = await call("/radio/status", "", "GET");
        assert.equal(status.status, 200);
        assert.equal(typeof status.body.available, "boolean");
        assert.ok("nowPlaying" in status.body && "schedules" in status.body);
      },
    );
  } finally {
    if (server?.listening)
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    await appPool?.end();
    if (scheduleIds.length) {
      await dataPool.query(
        "DELETE FROM audit_logs WHERE actor_user_id = ANY($1::int[]) AND target_id = ANY($2::int[])",
        [userIds, scheduleIds],
      );
      await dataPool.query(
        "DELETE FROM radio_schedules WHERE id = ANY($1::int[])",
        [scheduleIds],
      );
    }
    if (playlistId) {
      await dataPool.query("DELETE FROM radio_playlists WHERE id = $1", [
        playlistId,
      ]);
    }
    if (userIds.length)
      await dataPool.query(
        "DELETE FROM admin_users WHERE id = ANY($1::int[])",
        [userIds],
      );
    await dataPool.end();
  }
});
