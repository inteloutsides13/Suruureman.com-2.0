# Database Restore Guide

## Preferred disaster-recovery path

1. Provision an isolated PostgreSQL database with the same major-version
   compatibility.
2. Obtain an encrypted, access-controlled PostgreSQL-native dump from the
   operator. Do not place it in this repository.
3. Clone the repository and install dependencies.
4. Restore into the isolated database with `pg_restore`/`psql` using
   `ON_ERROR_STOP` and no application process connected.
5. Start the API against the isolated database so idempotent startup migrations
   can be inspected.
6. Verify tables, constraints, sequences, counts, role/status behavior, and
   application smoke tests.
7. Preserve radio object bytes separately and verify their recorded checksums.
8. Promote only after an operator-approved cutover.

## Application snapshot restore

The developer-only `/api/admin/backups/:id/restore` endpoint restores only
poems, poets, videos, categories, and settings. It upserts by ID/key, is
non-destructive, is not transactional, does not reset sequences, and omits
users, contributors, audit logs, events, contact messages, tools, radio tables,
schema metadata, and external objects. Use it only for an isolated, compatible
content recovery, never as a complete disaster-recovery procedure.

## Never do this

- Do not run the destructive seed script against production.
- Do not point the development synchronization script at production as a target.
- Do not paste a dump, password, or token into GitHub or chat.