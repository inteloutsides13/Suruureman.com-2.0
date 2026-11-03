# Suruur E Man — updated source audit

Audit date: 2026-10-06. This report supersedes the earlier source-blocker findings for the September 12 archives. It does not claim a completed migration.

## GitHub first

GitHub integration discovery still reports requires_setup and exposes no callable repository connection. Public reads of https://api.github.com/repos/inteloutsides13/Suruureman.com and its commits/main endpoint returned 404.

Therefore, current live GitHub HEAD remains unverified. A 404 without authentication does not establish whether the repository is private or unavailable.

## New archive

Input: attached_assets/suruuremancom_1791281577028.zip.

- Valid ZIP: all entries passed CRC verification.
- Archive size: 174,165,128 bytes.
- File entries: 2,452; uncompressed file bytes: 187,430,207.
- No absolute paths, parent traversal, or symlink entries were detected.
- Includes application source, local Git history, MASTER_BACKUP documentation, attached assets, generated build files, historical JSON snapshot files, and nested older source archives.

The raw archive is private audit evidence, not an import-ready source package. Do not commit or publish it, its old data snapshots, caches, or nested archives.

## Local Git provenance — verified from the archive

- HEAD points to refs/heads/main.
- Archived main SHA: 6de6088735bb33e19a5f88946db2f2b52f1ff207.
- Archived origin/main SHA: the same commit.
- Commit timestamp: 2026-09-21T10:36:01Z.
- Commit subject: Published your App.
- Origin remote, with credentials suppressed: https://github.com/inteloutsides13/Suruureman.com.
- All 383 tracked files in the ZIP exactly match their Git blob at that commit. No tracked file is missing or changed.
- Local tracked status is clean.
- git diff --check main passed in the isolated audit copy.

The matching origin/main is an archived tracking reference, not an independent fetch of GitHub today. The previous September 12 remote-name discrepancy is resolved for this new archive.

MASTER_BACKUP documents an older September 19 SHA; actual local Git objects and working-tree verification were used for the SHA above.

## Source-only import bundle

Prepared: migration-transfer/Suruur-e-Man_Source_6de6088.zip.

- 374 files: exact tracked application source/documentation/assets, excluding nine .agents entries.
- Size: 4,964,196 bytes.
- SHA-256: fd7c3f156b82dd42468ec094306ad06d5416249fb1f171a23a8982efceeefbe7.
- Excludes .git objects/config/hooks, all untracked files, historical data snapshots, nested backups, caches, generated dist output, and real .env files.
- Preserves .env.example, MASTER_BACKUP, manifests, lockfile, schemas, migrations, tests, and the application source.
- A limited scan found no literal Google-key, private-key-header, or bcrypt-hash-pattern candidates in the bundled files. This is not a comprehensive secret-scanning certification.
- No source logic was changed.

This is an import bundle, not a new competing GitHub repository and not a rewrite of the existing repository's history. GitHub synchronization must still be verified before the migration is declared complete.

## Protected current features — found in source

- /irab frontend and POST /api/irab/text backend.
- Gemini service, unchanged instruction file, output guard, and retry helper.
- Immediate first attempt, then retry delays of 1,000 / 3,000 / 5,000 ms; maximum four total attempts for transient provider failures.
- Frontend and backend e'raab access-guard code/tests.
- Latest sorting: updatedAt DESC, createdAt DESC, id DESC.
- Homepage query: sort=latest, limit=4.
- Shared backend poem required-field validation used by admin and contributor handlers.
- Public contributor application, review, activation, status, and contributor portal code.
- SMTP email implementation and configuration references.
- Radio source and tests, with the documented unconfigured-provider/runtime boundaries.

These are source findings and limited unit-test outcomes, not live authenticated workflow verification. OCR was not added.

## Architecture and database

React/Vite/Tailwind/Wouter/TanStack Query frontend; Express/TypeScript API; pnpm workspace; PostgreSQL via node-postgres and Drizzle; JWT/bcrypt authorization.

The current source defines 19 tables:

- poems, categories, poets, videos, events, contact_messages, settings, backups, admin_users, contributor_applications, tools, audit_logs.
- radio_audio, radio_playlists, radio_playlist_items, radio_schedules, radio_settings, radio_play_history, radio_manifests.

The API uses DATABASE_URL. Its deployed value, actual database provider, accessibility from the second account, live schema, and complete record counts are still unverified.

