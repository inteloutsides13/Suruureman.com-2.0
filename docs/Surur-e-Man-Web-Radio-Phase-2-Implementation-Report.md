# PHASE 2 IMPLEMENTATION REPORT

**Project:** Surur-e-Man Web Radio  
**Production website:** https://suruureman.com  
**Repository:** https://github.com/inteloutsides13/surur-e-man  
**Branch:** `main`  
**Implementation date:** 8 September 2026  
**Scope:** Controlled prerequisites and non-production foundations only

## 1. Executive Summary

Phase 2 implemented the approved foundation work without activating a Radio service.

Implemented:

- Security prerequisites for bootstrap credentials, JWT configuration, privileged-session revocation, CORS, request limits, security headers, and readiness checks.
- Seven additive PostgreSQL/Drizzle Radio foundation tables.
- A reviewed provider-neutral object-storage boundary.
- Secure audio metadata validation and quarantine lifecycle endpoints.
- Admin-only Radio metadata, playlist, settings, and audio-foundation endpoints.
- A separate machine-authenticated internal streaming-adapter contract.
- Replay protection, timestamp validation, HMAC request signing, and idempotent event persistence foundations.
- Environment documentation and operational safety documentation.

Not implemented:

- Production object-storage provider.
- Production Liquidsoap or Icecast.
- Public Radio player or `/radio` navigation.
- Production stream, DNS, SSL, listener delivery, or real audio.
- Full scheduling engine, manifest publication workflow, processing/decoder worker, or 24/7 playback.

**Phase 2 status:** **READY WITH CONDITIONS**

The foundation is ready for review and controlled staging work. Phase 3 is **not safe to start** until the provider, storage, machine-operator, rights, and staging decisions described below are approved and validated.

## 2. Phase 2 Scope

The implementation followed the attached Phase 2 prompt and the completed Phase 0 and Phase 1 documents.

The scope was limited to:

1. Approved security prerequisites.
2. Non-production infrastructure foundations.
3. Provider-neutral persistent object-storage abstraction.
4. Radio database foundation.
5. Minimum Radio API/data-layer foundation.
6. Secure audio-ingestion foundation.
7. Streaming-adapter contract/foundation.
8. Development/staging configuration.
9. Documentation and operational runbooks.

No unrelated product feature, visual redesign, public Radio UI, or production streaming infrastructure was added.

## 3. Phase 2 Scope NOT Implemented

The following are intentionally deferred:

- External VPS procurement or setup.
- Managed Radio provider connection.
- Provider-specific object-storage client.
- Production storage bucket or namespace.
- Production Liquidsoap installation.
- Production Icecast installation.
- Public stream DNS or SSL.
- Public `/radio` route.
- Public player and listener delivery.
- Real production audio upload.
- Real production schedules.
- Full scheduling and playlist execution engine.
- Media decoding, transcoding, loudness normalization, malware scanning, or quarantine worker.
- Automatic manifest publication and activation UI.
- Stream monitoring and alert delivery.
- Production database migration.
- Contributor Radio access.

These are deferred by design and are not implementation failures.

## 4. Pre-Implementation Baseline

### VERIFIED

- The repository is a pnpm workspace with React/Vite frontend, Express API, PostgreSQL, and Drizzle.
- The backend uses JWT bearer authentication and bcrypt password hashes.
- Existing roles are `developer`, `admin`, and `contributor`.
- Existing contributor session revocation checks existed; privileged admin/developer requests used a fast JWT-only path.
- The API used permissive `cors()` with no explicit origin policy.
- JSON and URL-encoded body limits were not explicitly configured.
- Security headers were not explicitly configured.
- `/api/healthz` was a static liveness response with no database readiness check.
- No Radio tables, storage abstraction, upload lifecycle, Radio API, public player, stream, Liquidsoap, or Icecast existed.
- The existing project had no declared `pg` dependency in the scripts package even though an existing script imported it.

### IMPLEMENTED

