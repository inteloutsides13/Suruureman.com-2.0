# Original database — read-only migration audit

Audit date: 2026-10-06. Provider family: Neon. PostgreSQL version: 16.15.

## Verified

- Supplied source endpoint differs from the destination's default managed endpoint.
- PostgreSQL enforced a repeatable-read, READ ONLY transaction. Audit ended with ROLLBACK.
- All 19 expected application tables exist. All declared columns, types, and required nullability match after the source-only timezone decoding correction.
- No unexpected required columns without defaults were found.
- All expected tables are readable. Privilege metadata reports application CRUD capability, but no write was attempted.
- 19 primary keys, 19 foreign keys, and 4 unique constraints were found; zero foreign keys are marked unvalidated.
- The source's published poem count and latest-four ordering match the old public API.
- No connection string, host, password, email, password hash, activation token, or individual record was printed.

## Aggregate counts

| Table | Records |
|---|---:|
| poems | 790 |
| poets | 67 |
| categories | 10 |
| videos | 4 |
| tools | 1 |
| admin_users | 16 |
| contributor_applications | 30 |
| audit_logs | 502 |
| events | 4,236 |
| contact_messages | 1 |
| settings | 5 |
| backups | 5 |
| radio_audio | 0 |
| radio_manifests | 0 |
| radio_play_history | 0 |
| radio_playlist_items | 0 |
| radio_playlists | 1 |
| radio_schedules | 0 |
| radio_settings | 1 |

All 790 poems are published. Accounts include 1 developer, 1 admin, and 14 contributors; 15 are active and 1 awaits activation. All 16 password values have valid bcrypt hash structure; no password was tested or hash exposed.

Zero radio rows are observed source counts, not data removed by the migration.

## Compatibility correction

The archived ORM source declared seven existing timezone-aware columns as timezone-naive: the account activation timestamp and six contributor application lifecycle timestamps. The original startup SQL already defined these as TIMESTAMPTZ.

The ORM's timezone-naive decoder appends a UTC suffix to strings that already contain a timezone offset, producing invalid dates. Only the new project's ORM declarations were adjusted to match actual column types. No ALTER TABLE, UPDATE, migration, seed, or schema push was executed.

Seven regression tests cover UTC, positive-offset, and negative-offset synthetic inputs. Existing application field types and API contracts remain unchanged.

## Approved reuse and startup safety

The user selected shared original-database reuse after the audit. The explicit configuration selects SOURCE_DATABASE_URL rather than the new project's default database. A live SELECT-only pool check confirmed PostgreSQL default_transaction_read_only=on.

A separately built migration-safe entrypoint does not execute startup migrations/seeds. The original entrypoint is blocked in shared-source mode. Read-only staging rejects mutations/sign-in and does not increment poem views or create view events.

Connection-safety and preview-policy regression tests pass. After JWT_SECRET was supplied securely, the development service started the migration-safe entrypoint and passed health/readiness checks. Public poem totals/latest ordering match the original site; detail reads do not increment counters. Mutations/sign-in return HTTP 423. Production remains gated.

## Not yet established

- Database ownership/transfer to the second account.
- Live login, contributor workflow, SMTP, Gemini, and production radio/provider behavior.
- A new public deployment or DNS cutover.

The development API is active in read-only mode. SOURCE_DATABASE_URL is used for application connections only under the explicitly approved reuse setting, with read-only protection during staging.
