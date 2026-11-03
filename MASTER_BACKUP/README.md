# Suruur E Man — Master Backup

This directory documents the current Replit project and the safe steps required to
recreate it. The repository root remains the authoritative working source code;
this is not a second copy of the application.

## What this package contains

- Current architecture, stack, directory map, routes, APIs, and feature behavior.
- PostgreSQL/Drizzle schema, migrations, relationships, and restore boundaries.
- Authentication, contributor, approval-email, and radio documentation.
- Replit artifact/deployment configuration and environment-variable names.
- A clone-from-scratch guide and verification checklist.
- Opt-in scripts that validate environment/build state and create a schema-only
  PostgreSQL dump. Scripts never print secret values and do not run automatically.

## Important safety boundary

No secrets, credentials, tokens, password hashes, session data, activation links,
or production database dump are stored here. The in-app backup feature is a
content snapshot, not a complete PostgreSQL backup. A disaster-recovery clone
still requires operator-provided secrets, database access, external services,
and any radio object storage.

Start with:

1. [MASTER_BACKUP_MANIFEST.md](MASTER_BACKUP_MANIFEST.md)
2. [CURRENT_STATE.md](CURRENT_STATE.md)
3. [CLONE/CLONE_FROM_SCRATCH.md](CLONE/CLONE_FROM_SCRATCH.md)

Generated from the current source at commit
`e9f11392f816baab4bfd280752bdaa43f5f21000`.