- The baseline build/typecheck issues were corrected only where needed for a clean workspace validation.
- Existing request parameter conversions were made type-safe under the installed Express 5 types without changing route behavior.
- The existing frontend type errors were corrected without changing user-visible behavior.

## 5. Security Changes

### 5.1 Bootstrap credentials

**Problem:** Initial privileged passwords were hardcoded in the API source.

**Before:** The seed routine hashed fixed developer and admin passwords embedded in `index.ts`.

**After:** The seed routine reads:

- `SEED_DEV_PASSWORD`
- `SEED_ADMIN_PASSWORD`

If the database already has users, seeding is skipped. If an empty production database lacks either password, startup fails safely. In development, the seed is skipped with a warning rather than creating an unsafe default account.

**Files:** `artifacts/api-server/src/index.ts`, `.env.example`, `README.md`, `replit.md`

**Risk:** Existing installations that rely on the old source defaults must explicitly configure rotation/seed values. No automatic password reset or Git history rewrite was performed.

**Test result:** Secret scan found no active hardcoded bootstrap passwords.

### 5.2 JWT secret

**Problem:** A predictable JWT fallback existed.

**Before:** Missing `JWT_SECRET` selected a fixed source-controlled string.

**After:** Production fails closed when `JWT_SECRET` is missing. Development uses a process-local cryptographically random value that is not persisted or logged, so development sessions intentionally do not survive a restart.

**Files:** `artifacts/api-server/src/lib/config.ts`, `artifacts/api-server/src/middlewares/adminAuth.ts`, `.env.example`

**Risk:** Development sessions expire when the process restarts unless a development `JWT_SECRET` is supplied. This is intentional and safer than a predictable fallback.

**Test result:** Secret scan found no predictable JWT fallback.

### 5.3 Privileged session validation

**Problem:** Admin and developer middleware trusted role claims without checking current account status or token revocation.

**Before:** `requireAdmin` and `requireDeveloper` used a JWT-only fast path.

**After:** Privileged protected requests now verify the current database user, matching user identity and role, active status, and `tokenRevokedAt`.

**Files:** `artifacts/api-server/src/middlewares/adminAuth.ts`

**Risk:** Each privileged request now performs a database lookup. This is intentional for revocation correctness and should be measured before very high admin traffic.

**Test result:** Unauthenticated privileged Radio access returned HTTP 401. Workspace typecheck passed.

### 5.4 CORS

**Problem:** All origins were accepted.

**Before:** `cors()` was used without an allowlist.

**After:** CORS uses `CORS_ORIGINS` when configured, with explicit development origins and the existing production domains as safe defaults. Requests without an origin remain allowed for same-origin/server-to-server behavior.

**Files:** `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/lib/config.ts`, `.env.example`

**Risk:** A separately hosted legitimate frontend must be added to `CORS_ORIGINS`; it is no longer silently accepted.

### 5.5 Rate limiting

**IMPLEMENTED:** In-process fixed-window rate limiters now protect:

- Admin login: 10 requests per 15 minutes per client IP.
- Radio admin routes: 120 requests per minute per client IP.
- Radio machine routes: 240 requests per minute per client IP.

**Files:** `artifacts/api-server/src/lib/rateLimit.ts`, `artifacts/api-server/src/routes/admin.ts`, `artifacts/api-server/src/routes/radio.ts`, `artifacts/api-server/src/lib/radioMachineAuth.ts`

**Known limitation:** The limiter is process-local. A future multi-instance deployment requires a shared limiter or edge protection.

### 5.6 Request/body limits

**IMPLEMENTED:**

- JSON body limit: 1 MB.
- URL-encoded body limit: 100 KB.
- Audio bytes are not accepted through JSON APIs.
- Upload endpoints accept metadata and future presigned-upload information only.

Oversized bodies receive a JSON HTTP 413 response.

### 5.7 Security headers

**IMPLEMENTED:**

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling camera, microphone, and geolocation
- HSTS in production
- Express `x-powered-by` disabled