API startup still executes migrations and possible seeds before listening. Do not start it against a protected live database as a read-only test. Destructive seed/synchronization tools must not run against production.

## Database-backup findings

MASTER_BACKUP explicitly documents that it does not include an unencrypted production dump or a complete live-data recovery export.

The raw archive does contain historical .agents/backups JSON snapshots from June/July 2026. Some wrappers associate encoded payload strings with account, contact, and other table data. They were inspected only for dates, structure, and export markers; record values were not printed or restored.

These historical snapshots do not cover the current 19-table schema or establish preservation of current production records. They must not be substituted for a current complete database backup.

All 13 nested source archives were inspected by entry name. Their SQL entries are radio migrations; no PostgreSQL-native .dump/.backup file or additional SQL data export was identified.

**Database migration remains C — BLOCKED:** no safe live connection or verified, complete, current PostgreSQL dump is available.

## Environment variable names found in runtime source

- DATABASE_URL, JWT_SECRET, PORT, NODE_ENV, LOG_LEVEL, CORS_ORIGINS.
- GEMINI_API_KEY.
- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD.
- MAIL_FROM, MAIL_FROM_NAME, PUBLIC_APP_URL.
- RADIO_ADMIN_PERMISSIONS, RADIO_MACHINE_ID, RADIO_MACHINE_SECRET.
- SEED_DEV_PASSWORD, SEED_ADMIN_PASSWORD for bootstrap only.
- BASE_PATH and REPL_ID for build/development context.
- PROD_DATABASE_URL is referenced by the synchronization utility, not normal application startup.

Additional radio names and SESSION_SECRET are documented in .env.example; their presence does not by itself establish runtime requiredness. SMTP/public URL requirements must be inspected in implementation as well as .env.example.

No credential values were displayed or transferred to an application environment.

## Verification actually executed

| Check | Result |
|---|---|
| ZIP CRC/path safety | Passed |
| All archived tracked files versus local main Git blobs | 383/383 match |
| Local tracked status | Clean |
| git diff --check main | Passed |
| Pure backend unit tests | 15 passed, zero failed |
| Full API package test command | Attempted; missing tsx prevented test loading |
| Frontend package test command | Attempted; vitest not installed |
| Backend/frontend typechecks | Attempted; tsc not installed |
| API production build | Attempted; esbuild not installed |
| Frontend production build | Attempted; vite not installed |
| Live original-project connection retry | Failed: access service failed; retry later |
| Live database/auth/Gemini/SMTP/radio checks | Not performed |

The 15 passing tests are the original irabRetry, irabOutputGuard, and poemValidation test files, transformed into JavaScript with Node 24's built-in TypeScript transform and run with node:test in an isolated directory. No business logic or test assertions were modified. Dependencies, live credentials, database access, and network provider calls were not used.

This is not a pass for the full API test command: its fourth authentication test file requires dependencies. Dependency installation and full verification belong in the isolated destination project; no archived API workflow was started here.

## Next steps

1. Confirm the active destination account/workspace is the user's second Replit account before project creation.
2. Restore the source-only bundle into a new migration project, not a blank redesign. Keep private raw uploads out of Git/public deployment and import only the approved source bundle.
3. Install dependencies normally in that isolated project, without running API startup against the old database.
4. Obtain production DATABASE_URL and other required credentials through the destination project's Secrets flow, never chat or committed files. Prefer reusing the existing database only after read-only compatibility/access checks and startup-write safeguards.
5. If database reuse is unavailable, obtain a complete, current, encrypted/access-controlled PostgreSQL dump and restore into a separate new target. Verify rows, accounts, relationships, sequences, constraints, and relevant external storage.
6. Run full tests, typechecks, builds, and staged runtime checks; verify GitHub main independently when repository access becomes available.
7. Publish the new temporary deployment only after explicit confirmation. Do not alter the production custom domain without separate explicit cutover approval.

## Safety status

New migration project: not created.

New database/deployment: not created.

Production domain changed: NO.

Old project/database: no writes, deletions, migrations, resets, or deployment changes performed by this session. Their complete internal current state is not verified.

Application source: archived working tree verified and a source-only bundle prepared; no rebuild or redesign performed.

Migration completion: NOT COMPLETE. Source access is substantially resolved by the new archive; database preservation and destination setup remain blocked.
