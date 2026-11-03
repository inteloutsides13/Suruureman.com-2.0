# Radio Schedule disposable-test baseline proposal

**Disposable test database only. Review this procedure and baseline before use.**

## Proposed file order

1. `lib/db/proposals/radio-schedule-test-baseline/0000_application_baseline.proposed.sql`
2. `lib/db/migrations/0001_radio_foundation.sql`
3. `lib/db/migrations/0002_radio_editorial.sql`
4. `lib/db/migrations/0003_radio_timezone_berlin.sql`
5. Verify the pre-0004 schema. This setup does not apply
   `0004_radio_programme_schedule.sql`; the integration test does.

Each step is intended for a newly provisioned disposable PostgreSQL instance
whose physical separation from source and production has been independently
confirmed with the provider. The proposed baseline refuses to run if the
`public` schema already contains relations. It creates schema only: no roles,
grants, credentials, accounts, poems, or other records.

Do not use `db:push`, the API workflow, API startup, a database dump, or the
production-to-development data-sync script to prepare this test database.
API startup runs historical migrations and may seed application accounts and
tools. The current Drizzle model also includes migration 0004's columns, so a
full schema push would not leave the required pre-0004 state.

## Source-to-schema mapping

| Proposed definition                                                   | Authoritative source                                                                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `poets` columns and primary key                                       | `lib/db/src/schema/poems.ts` (`poetsTable`)                                                                                              |
| `poems` base columns, defaults, and primary key                       | `lib/db/src/schema/poems.ts` (`poemsTable`)                                                                                              |
| `admin_users` columns and defaults                                    | `lib/db/src/schema/poems.ts` (`usersTable`) plus `artifacts/api-server/src/lib/migrations.ts`                                            |
| `poems` creator/approver/rejecter foreign keys                        | `artifacts/api-server/src/lib/migrations.ts`; these are not declared on the Drizzle columns                                              |
| `audit_logs` columns and actor foreign key                            | `artifacts/api-server/src/lib/migrations.ts` (`CREATE TABLE`); the table shape is also in `lib/db/src/schema/poems.ts`                   |
| Admin, poem, and audit indexes                                        | `artifacts/api-server/src/lib/migrations.ts`                                                                                             |
| Timestamp type choice for startup-migration-added columns             | Startup DDL in `artifacts/api-server/src/lib/migrations.ts`; compatibility rule in `.agents/memory/migration-timestamp-compatibility.md` |
| Radio foundation tables, foreign keys, unique constraints and indexes | Existing migration `0001_radio_foundation.sql`                                                                                           |
| `radio_audio.category` and its index                                  | Existing migration `0002_radio_editorial.sql`                                                                                            |
| Pre-0004 schedule timezone default                                    | Existing migration `0003_radio_timezone_berlin.sql`                                                                                      |
| Integration-suite required empty tables and pre-0004 condition        | `lib/db/src/radioScheduleApi.integration.test.ts`                                                                                        |

The Radio migrations create `radio_audio`, `radio_playlists`,
`radio_playlist_items`, `radio_schedules`, `radio_settings`,
`radio_play_history`, and `radio_manifests`. Their external foreign-key targets
(`poets`, `poems`, and `admin_users`) are created first by the proposed baseline.
The integration suite also requires `audit_logs`, `admin_users`,
`radio_playlists`, and `radio_schedules`.

This is the minimum application-table subset needed for the Radio migration
dependencies and integration test. It intentionally does not create unrelated
tables such as categories, contributor applications, tools, or contact
messages. API startup's contributor-application schema and indexes are not
needed by the routes exercised in this suite; API startup itself must not be
used as the baseline runner.

## Source-to-schema discrepancy table