**Files:** `artifacts/api-server/src/app.ts`

### 5.8 Health/readiness

**IMPLEMENTED:**

- `GET /api/healthz` remains a lightweight liveness check.
- `GET /api/readyz` performs `SELECT 1` against PostgreSQL and returns HTTP 503 if the database is unavailable.

Radio availability is not required for website/API readiness.

**Files:** `artifacts/api-server/src/routes/health.ts`, `README.md`

## 6. Environment Configuration

### IMPLEMENTED

Documented in `.env.example`:

- `SEED_DEV_PASSWORD`
- `SEED_ADMIN_PASSWORD`
- `CORS_ORIGINS`
- `RADIO_ENABLED`
- `RADIO_PUBLIC_STREAM_URL`
- `RADIO_SCHEDULE_TIMEZONE`
- `RADIO_ADMIN_PERMISSIONS`
- `RADIO_INTERNAL_API_URL`
- `RADIO_MACHINE_ID`
- `RADIO_MACHINE_SECRET`
- `RADIO_STORAGE_PROVIDER`
- `RADIO_MONITORING_ENABLED`
- `RADIO_ALERT_WEBHOOK_URL`

### PLACEHOLDER

Radio values remain disabled or empty in the template. No real provider credentials, machine credentials, alert destinations, storage bucket, or stream URL were created.

### PROVIDER SELECTION

No object-storage provider was selected or provisioned. The storage abstraction intentionally fails closed until a provider-specific implementation is approved.

### OWNER APPROVAL

The owner must approve:

- VPS versus managed Radio provider.
- Object-storage provider.
- Machine operator and incident owner.
- Admin permission allowlist.
- Monitoring recipients.
- Stream domain and bitrate.

## 7. Object Storage Foundation

### IMPLEMENTED

`artifacts/api-server/src/lib/radioStorage.ts` defines a provider-neutral `RadioStorageProvider` contract with:

- `createUploadSession()`
- `completeUpload()`
- `getObjectMetadata()`
- `getObject()`
- `createReadAccess()`
- `archiveObject()`
- `deleteObject()`

The contract supports server-generated object keys, upload-session flow, object metadata, checksums, read access, archival, and deletion.

The current provider implementation is deliberately an `UnconfiguredRadioStorageProvider`. It throws a typed configuration error rather than writing bytes to the deployment filesystem or pretending an upload succeeded.

### PROPOSED object-key pattern

```text
radio/audio/{audioId}/{version}/{sha256}.{extension}
```

The initial upload session uses a server-generated pending key. After provider completion and checksum verification, the object record can point to the verified content.

### REQUIRES PROVIDER VALIDATION

- Presigned upload mechanism.
- Object versioning/retention.
- Server-side encryption.
- Content-type and object-size enforcement.
- Object move/copy behavior from pending to checksum-addressed key.
- Signed-read expiration policy.

## 8. Database Schema

### Migration status

- Drizzle schema definitions added and typechecked.
- Development database schema applied with `pnpm --filter @workspace/db run push`.
- The development database reported no changes on the final idempotent push.
- Reviewed additive SQL is stored in `lib/db/migrations/0001_radio_foundation.sql`.
- No production database migration was run.

### `radio_audio`

**Purpose:** Canonical audio metadata, storage references, workflow state, technical metadata, rights, and approval attribution.

**Fields:** Identity, title/Urdu title, description, original filename, object key, upload session, object version, checksum, size, duration, container, codec, bitrate, sample rate, channels, loudness values, normalization status, processing status, editorial status, rights status/notes/dates, optional poet/poem links, creation/approval/rejection attribution, archive timestamp, and timestamps.

**Relationships:** Optional links to `poets`, `poems`, and `admin_users`.

**Constraints/indexes:** Primary key, status indexes, created-at index, poem index, and nullable foreign keys with safe deletion behavior.

### `radio_playlists`

**Purpose:** Versioned playlist metadata and default/fallback flags.

**Fields:** Name, description, mode, status, repeat window, default/fallback flags, creator/updater, version, archive timestamp, timestamps.

