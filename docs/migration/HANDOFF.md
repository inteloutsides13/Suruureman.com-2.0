# Suruur E Man migration — immediate project instructions

**Latest destination status:** Source restoration is complete. The migration-safe development API remains database-read-only, serving 790 published poems. Sign-in/stored-data mutations stay blocked and production remains gated. Only exact stateless text processing is permitted through the original JWT/role/account checks. All three allowed role sessions and protected desktop/mobile UI were verified; real Gemini text processing succeeded with HTTP 200 after one original transient retry and passed the unchanged output guard. Earlier 503/timeouts show intermittent provider availability. SMTP connectivity/authentication passed without sending mail. Password sign-in, email delivery and write-enabled workflows remain unverified. No database DDL/data, publishing or DNS changes. See [ERAAB_RESTORATION.md](ERAAB_RESTORATION.md), [DESTINATION_STATUS.md](DESTINATION_STATUS.md) and [SOURCE_DATABASE_AUDIT.md](SOURCE_DATABASE_AUDIT.md). Verification notes below describe the earlier handoff state.

The user confirmed this conversation is under their SECOND Replit account and authorized creation of the new migration project here.

## Restore, do not rebuild

Use migration-transfer/Suruur-e-Man_Source_6de6088.zip as the authoritative source import bundle. It contains 374 exact tracked source/documentation/assets files from archived main commit 6de6088735bb33e19a5f88946db2f2b52f1ff207, excluding nine .agents entries.

Expected bundle SHA-256: fd7c3f156b82dd42468ec094306ad06d5416249fb1f171a23a8982efceeefbe7.

Read CURRENT_SOURCE_AUDIT.md and the user's original migration request in the conversation before doing work.

Restore the existing pnpm monorepo into the project source root. Do not scaffold or redesign a replacement website. Inspect existing destination files first; handle any conflicts explicitly. Preserve source, assets, schemas, migrations, API clients/specification, tests, documentation, and lockfile. Only make genuine migration compatibility fixes.

The source-only ZIP includes original .replit/artifact metadata. Adapt destination identifiers/registration only as needed for the NEW project; preserve routes, ports, build commands, and application behavior. Register the actual API and surrur-e-mann frontend, not the old audit copies.

Historical source audit directories remain under migration-audit-l20cg2pm and are NOT the app to run. Their artifact.toml files were renamed to artifact.toml.audit-only to prevent automatic workflow registration. Do not reactivate them or launch their workflows.

## Privacy and Git

Do not extract or commit the full raw uploaded archive, .git internals, historical .agents/backups, nested backups, build output, caches, temporary files, real .env files, or credentials. Raw uploads are private audit evidence only.

The staging root .gitignore protects attached_assets, audit trees, and source ZIPs. When restoring the original source .gitignore, retain these staging exclusions. Original source already ignores attached_assets and .agents.

Do not create a competing GitHub repository, push, rewrite history, or delete source commits. Required remote is https://github.com/inteloutsides13/Suruureman.com and branch main. Live GitHub access remains unavailable, so current remote synchronization must still be verified separately.

Archived main and origin/main agree at the SHA above; all 383 tracked files matched their Git blobs. This proves local export integrity, not today's remote HEAD.

## Database safety — hard blocker

No verified complete CURRENT production PostgreSQL dump is included. MASTER_BACKUP documentation explicitly states that its package is source/schema/documentation, not live database recovery data.

The raw ZIP has historical June/July JSON snapshots and September nested source backups. These are not a replacement for the current database. Do not restore them as complete production data.

Do not provision an empty replacement database and claim success. Do not reset, drop, truncate, overwrite, or otherwise modify the old database.

The API startup executes migrations and possible privileged-user/tools seeds. DO NOT start it against the original production DATABASE_URL for a read-only compatibility test. Do not run destructive seed.ts, sync-prod-to-dev.ts, Drizzle push, or push-force against production.

Determine database provider and access safely. Prefer reusing the existing DB only after live schema/access compatibility checks and startup-write safeguards. If it cannot be reused, restore a complete current PostgreSQL native dump into a separate new target and verify records, relationships, sequences, and database objects.

Credentials must come through destination project Secrets/environment tooling, never chat or source. Do not print them. Inspect actual SMTP/Gemini/public URL/radio environment requirements; .env.example is incomplete for SMTP.

If no safe live access or complete dump can be obtained, database status remains C — BLOCKED. Continue independent source/build verification without claiming full migration.

## Protected behavior

Preserve /irab and POST /api/irab/text, roles developer/admin/contributor, visitor blocking, original irabInstructions.ts, output guard, immediate first attempt followed by 1/3/5-second retries, maximum four attempts. Do not add OCR.

Preserve shared poem required-field validation, optional image/featured fields, contributor applications/activation/status/submissions/ownership/approval, and existing data.

Preserve latest order updatedAt DESC, createdAt DESC, id DESC and homepage GET /api/poems?sort=latest&limit=4 as highest-priority poetry section.

Preserve public pages, search, mobile navigation, video/tools/radio UI, and existing provider-unconfigured boundaries rather than inventing a radio runtime.

## Verification to complete

Install dependencies normally in the isolated destination project without automatically launching a live-data-writing API.

Run backend and frontend tests, both typechecks, both production builds, and git diff --check. Read tests first and isolate DB/provider-dependent calls. Do not create test production records.

Already executed in the conversation:

- Archive CRC/path integrity and tracked source verification passed.
- git diff --check main passed in the isolated archive copy.
- 15 original pure backend tests passed using Node 24 TypeScript transformation: retry, output guard, poem validation.
- Full package tests/typechecks/builds were attempted and blocked by missing tsx/vitest/tsc/esbuild/vite, not proven application logic defects.

The full auth test and frontend suites still need actual execution after dependencies are installed. Live login, contributor, Gemini, SMTP, database, and radio runtime outcomes remain unverified.

## Deployment and report

No production publishing has been performed. Obtain explicit confirmation before publishing the NEW temporary deployment. Verify it and provide factual migration status before proposing domain cutover.

Do not change https://suruureman.com, DNS, or old deployment without separate explicit cutover approval.

Keep old project and DB preserved. Document rollback to old deployment, including any new data written after a database copy. Final report must distinguish archived source facts, live verification, executed checks, and unresolved blockers.
