# Suruur E Man — destination migration status

Date: 2026-10-06.

## Current result

The new migration project has been created in the destination account confirmed by the user. The existing application source is restored, not rebuilt or redesigned.

**Migration is NOT complete. The original JWT_SECRET was supplied securely, and the development API now serves original records in read-only mode. Production remains gated.**

The supplied SOURCE_DATABASE_URL reaches the original Neon PostgreSQL database. A repeatable-read, read-only transaction confirmed all 19 expected tables, required columns, and compatible types after a source-only timestamp decoding correction. Published poem totals and latest ordering match the old site's public API. The transaction was rolled back without writes.

The automatically supplied destination development database has not been treated as migrated data, initialized with application tables, or seeded by this work. No database has been copied or restored. See [SOURCE_DATABASE_AUDIT.md](SOURCE_DATABASE_AUDIT.md).

The user selected shared original-database reuse. The new pool configuration was tested against the actual source and PostgreSQL confirmed default_transaction_read_only=on. The development workflow now uses the migration-safe entrypoint; the production command still uses the safety gate.

## Source and Git

- Required GitHub repository: https://github.com/inteloutsides13/Suruureman.com, branch main.
- Verified archived source baseline: 6de6088735bb33e19a5f88946db2f2b52f1ff207.
- Source import bundle SHA-256: fd7c3f156b82dd42468ec094306ad06d5416249fb1f171a23a8982efceeefbe7.
- Restored every bundled source file, excluding original runtime metadata replaced by destination registration.
- Preserved source assets, schemas/migrations, generated clients/Zod artifacts, tests, scripts, lockfile baseline, documentation, and MASTER_BACKUP.
- Excluded Git internals, node_modules, historical data snapshots, nested archives, caches, and real .env files from the import.
- GitHub integration remains unavailable; today's remote HEAD and new-project synchronization are unverified. No repository was created on GitHub, no push performed, and no history rewritten.

## Limited compatibility/safety changes

1. Destination platform/artifact registration and .replit configuration retained instead of overwriting them with old-account metadata. Original .replit is preserved as original-replit-config.txt for audit.
2. Removed the frontend's hardcoded localhost API proxy. The destination's shared routing serves /api.
3. Updated the code-generation tool dependency from the archived ^8.5.2 declaration to ^8.40.0 after installation was blocked for resolved Orval 8.5.3. The lockfile reflects this tooling update. Generated API files and API contracts were not regenerated or changed.
4. Added a temporary API startup safety gate. It listens without importing the application or database and returns explicit HTTP 503 errors. Production remains gated; development was safely activated after the original JWT_SECRET was supplied.
5. Added destination safety documentation and project memory. Original root application dependency declarations and npm configuration were restored after temporary installation-tool workarounds.
6. Aligned seven contributor/account ORM timestamp declarations with the existing live timestamp-with-time-zone columns. No database types or records were altered. Added seven synthetic regression tests and a schema-only, read-only audit utility that does not import the application database pool.
7. Added an explicit original-database selector and a separate migration-safe API entrypoint that excludes automatic migrations/seeds. The original entrypoint refuses shared-source mode. Read-only staging blocks mutations/sign-in and suppresses poem view/event writes; ordinary write-enabled production behavior remains intact.
8. Added migration start scripts, seven connection-safety tests, and four preview-policy tests. Development CORS includes the actual Replit development origin.

Existing authentication, e'raab instructions, validation rules, sorting behavior, and visual design remain intact. Temporary read-only staging intentionally restricts writes/sign-in and does not increment view counters; disabling that staging mode restores the original operational behavior.

## Checks executed after dependency alignment

| Check | Actual result |
|---|---|
| Backend test command | PASS — 28 tests, zero failures |
| Timestamp decoding regression tests | PASS — 7 tests using synthetic UTC/positive/negative offset inputs |
| Connection selection/safety tests | PASS — 7 tests |
| Frontend test command | PASS — 76 tests across 8 files, zero failures |
| Root typecheck | PASS — shared libraries, backend, frontend, mockup package, scripts |
| Backend typecheck within root check | PASS |
| Frontend typecheck within root check | PASS |
| API production build | PASS |
| Frontend production build | PASS |
| git diff --check | PASS |
| Desktop/mobile frontend screenshots | Original poetry collection renders real records at /poems without browser errors |
| Development API health/readiness | PASS — /api/healthz and /api/readyz return HTTP 200 |
| Production API command | Still configured to use the HTTP 503 safety gate; no publishing performed |
| Original production homepage | Public HTTP 200 observed |
| Original database audit | PASS — PostgreSQL read-only enforcement, 19 expected tables, compatible columns/types/nullability |
| Source/live public comparison | PASS — 790 published poems and latest four IDs in the same order |
| Approved-source pool safety check | PASS — source reachable, PostgreSQL default read-only mode confirmed |
| Safe production bundle | Built separately; original migration/seed startup routines excluded |
| Live development public comparison | PASS — 790 published poems; latest four IDs/order match the original public API |
| Live poem detail | PASS — correct record returned; view counter remains unchanged in staging |
| Live staging mutation protection | PASS — login/contact/like POST requests return HTTP 423 |
| Public catalogs | PASS — 10 categories, 67 poets, 4 videos; public tools list is empty |
| Public Radio status comparison | PASS — both sites report offline, with matching availability/stream configuration |
| SMTP connectivity/authentication | PASS — original host/port/TLS/auth settings accepted by Nodemailer verify(); no mail sent |
| API after service configuration | PASS — restarted migration-safe entrypoint; health/readiness HTTP 200, 790 poems, mutation gate HTTP 423 |