**Relationships:** Links to users and playlist items.

**Constraints/indexes:** Status and fallback indexes.

### `radio_playlist_items`

**Purpose:** Ordered or weighted audio membership.

**Fields:** Playlist, audio, position, weight, enabled flag, cue points, attribution, timestamps.

**Relationships:** Required playlist and audio foreign keys.

**Constraints/indexes:** Unique playlist/position constraint, audio index, cascade deletion from playlists, restricted deletion of referenced audio.

### `radio_schedules`

**Purpose:** Future schedule configuration without implementing the scheduling engine.

**Fields:** Name, playlist, status, timezone, serialized days of week, local start/end time, effective dates, priority, program name, version, attribution, creator/updater, timestamps.

**Relationships:** Required playlist and optional user foreign keys.

**Constraints/indexes:** Status and effective-window indexes.

### `radio_settings`

**Purpose:** Non-secret station configuration.

**Fields:** Key, value, timestamps.

**Constraints/indexes:** Unique key.

Only allowlisted non-secret keys are writable through the API. Credentials are not stored here.

### `radio_play_history`

**Purpose:** Playback/event foundation for later operational history.

**Fields:** Audio, playlist, schedule, manifest version, start/end times, expected/actual duration, result, failure code, metadata, created timestamp.

**Relationships:** Nullable references to audio, playlist, and schedule.

**Constraints/indexes:** Started-at and audio indexes.

### `radio_manifests`

**Purpose:** Versioned programming state and previous-known-good manifest storage.

**Fields:** Version, status, JSON payload, checksum, publisher, publish time, creation time.

**Constraints/indexes:** Unique manifest version and status index.

Atomic publication logic is a later phase; the internal reader only returns the active manifest.

## 9. API Foundation

### IMPLEMENTED protected endpoints

Mounted under `/api/admin/radio`:

- `GET /audio`
- `POST /audio`
- `POST /audio/upload-sessions`
- `POST /audio/:id/complete`
- `POST /audio/:id/approve`
- `GET /playlists`
- `POST /playlists`
- `GET /schedules`
- `GET /settings`
- `PUT /settings`

All require a current admin/developer session. Developers bypass the configurable Radio admin allowlist. Admins require explicit `RADIO_ADMIN_PERMISSIONS`; the default is read-only `radio.audio.read`. Contributors receive no Radio access.

### IMPLEMENTED internal endpoints

Mounted under `/api/internal/radio`:

- `GET /manifest`
- `POST /events`
- `POST /cache-report`

These require dedicated machine authentication and do not accept human JWTs.

### Authentication

Machine requests require:

- `X-Radio-Machine-Id`
- `X-Radio-Timestamp`
- `X-Radio-Nonce`
- `X-Radio-Signature`

The signature covers timestamp, nonce, method, path, and a SHA-256 digest of the canonical request body.

### Authorization

- Human Radio endpoints require active admin/developer sessions.
- Developer has full foundation access.
- Admin access is allowlist-controlled.
- Contributor Radio permissions are absent by default.
- Machine requests have only the three narrow internal endpoint capabilities.

### Validation/rate limiting/audit

- Request fields are manually validated at the API boundary.
- Radio admin and machine routes are rate limited.
- Radio changes and machine events are written to the existing audit table.
- Sensitive metadata keys are redacted before Radio audit serialization.
- Errors do not return credentials, stack traces, storage paths, or signed URLs.

### DEFERRED endpoints

- Public `/api/radio/status`
- Public `/api/radio/now-playing`
- Public player metadata
- Playlist item management
- Schedule create/update/activation
- Manifest publication/activation
- Operational start/stop controls
- Emergency control

## 10. Audio Ingestion Foundation

### IMPLEMENTED lifecycle foundation

```text
draft
→ uploading
→ quarantined
→ processing
→ ready_for_review
→ approved
→ inactive / archived
```

Rejection is represented by `rejected`.

Metadata validation enforces:

- MP3, M4A, or AAC extension.
- Approved audio content types.
- Maximum 500 MB.
- Maximum 120 minutes.
- Non-empty bounded title.
- Bounded description and filename.
- Valid optional rights dates.
- Positive optional poem/poet IDs.

Upload completion additionally requires:

- Matching server-created upload session.
- Object-provider completion.
- SHA-256 format verification.
- Exact expected size.

Successful upload never directly becomes broadcast eligible. Completion enters quarantine and does not mark the record approved.

### PROVIDER VALIDATION REQUIRED

Actual media signature, decoder, duration, codec, loudness, and malware validation must be performed by the future processing worker before a record can become `ready`.

## 11. Rights Foundation

### IMPLEMENTED

Audio records carry:

- Rights status.
- Rights notes.
- Valid-from date.
- Valid-until date.
- Approval attribution.
- Rejection attribution.
- Archive state.

The broadcast eligibility helper requires:

```text
processingStatus = ready
AND editorialStatus = approved
AND rightsStatus = cleared
AND rights dates are valid
AND a verified object/checksum exists
```

Editorial approval and rights clearance remain separate.

### NOT IMPLEMENTED

- Legal licensing platform.
- Rights-provider integration.
- Automated takedown intake.
- Legal interpretation or invented licensing rules.

## 12. Permission Model

### IMPLEMENTED

Developer access is full Radio foundation access.

Admin Radio access is controlled by `RADIO_ADMIN_PERMISSIONS`. The default is:

```text
radio.audio.read
```

Potential permissions are documented for future approval:

```text
radio.audio.read
radio.audio.create
radio.audio.approve
radio.audio.archive
radio.audio.purge
radio.playlists.manage
radio.schedules.manage
radio.settings.manage
radio.operations.read
radio.operations.control
radio.emergency.control
radio.history.read
```

Contributors receive no Radio permissions and no Radio routes.

### REQUIRES OWNER APPROVAL

The exact admin permission allowlist must be approved before enabling non-read Radio administration.

## 13. Streaming Adapter Contract

### IMPLEMENTED

The internal adapter contract exists without installing or starting Liquidsoap/Icecast:

```text
GET /api/internal/radio/manifest
POST /api/internal/radio/events
POST /api/internal/radio/cache-report
```

The manifest reader returns only the active version, payload, checksum, and publication timestamp. No unpublished/private records or credentials are returned.

The event endpoint records bounded playback history foundations. The cache-report endpoint records operational state in the existing audit system.

### NOT IMPLEMENTED

- Shell commands.
- Arbitrary machine commands.
- Process start/stop control.
- Source passwords.
- Icecast credentials.
- Signed object reads.
- Stream listener delivery.

## 14. Manifest Versioning

### IMPLEMENTED

`radio_manifests` provides:

- Unique version numbers.
- Draft/active/superseded/invalid status model.
- JSON payload.
- SHA-256 checksum.
- Publisher attribution.
- Active-version lookup.

### DEFERRED

- Manifest compiler.
- Atomic active-version swap.
- Previous-known-good activation endpoint.
- Scheduler-driven manifest generation.

The internal reader returns HTTP 404 when no active manifest exists. It does not synthesize a fallback manifest.

## 15. Audit Logging

### IMPLEMENTED

Radio actions use the existing `audit_logs` table, including:

- Audio metadata creation.
- Upload-session creation.
- Quarantine completion.
- Audio approval.
- Playlist creation.
- Settings updates.
- Playback events.
- Machine cache reports.

Sensitive keys matching password, secret, token, credential, authorization, signed URL, or access-key patterns are redacted in the Radio audit helper.

Secrets and full signed URLs are not intentionally logged.

## 16. Staging/Non-Production Foundation

### IMPLEMENTED

The development environment now has:

- Radio schema applied to the development database.
- Radio configuration placeholders in `.env.example`.
- No provider credentials.
- No production audio.
- No production stream.
- No public Radio route.
- No production DNS or SSL changes.
- Separate machine-auth configuration names.

