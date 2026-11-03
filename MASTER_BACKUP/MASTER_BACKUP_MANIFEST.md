# Master Backup Manifest

## Source and identity

- **Project:** Suruur E Man / Suruureman Urdu poetry website
- **Source repository:** `https://github.com/inteloutsides13/Suruureman.com`
- **Branch:** `main`
- **Documented source commit:** `e9f11392f816baab4bfd280752bdaa43f5f21000`
- **Production domain:** `https://suruureman.com`
- **Source of truth:** the application source at the repository root

## Status

| Area | Status | Boundary |
|---|---|---|
| Source code | READY | Existing frontend, API, libraries, scripts, assets, manifests, and lockfile remain at repository root. |
| Database schema | READY | Drizzle schema, startup migration, and radio SQL migrations are documented. |
| Safe content backup | NOT READY | No sanitized production content export is included. The application snapshot is partial and sensitive. |
| Environment documentation | READY | Names, purpose, requiredness, and safe placeholders are documented; values are excluded. |
| Deployment documentation | READY | Replit artifacts, ports, rewrites, workflows, and production commands are documented. |
| Authentication documentation | READY | JWT, bcrypt, roles, revocation, and route guards are documented. |
| Contributor system | READY | Application, review, activation, status lookup, portal, and deletion boundaries are documented. |
| Email system | READY | Hostinger SMTP contract and approval-email behavior are documented without the password. |
| Radio system | READY | Implemented editorial/configuration boundary and unavailable provider/runtime boundary are explicit. |
| External credentials | REQUIRED | Database, JWT, admin bootstrap, SMTP, public URL, and optional radio credentials are operator-supplied. |
| Full clone | REQUIRES EXTERNAL SECRETS | Code and schema are present; a working clone still needs secrets, database, and external services. |

## Included

- The actual application source already tracked at the repository root.
- `package.json`, workspace manifests, `pnpm-lock.yaml`, TypeScript references,
  Replit configuration, artifact manifests, schema, migrations, generated API
  clients, scripts, and public assets.
- This documentation package.

## Not included

- `.env` files, secret values, credentials, tokens, password hashes, sessions,
  activation tokens, or private keys.
- An unencrypted production dump.
- Production contact messages, user accounts, audit logs, contributor records,
  radio objects, or other live data.
- SMTP mailbox contents, YouTube source content, or external provider accounts.

## Recovery rule

For complete disaster recovery, use an encrypted, access-controlled PostgreSQL
native dump and separately preserve radio object storage. Test restoration in an
isolated database before any production use. Do not treat the five-row application
snapshot or repository archives as a complete database backup.