Tests used an isolated environment and an intentionally unreachable test-only database URL, not production credentials. Existing frontend tests use their supplied mocks. Passing these tests does not prove live production-data workflows.

Warnings: frontend chunk size exceeds 500 kB; dependency installation reports deprecated packages and skipped third-party dependency build scripts. PostgreSQL's connection-string library warns of future SSL-mode interpretation changes; no TLS settings were weakened. Live Gemini generation returned HTTP 503 through all four original attempts. These warnings were not suppressed by altering the application.

## Application verification limits

| Area | Verified | Still unverified |
|---|---|---|
| Homepage | Original desktop layout renders without browser errors | Complete live interactions |
| Latest Kalam | Existing query/section order preserved; live latest-four API order matches original site | Below-fold rendered section and write-enabled workflows |
| Poetry | Live collection renders on desktop/mobile; detail API reads existing poem without changing counters | Ownership/approval write workflows |
| Poets, categories, languages, videos, tools | Public catalog APIs return expected envelopes and records | Complete navigation/filter interactions and administrative changes |
| Contributors | Application/portal/activation/review source preserved | Existing accounts, applications, live submission and approval |
| Authentication | JWT_SECRET supplied securely; existing JWT/bcrypt implementation preserved; e'raab role guards unit-tested | Actual developer/admin/contributor logins, sessions, and signed-in UI; staging deliberately blocks sign-in |
| اِعْراب — e'raab | Original source engine preserved; all three role sessions validated; desktop/mobile browser workflow checked; real Gemini HTTP 200 after one transient retry; output guard passed | Password sign-in remains blocked; intermittent provider 503/timeouts; current GitHub main unverified |
| Email | Original credentials and host/port/secure/sender settings supplied; Nodemailer verify() passed connectivity/authentication without sending mail; original implementation preserved | Sender permission, actual delivery, activation emails and signed-in approval workflow |
| Radio | Public status API matches original site's offline state; existing UI tests pass | Stream/provider/runtime access and administrative changes |
| Mobile | Original responsive collection renders real poems | Complete mobile navigation/live data flows |

The visible preview is connected to original records in read-only mode. Sign-in and stored-data mutations intentionally return HTTP 423. Only the exact stateless `POST /api/irab/text` is exempted, with original authorization and rate limits intact. Its three role sessions and protected UI were verified, but password sign-in and unrelated signed-in workflows remain unverified. No migrations, seeds, or migration-generated record changes were performed.

## Deployment and cutover

- New project: Suruur E Man Migration — this destination project.
- New public deployment URL: none; publishing has not occurred.
- Published deployment health: not tested, because no new deployment exists.
- Production domain changed: **NO**.
- The old public homepage and API return HTTP 200. Original database metadata/counts have now been audited read-only; old-account project administration and current GitHub HEAD remain unverified.

## Needed to continue

SOURCE_DATABASE_URL was provided securely for a separate read-only audit. The user subsequently approved original-database reuse; the explicit reuse setting now selects it for the migration-safe entrypoint. The destination's runtime-managed DATABASE_URL remains unchanged.

Reuse was selected, avoiding copy/sync risk. Future write-enabled live operations from either project will affect the same records. Staging remains read-only.

The original JWT_SECRET was supplied securely and the development service now uses the migration-safe entrypoint. Preserve the original database's ownership/lifecycle: remote connectivity alone is not evidence that the database has transferred to the second account.

GEMINI_API_KEY, SMTP_USER, and SMTP_PASSWORD were supplied securely. Earlier synthetic verification returned HTTP 503 and a subsequent request reached the original 30-second timeout. The focused browser test then succeeded with real Gemini HTTP 200 on attempt 2 after a transient 503 and the original 1-second retry. The output guard passed; the UI displayed the two-line result. No stored poetry was submitted. Original model, instructions, SDK, timeout, rate limiter and retry policy remain byte-for-byte unchanged. See [ERAAB_RESTORATION.md](ERAAB_RESTORATION.md).

SMTP host, port, secure flag, sender address, and sender name were supplied in shared settings. A standalone Nodemailer verify() using the original transport options passed connectivity and authentication. No email was sent; sender authorization and delivery are not proved by verify().

The development API was restarted once to load the complete service configuration. Its migration-safe startup confirmed read-only mode with migrations/seeds disabled. Health/readiness returned HTTP 200, the latest-four query returned four poems out of 790, and a login POST remained blocked with HTTP 423. The poetry preview still renders original content without browser errors. No live sign-in, contributor edits, or email sends have been verified.

Resolve or recheck Gemini provider availability, verify any originally configured radio runtime and remaining workflows without unnecessary production test records, and obtain separate approval before disabling read-only mode or publishing. Current GitHub main synchronization and database ownership/lifecycle transfer remain unverified.

## Rollback before any cutover

Keep the old project, deployment, and original database available. No domain changes are needed during staging.

If a later approved domain cutover fails, point the domain back to the old deployment and keep the new deployment for investigation. Do not require destructive database rollback.

If using a copied database, account for any new writes after the copy before switching back; a domain-only rollback will not automatically merge those records. If reusing one database, maintain backward schema compatibility. No destructive rollback is authorized.

## Safety

- No old-project changes or destructive database operations were performed.
- No source or destination application database migrations/seeds were run.
- No actual secret values were printed or committed.
- No remote Git writes or DNS changes were made.
- Original application source was checked against the verified bundle; all bundled files remain present.
- Original records remain accessible and schema/counts have been verified read-only. No database copy/recovery, live workflow completion, or completed migration is claimed.