| Item                                                                                                         | Conflicting sources and evidence                                                                                                                                                                                   | Draft treatment                                                                                                                                                                                                               | Status and evidence still needed                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin_users.last_login_at`, `token_revoked_at`; `poems.approved_at`, `rejected_at`; `audit_logs.created_at` | `lib/db/src/schema/poems.ts` uses `timestamp()` without timezone for these fields. `artifacts/api-server/src/lib/migrations.ts` creates/adds them as `TIMESTAMPTZ`.                                                | Use `TIMESTAMPTZ`, matching the executable startup-migration DDL.                                                                                                                                                             | **Resolved for this proposal** by the migration history and the documented compatibility rule in `.agents/memory/migration-timestamp-compatibility.md`: preserve the database type established by historical DDL rather than changing it to match an outdated ORM decoder. This is repository evidence, not a live-database check.                                |
| `poets.created_at`                                                                                           | `lib/db/src/schema/poems.ts` and `MASTER_BACKUP/DATABASE/DATABASE_SCHEMA.md` omit the column. `scripts/src/sync-prod-to-dev.ts` explicitly reads `r.created_at` and inserts it into the destination `poets` table. | The minimum Radio-test baseline currently omits it; Radio migrations and the integration suite only require `poets.id`. This does not assert that the column is absent from application databases or support the sync script. | **Unresolved.** The sync script proves a real requirement of that sync path, but no checked-in migration or schema definition establishes the column or its type/nullability/default. Needed evidence: an authoritative data-free historical DDL/snapshot or an approved source schema history, and a decision whether the sync script or Drizzle model is stale. |
| `poems` creator/approver/rejecter FKs and `audit_logs.actor_user_id` FK                                      | `lib/db/src/schema/poems.ts` declares integer columns without references. `artifacts/api-server/src/lib/migrations.ts` adds the poem FKs and creates `audit_logs` with its actor FK, all `ON DELETE SET NULL`.     | Include the migration-defined FKs.                                                                                                                                                                                            | **Resolved for the application migration state** by explicit startup-migration SQL.                                                                                                                                                                                                                                                                               |
| `updated_at` backfill on poems                                                                               | `lib/db/src/schema/poems.ts` declares `updated_at`; startup SQL adds it, copies `created_at` into null values, then makes it defaulted and `NOT NULL`.                                                             | Declare it `TIMESTAMP NOT NULL DEFAULT NOW()` directly; no backfill is included because this baseline is only for an empty database.                                                                                          | **Resolved for an empty baseline only.** Do not use this draft to retrofit a populated table.                                                                                                                                                                                                                                                                     |
| Startup-migration indexes                                                                                    | `artifacts/api-server/src/lib/migrations.ts` creates admin, poem, audit, and contributor indexes; `poems.ts` does not declare all of them.                                                                         | Include all six admin/poem/audit indexes required by the suite; contributor indexes are outside this suite's minimum schema.                                                                                                  | **Resolved for the exercised routes** from explicit startup-migration SQL.                                                                                                                                                                                                                                                                                        |
| Radio category and schedule indexes                                                                          | `lib/db/src/schema/radio.ts` lacks the category index in migration 0002 and the two schedule indexes in migration 0004.                                                                                            | Apply migration 0002 for the category index. Leave 0004's indexes absent before the suite; 0004 creates them.                                                                                                                 | **Resolved by migration order**; the pre-suite checklist verifies the 0004 indexes are absent.                                                                                                                                                                                                                                                                    |
| Schedule timezone default                                                                                    | `lib/db/src/schema/radio.ts` and migration 0004 use `Asia/Dubai`; migration 0003 sets `Europe/Berlin`.                                                                                                             | Apply 0003 and stop before 0004, so the pre-suite default is `Europe/Berlin`.                                                                                                                                                 | **Resolved for the required pre-0004 state** by the explicit migration sequence.                                                                                                                                                                                                                                                                                  |
| Enum-like Drizzle declarations                                                                               | `poems.ts` and `radio.ts` use `text({ enum: [...] })`; the SQL migration history declares text columns and does not create PostgreSQL enum or `CHECK` constraints.                                                 | Keep these values as text; add no new database checks or enum types.                                                                                                                                                          | **Resolved from the declared SQL history**; no PostgreSQL enum/extension prerequisite was found in migrations 0001–0004.                                                                                                                                                                                                                                          |

Timestamp caveat: `artifacts/api-server/src/lib/migrations.ts` uses
`ADD COLUMN IF NOT EXISTS`, so it specifies a type only when a column is
absent. The proposal's `TIMESTAMPTZ` choices follow that migration DDL and the
documented existing compatibility finding in
`.agents/memory/migration-timestamp-compatibility.md`. This review did not
inspect a live database; the baseline creates these columns directly with the
selected types.

There are no PostgreSQL `CREATE TYPE` or `CREATE EXTENSION` dependencies in
Radio migrations 0001–0004. The baseline draft uses built-in PostgreSQL types
and `SERIAL`.

## Explicit disposable-database setup

Use a newly provisioned, disposable PostgreSQL database. Independently confirm
in the provider that its physical project/instance is separate from source and
production; hostname, database name, TLS, and confirmation text do not prove
provider-resource isolation.

Configure these process settings through the workspace's approved environment
configuration, not source control:

- `RADIO_TEST_DATABASE_URL`: explicit PostgreSQL URL with credentials and
  `sslmode=require` or `sslmode=verify-full`.
- `RADIO_SCHEDULE_TEST_EXPECTED_HOST`, `RADIO_SCHEDULE_TEST_EXPECTED_DATABASE`,
  and `RADIO_SCHEDULE_TEST_EXPECTED_USER`: separately confirmed identity.
- `RADIO_SCHEDULE_TEST_CONFIRM_TARGET`: exactly `<host>:<port>/<database>`.
- `RADIO_SCHEDULE_TEST_ALLOW_DATABASE_ACCESS`:
  `I_CONFIRM_RADIO_SCHEDULE_TEST_DATABASE`.

`SOURCE_DATABASE_URL` and migration strategy/read-only settings must be absent.
Production mode and known production URL settings are refused. If `DATABASE_URL`
is configured, it must not identify the same host, port, and database. The
dedicated database name must contain a delimited `test`, `testing`, or `sandbox`
marker. There is no fallback to runtime or production configuration.

After review and with those explicit settings configured, the exact setup
command is:

```sh
pnpm --filter @workspace/api-server run radio-schedule:test-db:setup
```

Before loading or applying DDL, the runner validates the target configuration,
connects only to `RADIO_TEST_DATABASE_URL`, checks the server-reported database
and role, requires `public` as the active first schema, and refuses any public
relation/routine/type or additional user schema. It never drops, truncates,
resets, or repairs objects. If setup fails after it has begun, any partial
state is left untouched; provision a new disposable database rather than
rerunning on a non-empty target.

The pre-0004 verifier checks the exact expected table and column inventories.
For every column it compares the PostgreSQL type, nullability, and default
against a contract parsed from the selected baseline and migrations 0001–0003.
It also checks required named primary/unique keys and indexes, foreign-key
targets and delete actions, nullable/no-default `radio_audio.category`,
`radio_schedules.timezone NOT NULL DEFAULT 'Europe/Berlin'`, and absence of
`radio_schedules.title_en`. Unknown source column types or schema inventory
drift fail closed. Failure exits nonzero with database diagnostics withheld.
Provider-level isolation remains the operator's responsibility.

The integration test applies 0004 separately:

```sh
pnpm --filter @workspace/api-server run test:radio-schedule:integration
```

Never run either command against production, the development application
database, or a database containing data that must be preserved. The integration
test creates and removes its own fixture rows; it does not reset tables.

## Pre-integration verification checklist

After a future approved setup, an operator must verify against the disposable
instance before running the integration suite:

- [ ] Provider project/instance/resource identity is distinct from source and
      production; hostnames, aliases, and database names alone are not proof.
- [ ] The target is empty before baseline application and contains no copied
      production records or credentials.
- [ ] Required tables exist: `admin_users`, `poets`, `poems`, `audit_logs`,
      `radio_audio`, `radio_playlists`, `radio_playlist_items`,
      `radio_schedules`, `radio_settings`, `radio_play_history`, and
      `radio_manifests`.
- [ ] `admin_users` has the test-required email, password hash, role, name,
      status, and token-revocation columns; `poems` has all Drizzle columns plus
      startup-migration attribution/workflow columns; `audit_logs` has all
      startup-migration columns.
- [ ] The startup-migration-added timestamp columns use the proposal's
      `TIMESTAMPTZ` types. This follows startup-migration DDL, not a live schema
      check; the corresponding Drizzle timestamp declarations remain different.
- [ ] `poets.created_at` remains outside this minimum baseline. Its contract is
      unresolved: `scripts/src/sync-prod-to-dev.ts` reads and writes that
      column, but checked-in schema/migration sources do not establish its
      type or nullability. This sync-script compatibility issue does not block
      the isolated Radio Schedule baseline.
- [ ] Radio migration foreign keys are present, including references from
      audio to poets/poems/users; playlist items to playlists/audio; schedules
      to playlists/users; history to audio/playlists/schedules; manifests to
      users; and the startup-migration poem/audit user references.
- [ ] Radio and application uniqueness constraints and indexes exist, including
      the indexes from migrations 0001–0003 and API startup migration.
- [ ] `radio_audio.category` is nullable text with the 0002 index.
- [ ] After 0003, `radio_schedules.timezone` defaults to `Europe/Berlin`.
- [ ] Migration 0004 remains unapplied: `playlist_id` is still `NOT NULL`, the
      timezone default is not yet changed to `Asia/Dubai`, and all eleven 0004
      columns are absent (`title_en`, `title_ur`, `description_en`,
      `description_ur`, `programme_type`, `poet_name`, `external_url`,
      `thumbnail_url`, `schedule_type`, `scheduled_date`, `public_note`).
- [ ] Migration 0004's two schedule indexes are absent before the suite.

The checklist describes the intended empty pre-0004 state. The new runner's
checks have not been run against a database; no database verification is
claimed here.

## Safest next step

Review this baseline and procedure before use. Do not add `poets.created_at`
without authoritative evidence. The timestamp choice follows startup-migration
history but remains mismatched with Drizzle and unverified against a live
database. The setup and integration commands are separate; only the latter
applies migration 0004.