### Future non-production VPS runbook

A later staging proof of concept must use:

- A disposable Linux host.
- A dedicated non-production storage namespace.
- Dedicated machine ID and secret.
- Dedicated non-production database or isolated schema.
- Non-public firewall rules until operator verification.
- A separate service account for Liquidsoap.
- A separate service account for Icecast.
- systemd supervision.
- Local checksum-verified cache.
- Emergency loop content that is explicitly non-production.
- Health checks for manifest freshness, cache health, process health, and listener availability.
- Centralized logs without secrets.
- A documented restart and rollback procedure.

### PROVIDER VALIDATION REQUIRED

Liquidsoap/Icecast package versions, TLS termination, ports, service users, firewall, and object-storage synchronization must be proven in staging before any production deployment.

## 17. Testing

### Actual results

| Check | Result |
|---|---|
| `pnpm run typecheck` | PASS |
| API server typecheck | PASS |
| Frontend typecheck | PASS |
| Scripts typecheck | PASS |
| Mockup sandbox typecheck | PASS |
| API server build | PASS |
| Drizzle development schema push | PASS; final run reported no changes |
| SQL migration safety scan | PASS; additive only, no DROP/TRUNCATE/ALTER |
| Focused Radio validation/storage contract checks | PASS |
| `GET /api/healthz` | HTTP 200 |
| `GET /api/readyz` | HTTP 200 with database ready |
| Unauthenticated Radio admin request | HTTP 401 |
| Unconfigured machine manifest request | HTTP 503 |
| Public `/api/radio/status` | HTTP 404; no public Radio route added |
| Development Radio table discovery | Seven expected tables present |
| `git diff --check` | PASS |
| Hardcoded credential scan | PASS |

### Test coverage performed

- Valid audio metadata acceptance.
- Unsupported extension/content-type rejection.
- Maximum-size rejection.
- Broadcast-eligibility conditions.
- Provider-not-configured fail-closed behavior.
- Liveness and database readiness.
- Human authentication boundary.
- Machine authentication configuration boundary.
- Public Radio surface absence.

### Test gap

The repository did not have an established automated API test runner for this feature. Full in-process route integration tests, database rollback tests, signed machine-request positive-path tests, and provider contract tests remain a staging follow-up before Phase 3.

## 18. Security Verification

- [x] Production missing `JWT_SECRET` fails closed.
- [x] No active hardcoded privileged passwords remain.
- [x] Seed passwords are not logged or returned.
- [x] JWT and authorization headers are not logged.
- [x] Privileged sessions check current account state.
- [x] CORS has an explicit allowlist.
- [x] JSON and URL-encoded request limits exist.
- [x] Security headers are applied.
- [x] Contributors have no Radio permissions.
- [x] Machine authentication is separate from human JWT.
- [x] Machine requests require timestamp and nonce.
- [x] Replay protection exists in-process.
- [x] Radio storage fails closed without a provider.
- [x] Upload completion requires checksum and size verification.
- [x] Upload completion enters quarantine.
- [x] Rights status is separate from editorial status.
- [x] Secrets are not stored in Radio settings.

## 19. Existing Feature Regression Check

### VERIFIED

- Existing frontend typecheck passes.
- Existing API typecheck passes.
- Existing scripts typecheck passes.
- Existing mockup artifact typecheck passes.
- Existing API build passes.
- API workflow restarted and reached port 8080.
- Existing liveness/readiness endpoints respond.
- Existing contributor migration and seed flow still ran successfully in the development workflow.

No existing Poetry, Poet, Contributor, Admin, Search, or authentication feature was intentionally redesigned.

The type-only Express parameter fixes and frontend callback/import fixes were behavior-neutral changes needed to make the repository’s declared typechecks pass under the current dependency versions.

## 20. Files Changed

### Security/runtime

