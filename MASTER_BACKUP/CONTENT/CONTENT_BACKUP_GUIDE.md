# Content Backup Guide

## Current application snapshot

The Developer backup UI/API snapshots poems, poets, videos, categories, and
settings as JSON in the `backups` table. It retains the newest five snapshots.
Restore upserts those records by ID/key and does not delete records missing from
the snapshot.

## Not covered by that snapshot

Users/password hashes, contributor applications, activation fields, audit logs,
events, contact messages, tools, radio tables, object bytes, schema metadata,
sequences, permissions, and environment configuration are not included.

## Safe operator procedure

1. Export only reviewed public content if a portable seed is needed.
2. Remove PII, credentials, tokens, audit/security records, and private metadata.
3. Validate against the current insert schemas.
4. Encrypt and access-control the export.
5. Restore only into an isolated, schema-compatible database.
6. Verify counts and application behavior before any production use.

Do not commit a raw live snapshot or production dump to GitHub.