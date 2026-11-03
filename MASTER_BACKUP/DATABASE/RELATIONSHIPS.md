# Database Relationships and Indexes

## Foreign keys

- `events.poem_id` → `poems.id`, cascade delete.
- `contributor_applications.reviewed_by_user_id` and `user_id` → `admin_users.id`,
  set null.
- Radio audio `poet_id`, `poem_id`, creator, approver, rejecter → corresponding
  records, set null.
- Playlist items → playlists (cascade) and audio (restrict).
- Schedules → playlists (restrict); creator/editor users set null.
- Play history → audio/playlists/schedules, set null.
- Manifests → publishing user, set null.
- Startup migration adds poem creator/approval FKs and audit actor set-null FK.

## Uniqueness and indexes

- Unique: category slug, settings key, admin email, radio settings key,
  playlist item `(playlist_id, position)`, manifest version.
- Radio indexes: audio editorial/processing/rights/created/poem; playlist
  status/fallback; playlist-item audio; schedule status/effective range;
  play-history start/audio; manifest status/version.
- Startup indexes: admin role/status, poem status/creator, audit actor/created,
  contributor status/created/email/activation hash.

No production data is included in this package.