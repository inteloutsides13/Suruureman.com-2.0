# Database Schema

Source: `lib/db/src/schema/poems.ts`, `lib/db/src/schema/radio.ts`, and
`artifacts/api-server/src/lib/migrations.ts`.

All primary keys are serial integers unless noted. Timestamps are application
timestamps; radio timestamps use PostgreSQL timezone-aware columns.

## Core and administration tables

- `poems`: `id` PK; `title`, `title_urdu`, `content`, `poet_name`,
  `poet_name_urdu`, `category`, `category_urdu` required text; `featured`
  boolean default false; nullable `image_url`; integer `likes`, `views`,
  `shares` default 0; `visual_poetry` boolean default false; `language`
  default `urdu`; `status` in published/pending/rejected/draft; attribution
  and approval IDs/timestamps/rejection reason; `created_at`.
- `categories`: `id` PK; required `name`, `name_urdu`, unique `slug`,
  `description` default empty.
- `poets`: `id` PK; required `name`, `name_urdu`, `bio`, `bio_urdu`, `era`.
- `videos`: `id` PK; required `title`, `title_urdu`, `description`, `youtube_id`,
  `duration`; nullable `thumbnail_url`.
- `events`: `id` PK; `type`, nullable `poem_id` FK to `poems.id` with cascade
  delete, `created_at`. Runtime values are view/like/share.
- `contact_messages`: `id` PK; required `name`, `email`, `message`, `created_at`.
- `settings`: `id` PK; unique required `key`; required `value` default empty.
- `backups`: `id` PK; required `name`, JSON text `data`, `created_at`.
- `admin_users`: `id` PK; unique required `email`, `password_hash`, `role` in
  developer/admin/contributor, `name`; lifecycle `status` in active/disabled/
  activation_pending; login, activation, token-revocation, notes, and
  `created_at` timestamps.
- `contributor_applications`: `id` PK; full name/email; nullable DOB and
  contact/portfolio; required bio, contribution area, preferred language,
  category, terms version and acceptance time; status pending/approved/rejected;
  rejection/reviewer fields; nullable user FK; hashed/encrypted activation
  fields, expiry/use timestamps, created/updated timestamps.
- `tools`: `id` PK; title/title Urdu, descriptions, URL, active boolean,
  display order, created timestamp.
- `audit_logs`: `id` PK; nullable actor user ID, required action, optional target
  type/ID and metadata, created timestamp. The actor relation is enforced by the
  startup migration.

## Radio tables

- `radio_audio`: identity/title/description/source filename; nullable object and
  upload keys, object version, checksum, size and media metadata; normalization,
  processing, editorial, and rights statuses; rights notes/window; nullable
  poet/poem/creator/approval/rejection FKs with set-null behavior; archive and
  created/updated timestamps. Indexes cover editorial, processing, rights,
  created time, and poem.
- `radio_playlists`: name/description; mode sequential/weighted/random; status
  draft/active/archived; repeat window; default/fallback flags; creator/editor
  FKs; version/archive/created/updated timestamps. Indexes cover status/fallback.
- `radio_playlist_items`: playlist/audio FKs; required position; optional weight,
  cue points, attribution; enabled flag; created/updated timestamps. Unique
  `(playlist_id, position)` and audio index.
- `radio_schedules`: name and playlist FK; status draft/active/archived; timezone
  default `Europe/Berlin`; JSON-string days of week; required local start/end;
  effective window, priority, optional program/attribution, creator/editor FKs,
  version, timestamps. Indexes cover status and effective window.
- `radio_settings`: unique key/value plus created/updated timestamps.
- `radio_play_history`: nullable audio/playlist/schedule FKs; manifest version;
  start/end and expected/actual durations; result started/completed/failed/
  skipped; failure code, JSON metadata, created timestamp. Indexes cover start
  time and audio.
- `radio_manifests`: unique version, status draft/active/superseded/invalid,
  JSON payload, SHA-256, nullable publishing user FK, published/created times.
  Indexes cover version uniqueness and status.

## Enum-like values

Drizzle defines these as text constraints at the application/schema layer rather
than PostgreSQL `CREATE TYPE` declarations: user roles/statuses, poem status,
contributor status, radio editorial/rights/processing/category values, playlist
mode/status, schedule status, play-history result, and manifest status.