- `.env.example` — documented seed, CORS, and Radio placeholders.
- `README.md` — updated security, readiness, and migration documentation.
- `replit.md` — removed the documented default admin password.
- `artifacts/api-server/src/app.ts` — explicit CORS, body limits, security headers, and safe error handling.
- `artifacts/api-server/src/index.ts` — environment-controlled seed credentials.
- `artifacts/api-server/src/lib/config.ts` — JWT, CORS, and Radio permission configuration.
- `artifacts/api-server/src/lib/rateLimit.ts` — endpoint rate-limit middleware.
- `artifacts/api-server/src/lib/audit.ts` — Radio audit writer with metadata redaction.
- `artifacts/api-server/src/middlewares/adminAuth.ts` — privileged account/session validation.
- `artifacts/api-server/src/routes/admin.ts` — login rate limiting.
- `artifacts/api-server/src/routes/health.ts` — readiness endpoint.
- `artifacts/api-server/src/routes/index.ts` — Radio route registration.

### Radio foundation

- `lib/db/src/schema/radio.ts` — Drizzle Radio tables and types.
- `lib/db/src/schema/index.ts` — Radio schema export.
- `lib/db/migrations/0001_radio_foundation.sql` — reviewed additive SQL migration.
- `artifacts/api-server/src/lib/radioStorage.ts` — provider-neutral storage contract.
- `artifacts/api-server/src/lib/radioValidation.ts` — audio metadata and eligibility validation.
- `artifacts/api-server/src/lib/radioMachineAuth.ts` — signed machine authentication and replay protection.
- `artifacts/api-server/src/routes/radio.ts` — protected Radio foundation routes.
- `artifacts/api-server/src/routes/radio-internal.ts` — machine-authenticated adapter routes.

### Type/build compatibility

- `scripts/package.json` — declared the existing `pg` runtime and type dependencies.
- `pnpm-lock.yaml` — lockfile update for the declared scripts dependencies.
- `artifacts/api-server/src/routes/admin.ts`
- `artifacts/api-server/src/routes/categories.ts`
- `artifacts/api-server/src/routes/contact.ts`
- `artifacts/api-server/src/routes/contributor-portal.ts`
- `artifacts/api-server/src/routes/poems.ts`
- `artifacts/api-server/src/routes/poets.ts`
- `artifacts/api-server/src/routes/tools.ts`
- `artifacts/api-server/src/routes/videos.ts`

The route files above received only `String(req.params.id)` type-boundary fixes.

### Existing frontend type fixes

- `artifacts/surrur-e-mann/src/pages/admin/dashboard.tsx`
- `artifacts/surrur-e-mann/src/pages/admin/settings.tsx`
- `artifacts/surrur-e-mann/src/pages/contributor/poems-new.tsx`
- `artifacts/surrur-e-mann/src/pages/language-poems.tsx`

These changes only resolve existing TypeScript failures and do not add Radio UI.

## 21. Database Migration Summary

The migration is additive and contains:

- Seven new Radio tables.
- Foreign keys with non-destructive `SET NULL`, `CASCADE`, or `RESTRICT` behavior as appropriate.
- Status and operational indexes.
- Unique playlist-position and manifest-version constraints.

The SQL file contains no `DROP`, `TRUNCATE`, or destructive alteration. It was reviewed before the development schema was applied.

The production database was not accessed or modified.

## 22. Git Status

The working tree contains:

- The Phase 2 implementation files listed above.
- The Phase 2 implementation report.
- Earlier Phase 0 and Phase 1 documentation already present in the workspace.

No history was rewritten. No commits were removed. No force push occurred.

## 23. Production Safety Verification

- [x] Existing website source was not replaced.
- [x] Existing API architecture was preserved.
- [x] No 24/7 Radio was started.
- [x] No Liquidsoap was installed.
- [x] No Icecast was installed.
- [x] No public streaming port was opened.
- [x] No production stream DNS was created.
- [x] No production stream SSL was created.
- [x] No production audio was uploaded.
- [x] No production schedule was activated.
- [x] No listener delivery was started.
- [x] No `/radio` public navigation was added.
- [x] Audio bytes are not stored on the deployment filesystem.
- [x] No object-storage resource was provisioned.
- [x] No production secrets were created or exposed.
- [x] No production database migration was run.
- [x] Contributor permissions were not changed.

