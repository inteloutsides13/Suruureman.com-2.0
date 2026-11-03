# Migrations

## Radio SQL migrations

- `lib/db/migrations/0001_radio_foundation.sql`: creates the radio foundation
  tables, foreign keys, indexes, and constraints.
- `0002_radio_editorial.sql`: adds `radio_audio.category` and its index.
- `0003_radio_timezone_berlin.sql`: changes the default for future schedule rows
  to `Europe/Berlin`; it does not rewrite existing rows.

## Startup migration

`artifacts/api-server/src/lib/migrations.ts` runs idempotent SQL at API startup.
It adds admin lifecycle columns, poem approval columns, the audit log table,
contributor applications/activation fields, and performance indexes. It uses
`IF NOT EXISTS`, logs failures, and allows the server to continue. A clone
operator must still inspect startup logs and verify the resulting schema.

## Schema workflow

`lib/db/package.json` provides `pnpm --filter @workspace/db run push` and
`push-force` through Drizzle Kit. Prefer reviewable, non-destructive changes;
never use `push-force` against production without an approved database plan.
Replit-managed production schema changes follow the platform publish flow.