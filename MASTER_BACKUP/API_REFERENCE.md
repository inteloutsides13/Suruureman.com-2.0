# API Reference

All endpoints below are mounted under `/api`. `Admin` means an active admin or
developer JWT; `Developer` means developer JWT; `Contributor` means active
contributor JWT; `Radio permission` means JWT plus the named permission.

## Health and public content

- `GET /healthz` — API health.
- `GET /poems` — list poems; supports featured/category/limit/offset/poet/search/
  visual-poetry filters.
- `GET /poems/:id` — poem detail and view tracking.
- `POST /poems/:id/like` and `/unlike` — public like event/counter behavior.
- `POST /poems/:id/share` — public share event/counter behavior.
- `GET /categories` — categories with poem counts.
- `GET /poets`, `GET /poets/:id` — public poets.
- `GET /videos`, `GET /videos/:id` — public videos.
- `GET /tools` — active public tools.
- `POST /contact` — public contact submission.
- `GET /admin/settings/public` — public contact/social settings.

## Admin content and operations

- `POST /admin/login` — login/rate-limited JWT issuance.
- `GET /admin/stats`, `/analytics`, `/top-poems` — Admin dashboard metrics.
- `GET /admin/messages`, `DELETE /admin/messages/:id` — Admin contact inbox.
- `GET/PUT /admin/settings` — Admin settings.
- `GET /admin/backups`, `POST /admin/backups`, `DELETE /admin/backups/:id`,
  `POST /admin/backups/:id/restore` — snapshots; create/delete/restore are
  Developer-controlled as implemented.
- `GET/POST/PUT/DELETE /admin/users[/:id]` — Developer user management.
- `GET /admin/contributors`, `GET /admin/contributors/:id`,
  `GET /admin/contributors/:id/submissions` — Admin contributor views.
- `POST /admin/contributors/delete-impact`, `DELETE /admin/contributors` —
  Admin deletion impact and deletion.
- `POST/PUT /admin/contributors/:id`, plus reset-password/disable/enable —
  Admin contributor lifecycle.
- `GET /admin/pending`, `POST /admin/poems/:id/approve`,
  `POST /admin/poems/:id/reject` — Admin approval queue.
- `GET /admin/audit-logs` — Admin audit log view.
- `GET /categories`, `POST/PUT/DELETE /categories[/:id]` — public read, Admin
  writes; category deletion is protected when used by poems.
- `POST/PUT/DELETE /poems[/:id]`, `PATCH /poems/:id/visual` — Admin writes.
- `POST/PUT/DELETE /poets[/:id]` and `/videos[/:id]` — Admin writes.
- `GET /tools/admin`, `POST/PUT/DELETE /tools/admin[/:id]` — Admin read,
  Developer writes.

## Contributor applications and portal

- `POST /contributor-applications` — public application.
- `POST /contributor-application-status` — public, rate-limited status lookup.
- `GET/POST /contributor-activation/:token` — activation inspection/submission.
- `GET /admin/contributor-applications`,
  `GET /admin/contributor-applications/:id` — Admin review.
- `POST /admin/contributor-applications/:id/approve`,
  `/reject`, `/reissue-activation` — Admin workflow.
- `GET /contributor/me` — Contributor account.
- `GET/POST /contributor/radio/submissions`,
  `PUT /contributor/radio/submissions/:id` — Contributor radio submissions.
- Contributor poem/poet endpoints are mounted in the portal route module; see
  `artifacts/api-server/src/routes/contributor-portal.ts` for exact validation.

## Radio

- `GET /radio/status` — public status/configuration surface.
- `GET/POST /admin/radio/audio`, `POST /admin/radio/audio/upload-sessions`,
  `POST /admin/radio/audio/:id/complete`, `/approve`, `/reject`, `/archive` —
  radio permissions as named in source.
- `GET/POST /admin/radio/playlists`, `GET/PUT /admin/radio/playlists/:id`,
  `POST /items`, `DELETE /items/:itemId`, `PUT /items/reorder` — playlist
  permissions.
- `GET/POST/PUT /admin/radio/schedules` — schedule permissions.
- `GET/PUT /admin/radio/emergency` — emergency permissions.
- `GET/PUT /admin/radio/settings` — settings permission.
- `GET /internal/radio/manifest`, `POST /internal/radio/events`,
  `POST /internal/radio/cache-report` — internal machine authentication.

The route source is authoritative for exact request schemas, response envelopes,
and permission middleware.