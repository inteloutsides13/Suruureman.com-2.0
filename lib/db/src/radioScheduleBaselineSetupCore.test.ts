import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildPre0004ColumnContract, verifyPre0004Schema, PRE_0004_COLUMNS, PRE_0004_TABLES, PRE_0004_REQUIRED_OBJECTS } from "./radioScheduleBaselineContract.js";
import { prepareRadioScheduleBaseline } from "./radioScheduleBaselineSetupCore.js";
import { resolveRadioScheduleTestTarget } from "./radioScheduleTestTarget.js";

const target = resolveRadioScheduleTestTarget({
  RADIO_TEST_DATABASE_URL: "postgresql://test_user:test_password@test-db.example:5432/radio_schedule_test?sslmode=require",
  RADIO_SCHEDULE_TEST_EXPECTED_HOST: "test-db.example",
  RADIO_SCHEDULE_TEST_EXPECTED_DATABASE: "radio_schedule_test",
  RADIO_SCHEDULE_TEST_EXPECTED_USER: "test_user",
  RADIO_SCHEDULE_TEST_CONFIRM_TARGET: "test-db.example:5432/radio_schedule_test",
  RADIO_SCHEDULE_TEST_ALLOW_DATABASE_ACCESS: "I_CONFIRM_RADIO_SCHEDULE_TEST_DATABASE",
});

const validSnapshot = () => ({
  tables: [...PRE_0004_TABLES],
  columns: Object.entries(PRE_0004_COLUMNS).flatMap(([table, names]) =>
    names.map((column) => ({ table, column, type: "text", nullable: true, defaultValue: null })),
  ),
  objects: [...PRE_0004_REQUIRED_OBJECTS],
  foreignKeys: [
    "poems.created_by_user_id>admin_users.id:SET NULL", "poems.approved_by_user_id>admin_users.id:SET NULL",
    "poems.rejected_by_user_id>admin_users.id:SET NULL", "audit_logs.actor_user_id>admin_users.id:SET NULL",
    "radio_audio.poet_id>poets.id:SET NULL", "radio_audio.poem_id>poems.id:SET NULL",
    "radio_audio.created_by_user_id>admin_users.id:SET NULL", "radio_audio.approved_by_user_id>admin_users.id:SET NULL",
    "radio_audio.rejected_by_user_id>admin_users.id:SET NULL", "radio_playlists.created_by_user_id>admin_users.id:SET NULL",
    "radio_playlists.updated_by_user_id>admin_users.id:SET NULL", "radio_playlist_items.playlist_id>radio_playlists.id:CASCADE",
    "radio_playlist_items.audio_id>radio_audio.id:RESTRICT", "radio_schedules.playlist_id>radio_playlists.id:RESTRICT",
    "radio_schedules.created_by_user_id>admin_users.id:SET NULL", "radio_schedules.updated_by_user_id>admin_users.id:SET NULL",
    "radio_play_history.audio_id>radio_audio.id:SET NULL", "radio_play_history.playlist_id>radio_playlists.id:SET NULL",
    "radio_play_history.schedule_id>radio_schedules.id:SET NULL", "radio_manifests.published_by_user_id>admin_users.id:SET NULL",
  ],
  settings: [
    { table: "radio_audio", column: "category", nullable: true, defaultValue: null },
    { table: "radio_schedules", column: "timezone", nullable: false, defaultValue: "'Europe/Berlin'::text" },
  ],
});

test("pre-0004 verifier detects missing schema objects, timezone/category drift, and premature 0004", () => {
  assert.deepEqual(verifyPre0004Schema(validSnapshot()), []);
  const broken = validSnapshot();
  broken.columns.push({ table: "radio_schedules", column: "title_en", type: "text", nullable: true, defaultValue: null });
  broken.objects = broken.objects.filter((name) => name !== "idx_radio_audio_category");
  broken.settings[1].defaultValue = "'Asia/Dubai'::text";
  assert.ok(verifyPre0004Schema(broken).some((message) => message.includes("idx_radio_audio_category")));
  assert.ok(verifyPre0004Schema(broken).some((message) => message.includes("Europe/Berlin")));
  assert.ok(verifyPre0004Schema(broken).some((message) => message.includes("title_en")));
});

test("source migrations define a complete metadata contract for every pre-0004 column", async () => {
  const baseline = await readFile(new URL("../proposals/radio-schedule-test-baseline/0000_application_baseline.proposed.sql", import.meta.url), "utf8");
  const migrations = await Promise.all([
    readFile(new URL("../migrations/0001_radio_foundation.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0002_radio_editorial.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0003_radio_timezone_berlin.sql", import.meta.url), "utf8"),
  ]) as [string, string, string];
  const contract = buildPre0004ColumnContract(baseline, migrations);
  assert.equal(Object.values(contract).reduce((count, table) => count + Object.keys(table).length, 0),
    Object.values(PRE_0004_COLUMNS).reduce((count, columns) => count + columns.length, 0));
  const id = contract.radio_audio.id;
  assert.equal(id.type, "int4");
  assert.equal(id.nullable, false);
  assert.equal(id.defaultValue, "<serial>");
  const category = contract.radio_audio.category;
  assert.deepEqual(category, { name: "category", type: "text", nullable: true, defaultValue: null });
  assert.equal(contract.radio_schedules.timezone.defaultValue, "europe/berlin");

  const snapshot = validSnapshot();
  snapshot.columns = Object.entries(contract).flatMap(([table, fields]) =>
    Object.values(fields).map((field) => ({
      table, column: field.name, type: field.type, nullable: field.nullable,
      defaultValue: field.defaultValue === "<serial>" ? "nextval('test_id_seq'::regclass)" : field.defaultValue,
    })),
  );
  assert.deepEqual(verifyPre0004Schema(snapshot, contract), []);
  snapshot.columns.find((column) => column.table === "radio_audio" && column.column === "id")!.type = "text";
  assert.ok(verifyPre0004Schema(snapshot, contract).some((message) => message.includes("metadata mismatch radio_audio.id")));
});

test("fresh-database preflight refuses existing state before loading or applying any DDL", async () => {
  const calls: string[] = [];
  let loaded = false;
  let failed = false;
  const result = await prepareRadioScheduleBaseline(target, {
    pool: {
      async connect() {
        return {
          async query(query: string) {
            calls.push(query);
            return { rows: [{
              database_name: target.database, database_user: target.user,
              current_schema: "public", search_path: ["public"],
              relation_count: 1, routine_count: 0, type_count: 0, extra_schemas: null,
            }] };
          },
          release() {},
        };
      },
      async end() {},
    },
    async loadSql() { loaded = true; return { baseline: "DDL", migrations: ["001", "002", "003"] }; },
    onSuccess() { assert.fail("Unexpected setup success."); },
    onFailure() { failed = true; },
  });
  assert.equal(result, false);
  assert.equal(loaded, false);
  assert.equal(failed, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /current_database/);
});
