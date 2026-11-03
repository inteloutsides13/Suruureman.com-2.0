# Implemented Features

## Public website

- Hero, featured poems, latest poems, categories, poets, videos, tools, contact,
  search, language-filtered poetry, poem details, social sharing, and local like
  state.
- Share events increment the poem counter and create an event record.
- Contact submissions are persisted for the admin inbox.
- Footer contact/social values are read from public settings.
- Responsive bilingual navigation uses English and Urdu labels.

## Administration

- JWT login, dashboard totals, date-range analytics, top-poem metrics.
- CRUD for poems, poets, videos, and categories.
- Visual-poetry marking and image URL management.
- Contact message inbox, settings, tools, user management, audit log viewing.
- Developer-only five-slot content snapshots and non-destructive restore.
- Contributor application review, approval/rejection, activation reissue, pending
  poem review, contributor account controls, and deletion-impact flow.
- Radio audio, playlists, schedules, emergency editorial state, settings, and
  manifest-facing controls subject to radio permissions.

## Contributor system

- Public application with terms version `contributor-terms-v1`, DOB, contribution
  area, language/category selection, optional portfolio/contact information.
- Pending/approved/rejected review states.
- Approval email with expiring, single-use activation link.
- First-name + DOB + email status lookup with newest-application matching.
- Contributor dashboard and submission pages for poems, poets, and radio items.
- Server-side ownership, status, publish, and role checks.

## Radio

- Editorial audio metadata, rights status, processing status, approval workflow,
  playlists, schedule windows, emergency state, play history, manifests, and
  internal machine endpoints.
- Schedule defaults use Europe/Berlin and the implemented schedule semantics are
  documented in `RADIO/RADIO_CONFIGURATION.md`.
- Object storage and authoritative playback runtime are not configured in this
  repository. The provider-neutral interface fails closed.