## 24. Known Issues

1. The object-storage provider is intentionally unconfigured. Upload-session creation returns HTTP 503 until a provider implementation is approved and installed.
2. The in-process rate limiter is not suitable as the sole control for a horizontally scaled production deployment.
3. Machine nonce replay protection is process-local and must move to shared storage for multi-instance use.
4. Audio decoder/signature, loudness, and malware validation require a future isolated processing worker.
5. Schedule creation/activation and playlist-item administration are not complete.
6. There is no public now-playing endpoint or player.
7. Automated route integration tests are not yet part of the repository test setup.

## 25. Deferred Items

- Provider-specific storage implementation.
- Staging storage setup.
- Staging Liquidsoap/Icecast proof of concept.
- Manifest compiler and atomic publication.
- Playlist-item and schedule administration.
- Audio processing worker.
- Public metadata and player.
- Stream monitoring, alerting, and emergency controls.
- Production DNS, SSL, and listener capacity validation.
- Backup/restore validation for Radio objects and metadata.

## 26. New Findings

1. The current workspace had no test script or API integration-test harness, so focused runtime and contract checks were used for Phase 2.
2. The installed Express 5 type definitions expose route parameters as `string | string[]`; several existing routes required behavior-neutral type narrowing.
3. The scripts package imported `pg` without declaring it directly; the dependency declaration was added so the existing typecheck is reproducible.
4. The development database was available and accepted the additive Radio schema. This does not validate a production database or provider.
5. A provider-neutral abstraction can be safely added before provider selection only if the unconfigured implementation fails closed.

## 27. Decisions Still Required

Before Phase 3:

- Choose external VPS or managed Radio provider.
- Name the infrastructure operator.
- Approve monthly budget.
- Approve launch and peak listeners.
- Approve bitrate/codec/channel layout.
- Select object-storage provider.
- Approve storage retention/versioning.
- Approve stream subdomain.
- Confirm `Asia/Dubai` schedule timezone.
- Approve page-level player behavior.
- Approve exact admin/emergency permissions.
- Name monitoring and incident recipients.
- Approve RPO/RTO and retention.
- Supply emergency fallback content.
- Name rights/takedown authority.
- Accept and complete Phase 0 security remediation in production.
- Approve staging database/storage/machine isolation.

## 28. Recommended Next Phase

Do not begin production Radio implementation.

The next controlled step should be a separately approved staging proof of concept:

1. Select and document the storage provider.
2. Select and document the streaming provider/runtime.
3. Create isolated staging credentials and namespaces.
4. Implement one provider adapter behind the existing storage contract.
5. Implement isolated media inspection and checksum verification.
6. Implement manifest compilation and atomic activation in staging.
7. Run Liquidsoap/Icecast with non-production audio only.
8. Test failover, stale-manifest behavior, cache recovery, and rollback.
9. Complete route integration and security regression tests.
10. Review evidence before any production deployment request.

## 29. PHASE 2 STATUS

**READY WITH CONDITIONS**

Phase 2 foundation work is implemented and verified for controlled review.

Conditions:

- No provider has been selected or validated.
- Storage upload operations remain intentionally unavailable.
- No production Radio exists.
- Staging isolation and provider validation are still required.
- Full automated route integration and rollback tests are still required.
- Owner decisions in Section 27 remain open.

## Phase 3 Gate

Phase 3 must **not** begin automatically.

Phase 3 is **not safe to start** until:

- The owner approves the infrastructure and storage providers.
- A non-production environment is isolated and verified.
- Machine credentials and operator ownership are defined.
- The storage adapter passes contract tests.
- Audio processing and rights gates are operational.
- Manifest publication and rollback are tested.
- Security regression tests pass.
- The owner explicitly approves the next phase.
