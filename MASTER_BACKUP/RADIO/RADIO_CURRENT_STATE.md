# Radio Current State

## Implemented

- Public `/radio` surface and `GET /api/radio/status`.
- Radio audio metadata with editorial, processing, rights, and eligibility
  state.
- Admin audio, playlist, schedule, emergency, settings, and manifest-facing
  routes protected by named radio permissions.
- Contributor radio submissions and internal machine endpoints for manifest,
  events, and cache reports.
- Europe/Berlin schedule default and explicit same-day exclusive-end schedule
  semantics.
- Radio play history and immutable manifest records in the database.

## Planned or not implemented in this repository

- No concrete object-storage provider is configured.
- No authoritative AutoDJ/runtime scheduler is present.
- A configured stream URL is not a browser health check.
- Playlist/schedule inclusion is not the same as backend playback eligibility.
- Emergency editorial state is separate from execution/provider availability.
- Monitoring/webhook settings exist as configuration names, but no complete
  provider runtime is included.

The API intentionally fails closed when required radio storage/provider runtime
is unavailable.