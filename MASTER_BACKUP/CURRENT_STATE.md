# Current State

## Snapshot

- **Recorded:** 2026-09-19
- **Branch:** `main`
- **HEAD:** `e9f11392f816baab4bfd280752bdaa43f5f21000`
- **Remote:** `https://github.com/inteloutsides13/Suruureman.com`
- **Working tree at snapshot:** clean
- **Production domain:** `https://suruureman.com`

## Runtime

- Frontend: React + Vite + Tailwind CSS.
- API: Express 5 on Node.js.
- Database: PostgreSQL through Drizzle ORM and `pg`.
- Workspace: pnpm monorepo using TypeScript project references.
- Authentication: application-issued JWT bearer tokens with bcrypt password
  hashes and database-backed account status/token revocation checks.
- Email: Nodemailer over Hostinger SMTP for contributor approval/activation
  messages.
- Storage: relational metadata is implemented; radio object storage remains
  provider-neutral and fails closed until a provider is configured and approved.
- Radio timezone default: `Europe/Berlin`.

## Implemented areas

- Public poetry, poets, categories, videos, search, contact, tools, and radio
  pages.
- Admin CRUD, settings, contact inbox, analytics, snapshots, users, contributor
  review, pending poems, and radio editorial controls.
- Public contributor application, status lookup, activation, and authenticated
  contributor portal.
- Approval/rejection email flow with expiring, single-use activation behavior.
- Radio audio metadata, eligibility, playlists, schedules, emergency editorial
  state, manifests, and internal machine endpoints.

## Known limitations and warnings

- The radio storage interface has no configured concrete object-storage provider;
  uploads/playback fail closed rather than pretending to be available.
- A configured public stream URL is configuration, not proof that a stream is
  reachable in the browser.
- Radio schedules and playlists are editorial configuration. This repository does
  not contain an authoritative AutoDJ runtime.
- The developer backup endpoint stores only poems, poets, videos, categories, and
  settings. It is non-atomic, non-destructive, and not a full database backup.
- Startup contributor migrations log errors and allow the server to continue;
  operators should inspect logs and verify schema after a clone.
- `scripts/src/seed.ts` is destructive for core content and must not be run
  against production.