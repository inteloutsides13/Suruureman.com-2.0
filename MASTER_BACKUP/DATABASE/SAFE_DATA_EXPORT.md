# Safe Data Export

## Current status

No sanitized production data export is included. This is intentional: live
contact messages, contributor applications, admin accounts, audit logs, events,
and backup payloads can contain personal or security-sensitive data.

## What can be recreated from source

- All schema and migration definitions.
- Seedable example content from `scripts/src/seed.ts`.
- Application settings shape and route behavior.
- Radio editorial structures and state machine values.

## Operator-approved export policy

If non-sensitive public content is needed for a clone, export only reviewed
poems, poets, categories, videos, and approved public settings. Remove contact
information, contributor/application identity, admin data, events, audit logs,
password hashes, activation fields, backup payloads, and private radio metadata.
Validate the export against the schema, encrypt it during transfer, and keep it
outside Git unless the operator explicitly approves a sanitized artifact.

For complete recovery use an encrypted PostgreSQL-native dump with restricted
access instead of a repository data file.