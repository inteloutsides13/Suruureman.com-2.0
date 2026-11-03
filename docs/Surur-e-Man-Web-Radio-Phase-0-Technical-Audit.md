# Surur-e-Man — Web Radio
## Phase 0 Technical Audit & Discovery Report

**Production website:** https://suruureman.com  
**Repository:** https://github.com/inteloutsides13/surur-e-man  
**Audited branch:** `main`  
**Audit scope:** Read-only technical discovery and architecture assessment  
**Audit date:** 8 September 2026  

---

## A. Executive Summary

Surur-e-Man is an existing production full-stack web application built as a pnpm workspace. Its public website uses React 19, Vite 7, TypeScript, Tailwind CSS v4, Wouter, and TanStack Query. Its backend is an Express 5 TypeScript API bundled with esbuild. Persistent application data is held in PostgreSQL through Drizzle ORM. Authentication uses signed JWTs and bcrypt password hashing with three roles: developer, admin, and contributor.

The application is deployed publicly on Replit at `https://suruureman.com`. Replit deployment metadata confirms that the current production deployment type is **Autoscale**, with a successful active build. This is appropriate for the existing request/response website and API but is not appropriate for a continuously running 24/7 streaming engine. Replit documentation states that Autoscale instances may scale to zero and are not intended to maintain permanent background processes or persistent streaming connections.

The current source contains no Radio implementation, streaming server, encoder, audio scheduler, playlist engine, stream-health monitor, or durable media storage abstraction. There are no Liquidsoap, Icecast, FFmpeg, HLS, Shoutcast, or radio-service dependencies or configurations. Existing media records use externally supplied URLs; there is no application-managed file upload pipeline or persistent object-storage integration.

The existing system is nevertheless a good foundation for the **website-facing and management portions** of a future Radio feature:

- React/Wouter can accommodate a future `/radio` route and responsive player UI.
- The existing admin shell can accommodate an admin-only Radio management area.
- The Express API can later expose Radio catalog, playlist, schedule, settings, and now-playing metadata endpoints.
- PostgreSQL/Drizzle can hold Radio metadata, scheduling, audit, and playback-history records.
- Existing poet and poem metadata can be optionally linked to Radio audio records.
- Existing JWT roles can support developer/admin Radio permissions without granting contributor access by default.

The streaming engine should remain operationally separate from the current website/API deployment. The recommended direction is:

1. Keep the public player, admin UI, Radio metadata API, and Radio database records within the existing Surur-e-Man application.
2. Store audio files in persistent object storage or a dedicated media-storage service, not the deployment filesystem.
3. Run Liquidsoap or an equivalent automation engine in a separate always-on runtime.
4. Run Icecast or use a managed streaming provider as a separate listener-facing streaming service.
5. Make Radio failure independent of the main website: if streaming is unavailable, poetry browsing, admin, and contributor functionality must continue normally.

### Overall readiness

**READY WITH CONDITIONS**

Phase 1 can begin as an architecture and infrastructure design phase. It must not begin implementation until the owner approves the streaming location/provider, audio storage, expected listener capacity, bitrate, URL/domain arrangement, admin permissions, monitoring, fallback, and backup requirements.

---

## B. Current System Architecture

### 1. Repository and GitHub

Verified repository state:

- Repository: `inteloutsides13/surur-e-man`
- Default/current branch: `main`
- Remote: `https://github.com/inteloutsides13/surur-e-man.git`
- The repository has retained its existing production history, beginning with the initial project commit and including subsequent publishing, content, authentication, admin, and contributor work.
- The working tree was clean at the start of this audit.
- No prior or incomplete Radio implementation was found in source or configuration.

Important top-level areas:

```text
/
├── artifacts/
│   ├── surrur-e-mann/       React/Vite frontend
│   ├── api-server/          Express API
│   └── mockup-sandbox/      Design/component preview artifact
├── lib/
│   ├── db/                  Drizzle schema and database client
│   ├── api-spec/            OpenAPI specification and generation config
│   ├── api-zod/             Shared API schemas
│   └── api-client-react/    Generated React API client
├── scripts/                 Workspace support scripts
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── .replit
├── .gitignore
├── .env.example
└── README.md
```

The project uses pnpm workspaces. Root scripts perform workspace-wide type checking and builds. The frontend and API have independent package scripts and Replit artifact configurations.

### 2. Frontend

Verified stack:

- React 19
- Vite 7
- TypeScript
- Tailwind CSS v4
- Wouter
- TanStack Query
- Framer Motion and shared component primitives

The browser entry point is `artifacts/surrur-e-mann/src/main.tsx`. The main application composition and route groups are in `artifacts/surrur-e-mann/src/App.tsx`.

#### Public routes

The public application currently includes:

- `/`
- `/poetry/:language`
- `/poems`
- `/poems/:id`
- `/videos`
- `/poets`
- `/poets/:id`
- `/search`
- `/contact`
- `/tools`
- Catch-all not-found route

There is no `/radio` route today.

Public pages use a shared responsive layout in `artifacts/surrur-e-mann/src/components/layout.tsx`. It provides desktop and mobile navigation, header, footer, main content, search access, and responsive behavior. Routes are lazy-loaded and wrapped with Suspense loading UI. A top-level error boundary and toast provider are present.

#### Admin routes

The admin application includes:

- Login and dashboard
- Poem, poet, category, and video management
- Visual poetry
- Messages
- Settings
- Backups
- Users and contributors
- Contributor approval queue
- Tools

The admin shell and protected routing are suitable for a future Radio management section, but no Radio screens exist.

#### Contributor routes

The contributor portal includes:

- Contributor dashboard
- Own submissions
- New poem submission
- Poem editing/resubmission
- Poet creation

Contributor routing and the admin routing are intentionally separate. No contributor Radio permission or UI exists.

#### Data and UI behavior

- TanStack Query is configured globally with request retries and cache freshness defaults.
- Some pages use shared generated/query patterns; others use direct `fetch`.
- Lazy page loading and general error boundaries exist.
- The current app has video/media presentation but no reusable streaming-audio player.
- UI radio-group components found in the source are form controls, not internet-radio functionality.

### 3. Backend/API

The API is an Express 5 TypeScript application:

- Entry point: `artifacts/api-server/src/index.ts`
- Express application setup: `artifacts/api-server/src/app.ts`
- Route registry: `artifacts/api-server/src/routes/index.ts`
- Production bundle: esbuild
- Logging: Pino and `pino-http`

The API applies migrations and initial seed logic before listening on the configured port.

Current route groups include:

- Poems
- Poets
- Categories
- Videos
- Contact
- Tools
- Health
- Admin
- Contributor portal

Current conventions are conventional JSON request/response Express handlers backed by Drizzle queries. Route-level error handling logs internal errors and returns HTTP error responses. There is no queue, scheduler, background worker, media encoder, or persistent connection manager.

#### Health and observability

- Pino request logging is present.
- Sensitive authorization and cookie headers are redacted by the logger.
- A basic `GET /api/healthz` endpoint returns a static healthy response.
- The current health endpoint does not test the database or any external dependency.
- There is no readiness/liveness separation.
- There are no metrics, alerting integrations, stream availability checks, or Radio-specific status endpoints.

The README currently refers to `/api/health`, while the implemented route is `/api/healthz`. This documentation mismatch should be corrected separately, not as part of this audit.

### 4. Database and Drizzle

The project uses PostgreSQL with Drizzle ORM. Schema definitions are in `lib/db/src/schema/`.

The data model includes:

- Poems
- Poets
- Categories
- Videos
- Contact messages
- Site settings
- Admin/developer/contributor users
- Tools
- Audit logs

Poem records include content, language/category information, display flags, engagement counts, image URL, workflow status, contributor ownership, and approval/rejection attribution.

User records support:

- `developer`
- `admin`
- `contributor`
- Active/disabled status
- Last login
- Notes
- Token revocation timestamp

Contributor submissions preserve ownership through the creating user ID. Approval and rejection attribution are stored on poem records. Audit logs record security and workflow actions.

The current automatic migration mechanism uses idempotent SQL at API startup. This fits the current application but future Radio schema changes should be introduced in a controlled phase with explicit development and production validation.

### 5. Authentication and authorization

Authentication uses:

- Email/password login
- bcrypt password hashing
- JWT bearer tokens
- Role claims
- Protected Express middleware

Current role behavior:

- **Developer:** full developer-level administrative access
- **Admin:** content, user/contributor, and editorial administration
- **Contributor:** own profile and submission workflow

Contributor requests perform a database status and token-revocation check on each protected request. Disabling a contributor or resetting a contributor password can invalidate existing sessions. Admin/developer middleware uses a faster JWT role path and does not apply the same per-request database revocation check.

The current role architecture can support future Radio permissions without a new global role:

- Developer can have full Radio infrastructure/settings control.
- Admin can receive approved Radio content-management permissions.
- Contributor can remain excluded unless a later requirement explicitly approves contributor Radio activity.

### 6. Contributor system

The current contributor workflow includes:

1. Admin creates and manages contributor accounts.
2. Contributor signs in through the shared authentication entry point.
3. Contributor is routed to the contributor portal.
4. Contributor submits poems under their own user identity.
5. Submissions enter a pending state.
6. Admin reviews, approves, or rejects them.
7. Rejected submissions include a reason and can be edited and resubmitted.
8. Contributor account disabling invalidates access.

The workflow is a useful model for future moderated content, but Radio content should not automatically reuse contributor permissions. Audio rights, file security, storage cost, and broadcast control create a different risk profile.

### 7. Current storage and media behavior

No application-managed upload pipeline was found for images, videos, or audio.

Current media behavior is URL/reference based:

- Poems can hold an image URL.
- Poets can hold image URLs.
- Videos reference external video URLs and thumbnails.
- Public assets bundled with the frontend are static repository files.
- The API does not expose multipart upload endpoints.
- There is no MIME validation, file-size policy, virus/media scanning, filename normalization, signed access URL system, or media cleanup service.
- No App Storage/Object Storage integration is currently present.
- No audio files or audio-specific metadata model were found.

Static files committed with the frontend are appropriate for application assets but not for a growing Radio library. Replit deployment filesystems are not persistent across publishes, so runtime uploads to local disk would be unsafe.

**Current storage classification for a Radio library: NOT SUITABLE.**

The application must add persistent object/media storage in a later approved phase before accepting audio uploads.

### 8. Deployment

Account-specific deployment metadata was checked directly:

- Production URL: `https://suruureman.com`
- Additional Replit URL exists
- Deployment type: **Autoscale**
- Visibility: public
- Current build: successful

The frontend and API use artifact-specific Replit build/run configuration. The current architecture is optimized for a website and request/response API.

Replit documentation confirms:

- Autoscale is intended for stateless websites and APIs.
- Autoscale services can scale down when inactive.
- A continuous 24/7 process should use an always-running deployment such as a Reserved VM.
- Deployment filesystem state is not durable across publishes.
- App Storage/Object Storage is the appropriate persistent storage mechanism for uploaded media.

No current configuration provides:

- An always-on Radio process
- Process supervision for Liquidsoap/Icecast
- Stream reconnect/recovery logic
- Stream-specific TCP/public port configuration
- Listener bandwidth planning
- Radio CPU/memory monitoring
- Stream health alerts

---

## C. Radio Integration Assessment

### What can be reused

#### Frontend

- Existing React application shell
- Wouter route organization
- Responsive desktop/mobile navigation
- Lazy-loaded pages
- Loading/error primitives
- Existing visual identity and design components
- Admin and role-specific layouts

A future `/radio` public route can fit into the existing public router. A navigation entry can be added later after design approval. A dedicated Radio page can use the existing layout and branding.

#### Backend

- Express route organization
- JWT authentication middleware
- Admin/developer role checks
- JSON API conventions
- Pino logging
- Drizzle database access
- Audit logging model

The API can later expose:

- Public Radio status and now-playing metadata
- Audio library metadata
- Playlist CRUD
- Schedule CRUD
- Radio settings
- Playback history
- Admin-only operational controls

Actual stream transport should not be proxied through the existing Express API unless performance testing and architecture approval explicitly support it. The browser player should normally connect directly to the listener-facing stream endpoint.

#### Database

PostgreSQL/Drizzle is suitable for:

- Audio metadata and storage object references
- Optional poem/poet links
- Playlist definitions and item order
- Schedule rules
- Radio settings
- Playback history
- Audit and administrative attribution

The anticipated tables (`radio_audio`, `radio_playlists`, `radio_playlist_items`, `radio_schedules`, `radio_settings`, and `radio_play_history`) are conceptually compatible with the current relational design. Their exact schema, constraints, retention, and migration plan belong in Phase 1.

#### Authentication

The current role hierarchy is adequate for an initial Radio administration model:

- Developer: infrastructure, settings, credentials references, and full content control
- Admin: approved library, playlist, and scheduling operations
- Contributor: no Radio administration by default

Fine-grained Radio permissions may eventually be preferable to broad role checks, but that is an architecture decision rather than a Phase 0 change.

### What needs extension later

- Persistent object/media storage
- Audio upload validation and authorization
- Audio metadata extraction
- Codec/bitrate/sample-rate validation
- Normalization policy and processing pipeline
- Radio database schema
- Public player component
- Persistent/global player state if desired
- Radio admin UI
- Playlist and schedule engine integration
- Now-playing metadata service
- Stream health endpoint
- Monitoring and alerting
- Backup/restore process for metadata and media

### What should remain separate

- Liquidsoap or equivalent automation engine
- Icecast or managed streaming server
- 24/7 process lifecycle
- Listener connection handling
- Stream mount credentials
- Encoder recovery/reconnection
- Stream capacity and bandwidth

This separation prevents Radio failures or high listener load from degrading the main poetry website.

---

## D. Streaming Infrastructure Assessment

### Current-environment suitability

The current **Autoscale web deployment is not suitable for hosting the 24/7 streaming engine**.

Reasons:

1. Autoscale may scale to zero during inactivity.
2. A stream requires continuous process execution and persistent connections.
3. The existing API process has no stream supervisor or recovery behavior.
4. Co-locating streaming and the website would couple CPU, memory, network, and failure risks.
5. The deployment filesystem cannot serve as a durable audio library.
6. Listener traffic could compete with normal website/API traffic.

### Recommended infrastructure boundary

```text
Surur-e-Man Website (existing Autoscale deployment)
├── Public /radio page and player
├── Admin Radio management UI
├── Radio metadata and configuration API
└── PostgreSQL/Drizzle metadata
          │
          ├── Persistent object/media storage
          │
          └── Approved control/metadata interface
                    │
        Separate always-on streaming environment
        ├── Liquidsoap or equivalent automation
        ├── Schedule/playlist consumption
        ├── Fallback audio
        ├── Health/restart supervision
        └── Icecast or managed stream endpoint
                    │
                 Listeners
```

### Reserved VM versus external/managed streaming

Two credible Phase 1 options should be compared:

#### Option A — Replit Reserved VM plus separate streaming service process

Potential advantages:

- Always-running Replit environment
- Familiar operational platform
- Replit monitoring for CPU and memory
- Easier proximity to existing project operations

Questions requiring proof:

- Whether the required listener-facing streaming ports and protocol behavior are supported for the chosen stack
- Expected bandwidth/egress behavior and cost
- CPU requirements for transcoding
- Process supervision and restart strategy
- Whether Icecast should run on the same Reserved VM as Liquidsoap
- Operational isolation from the website project

The streaming workload should be a separate deployment/service, not added to the existing Autoscale API process.

#### Option B — Dedicated VPS or managed internet-radio provider

Potential advantages:

- Infrastructure designed for continuous streaming
- Mature listener delivery and mount management
- Predictable network behavior
- Managed providers may include analytics, fallback, AutoDJ, and monitoring
- Stronger separation from the production website

Tradeoffs:

- Additional provider and cost
- Separate credentials and operations
- Integration/API dependency
- Possible limitations on scheduling, metadata, or custom automation

Phase 1 should compare total operational burden, not only monthly server price.

### Liquidsoap assessment

Liquidsoap is conceptually suitable for automated programming because it can:

- Select and sequence audio sources
- Implement playlists and schedule logic
- Normalize or transcode output
- Provide fallback sources
- Send metadata to a streaming server
- Reconnect after upstream failures

It requires an always-running supervised runtime, tested audio formats, fallback content, log management, and an agreed source of playlist/schedule data.

### Icecast assessment

Icecast is conceptually suitable as an open listener-facing streaming server because it provides:

- Stream mount points
- Common internet-radio client compatibility
- Listener connections
- Stream metadata
- Source authentication

It introduces:

- Public network and TLS considerations
- Mount/source/admin credential management
- Capacity and bandwidth management
- Listener monitoring
- Restart and availability responsibilities

A managed streaming provider may reduce these responsibilities. No provider decision is made in Phase 0.

### Website consumption

The future player should consume a public HTTPS stream URL directly. The application API should separately provide now-playing metadata and health/status. This avoids routing continuous audio bandwidth through the Express API.

Possible conceptual URLs:

```text
https://suruureman.com/radio
https://radio.suruureman.com/stream
https://suruureman.com/api/radio/now-playing
```

These are planning examples only. No route, DNS, SSL, or subdomain change has been made.

---

## E. Storage Assessment

### Current capability

Current content stores media references as URLs. There is no upload or durable managed-media subsystem.

### Future Radio requirements

A Radio audio library needs:

- Persistent object storage
- Unique immutable object keys
- Database metadata separate from binary files
- Upload authorization
- File-size limits
- MIME and content validation
- Approved codecs and containers
- Duration, bitrate, sample-rate, and channel metadata
- Optional loudness analysis/normalization status
- Safe replacement/version behavior
- Deletion protection for scheduled or historical content
- Backup or provider durability policy
- Cleanup rules for failed/orphaned uploads
- Public/private access decision

### Recommendation

Use Replit App Storage/Object Storage or another approved object-storage provider. Store object references and metadata in PostgreSQL. Do not place audio binaries in Git, the frontend public directory, PostgreSQL large fields, or the deployment filesystem.

If the streaming engine cannot securely and efficiently read the selected storage, Phase 1 must define a controlled delivery or synchronization method. Signed URLs, private buckets, or a dedicated media-origin layer should be evaluated.

---

## F. Security Assessment

### Positive current controls

- Passwords are hashed with bcrypt.
- JWT middleware protects admin and contributor endpoints.
- Contributor ownership checks restrict access to own submissions.
- Disabled/revoked contributor sessions are checked against the database.
- Audit logs record sensitive workflow activity.
- Pino redacts authorization and cookie headers.
- `.env` patterns are excluded from Git.
- `.env.example` contains variable names without real values.

### Confirmed security findings

#### 1. Bootstrap credentials exist in source

The API seed path contains fixed initial admin/developer credentials in source code. This is a serious credential-hygiene risk because source history is durable. Values are intentionally not reproduced in this report.

**Recommendation:** Rotate affected credentials and replace source literals with a secure initialization process in a separately approved security task.

#### 2. JWT secret has a source fallback

Authentication middleware contains a fallback signing secret when `JWT_SECRET` is absent.

**Impact:** A misconfigured deployment may start with a predictable signing key rather than failing safely.

**Recommendation:** Remove the fallback and fail closed when the secret is missing in a separately approved security task.

#### 3. Admin/developer revocation is weaker than contributor revocation

Contributor requests check current database status and token revocation. Admin/developer access relies on JWT verification and role claims without the same per-request account-state validation.

**Recommendation:** Review and unify privileged-session revocation policy before adding Radio infrastructure controls.

#### 4. Broad CORS and limited API hardening

The Express app uses unrestricted CORS. No explicit rate limiter, security-header middleware, or request-size policy was found.

**Recommendation:** Define origin, rate, and body-size policies before introducing upload or operational-control endpoints.

#### 5. Basic health check only

The current health endpoint does not validate database, storage, or future streaming dependencies.

**Recommendation:** Phase 1 must define authenticated operational health and public status semantics without exposing sensitive infrastructure details.

### Future Radio security requirements

- Keep source, admin, mount, and provider credentials in secret management.
- Never send streaming credentials to the browser.
- Separate public listener URLs from source/control endpoints.
- Restrict audio upload and management to approved roles.
- Validate actual file content, not only extension.
- Limit upload size and duration.
- Consider malware scanning and media-parser isolation.
- Audit uploads, deletions, playlist changes, schedules, and emergency controls.
- Protect control APIs with short-lived authentication and replay resistance where needed.
- Use HTTPS for listener and metadata endpoints.
- Rotate stream/source credentials.
- Avoid exposing private object-storage URLs or credentials.

---

## G. Failure, Fallback, Monitoring, and Recovery

### Failure points

- Main website unavailable
- API unavailable
- Database unavailable
- Object storage unavailable
- Streaming engine stopped
- Streaming server unavailable
- Source-to-server connection lost
- Invalid or unsupported audio
- Missing object
- Empty playlist
- Schedule evaluation failure
- Metadata update failure
- TLS/DNS failure
- Resource exhaustion
- Network or bandwidth saturation

### Required separation behavior

- Website failure should not immediately stop an already-running stream.
- Radio failure should not break poetry browsing or existing admin/contributor workflows.
- Metadata failure should not stop audio playback.
- Missing/invalid scheduled audio should activate fallback audio.
- Empty playlists must never produce uncontrolled silence.

### Minimum future fallback requirements

- Known-good emergency loop
- Fallback playlist
- Invalid/missing file skip behavior
- Source reconnect with bounded backoff
- Streaming server restart policy
- Alert after sustained silence or unavailable mount
- Manual emergency override

### Monitoring requirements

Monitor:

- Public stream availability
- Audio presence/silence
- Liquidsoap process health
- Icecast/provider source health
- Current item and metadata age
- Listener count/connections
- CPU and memory
- Network throughput
- Disk/cache use where applicable
- Schedule lag
- Storage read failures
- Error and reconnect rate

Alerts should distinguish website failure, metadata failure, storage failure, and stream failure.

### Backup and recovery

Current application source is preserved in GitHub. PostgreSQL and future object storage require documented backup/recovery objectives.

Phase 1 must define:

- Database recovery point and recovery time objectives
- Media durability and versioning
- Playlist/schedule/settings restore process
- Streaming configuration backup
- Secret re-provisioning procedure
- Disaster recovery runbook
- Restoration testing cadence

Audio binaries should not rely solely on application source backups.

---

## H. Listener Capacity and Bandwidth

Capacity cannot be selected without owner input.

Approximate continuous outbound audio bandwidth:

```text
monthly GB ≈ bitrate_kbps × simultaneous_listeners × 0.324
```

This assumes continuous 30-day listening and is a planning approximation before protocol overhead.

Examples for illustration only:

| Bitrate | 10 simultaneous listeners | 100 simultaneous listeners |
|---|---:|---:|
| 64 kbps | ~207 GB/month | ~2.07 TB/month |
| 96 kbps | ~311 GB/month | ~3.11 TB/month |
| 128 kbps | ~415 GB/month | ~4.15 TB/month |

These examples are not forecasts. Real planning requires expected average and peak listeners, average listening duration, and provider bandwidth pricing.

### OPEN DECISION — CLIENT/PROJECT INPUT REQUIRED

- Expected launch listeners
- Peak simultaneous listeners
- Growth horizon
- Preferred audio quality
- Monthly infrastructure budget
- Acceptable downtime
- Geographic audience

---

## I. Technical Risk Register

| Risk Area | Evidence-based finding | Severity | Impact | Recommendation |
|---|---|---:|---|---|
| 24/7 streaming | Current production is Autoscale and can scale down | Critical | Stream interruption | Use separate always-on streaming infrastructure |
| Failure isolation | Current API has no stream process boundary | High | Radio load/failure could affect website if colocated | Keep streaming separate from website/API |
| Audio storage | No upload or persistent object-storage subsystem exists | Critical | Audio loss/unavailability | Add approved object storage before audio ingestion |
| Credentials | Fixed bootstrap credentials exist in source history | Critical | Unauthorized privileged access | Rotate and redesign initialization separately |
| JWT configuration | Predictable source fallback exists if secret is missing | Critical | Token forgery under misconfiguration | Fail closed; remove fallback separately |
| Bandwidth | Listener count and bitrate are undecided | High | Unexpected cost or capacity failure | Approve capacity model before provider selection |
| Upload security | No MIME/content/size validation pipeline exists | High | Malicious or invalid media | Design secure media-ingestion pipeline |
| Monitoring | Only a static web health endpoint exists | High | Delayed detection of silence/outage | Define layered stream monitoring and alerts |
| Fallback | No emergency audio or schedule fallback exists | High | Dead air | Design fallback hierarchy before launch |
| Admin session security | Privileged revocation behavior is weaker than contributor behavior | High | Disabled privileged account may retain token access | Unify privileged-session policy before Radio controls |
| Health documentation | README and implementation disagree on health path | Medium | Incorrect monitoring configuration | Correct documentation in a separate task |
| CORS/rate limits | Broad CORS and no explicit rate limits found | Medium/High | API abuse, especially uploads/control APIs | Establish endpoint-specific security policies |
| Deployment filesystem | Files reset across publishes | Critical | Uploaded audio disappears | Never store production audio on local deployment disk |
| Backup/recovery | No Radio media/config recovery process exists | High | Extended outage or data loss | Define RPO/RTO and tested restoration |
| Metadata dependency | No now-playing source of truth exists | Medium | Stale/incorrect player display | Define event/status contract in Phase 1 |
| Rights/compliance | Audio rights/licensing process is not defined | High | Legal/takedown risk | Establish content-rights approval outside technical implementation |

---

## J. Architecture Decision Log

| Decision | Status | Options | Recommendation | Approval Required |
|---|---|---|---|---|
| Streaming location | Open | Existing Autoscale / separate Replit Reserved VM / VPS / managed provider | Do not use existing Autoscale; compare separate always-on options | Yes |
| Automation engine | Open | Liquidsoap / provider AutoDJ / alternative | Liquidsoap is technically suitable if self-hosted operations are accepted | Yes |
| Streaming server | Open | Icecast / managed provider | Compare operational burden and bandwidth pricing | Yes |
| Audio storage | Open | Replit App Storage / external object storage / provider library | Persistent object storage; never deployment disk | Yes |
| Stream bitrate | Open | 64 / 96 / 128 kbps or multiple renditions | Decide from audience, content, and cost | Yes |
| Codec | Open | MP3 / AAC or provider-supported alternatives | Prefer broad browser/device compatibility | Yes |
| Channel format | Open | Mono / stereo | Decide based on source material and bandwidth | Yes |
| Listener capacity | Open | Capacity tiers based on peak concurrency | Obtain expected launch and peak numbers | Yes |
| Stream URL | Open | Main domain path / dedicated subdomain / provider URL | Prefer stable HTTPS dedicated subdomain or managed URL | Yes |
| Public player | Open | Page-only / persistent global player | Start with page-level unless continuous navigation playback is required | Yes |
| Admin permissions | Open | Developer only / selected admin controls | Developer full; admin content/schedule rights after approval | Yes |
| Contributor permissions | Open | None / submission-only / broader | None by default | Yes |
| Metadata delivery | Open | Polling / SSE / provider endpoint | Start with resilient polling unless realtime needs justify SSE | Yes |
| Website-stream coupling | Recommended | Coupled / isolated | Isolate streaming runtime and listener delivery | Yes |
| Monitoring | Open | Basic uptime / layered audio and infrastructure monitoring | Layered monitoring with silence detection | Yes |
| Backup objectives | Open | Provider defaults / explicit RPO-RTO | Define explicit recovery targets | Yes |

---

## K. Open Questions Before Phase 1

1. Should the streaming runtime be a Replit Reserved VM, an external VPS, or a managed radio provider?
2. Is self-managed Liquidsoap/Icecast operational complexity acceptable?
3. What are expected launch and peak simultaneous listener counts?
4. What growth period should capacity planning cover?
5. What bitrate, codec, sample rate, and mono/stereo format are required?
6. Will the station stream continuously from launch?
7. What uptime target is required?
8. What monthly infrastructure/bandwidth budget is acceptable?
9. Which object-storage provider should hold master audio?
10. Will audio be public, signed/private, or synchronized to the streaming host?
11. Which audio formats may administrators upload?
12. Is loudness normalization required, and to which standard?
13. Should Radio audio link to existing poet and poem records?
14. Should the public player persist while users navigate between pages?
15. Should the stream use `radio.suruureman.com` or another URL?
16. Which Radio functions may Admin control?
17. Should Contributors have no Radio access, or a future moderated audio-submission role?
18. What fallback audio and emergency programming are approved?
19. Who receives outage alerts and through which channel?
20. What metadata is public?
21. How long should playback history be retained?
22. What backup and restoration targets are required?
23. What audio licensing, ownership, and takedown process will apply?

---

## L. Recommended Phase 1 Direction

Phase 1 should produce an approved detailed architecture, not Radio application code.

Recommended Phase 1 work:

1. Compare three infrastructure options:
   - Separate Replit Reserved VM
   - External VPS with Liquidsoap/Icecast
   - Managed internet-radio provider
2. Produce a capacity and monthly bandwidth model using approved listener and bitrate inputs.
3. Select persistent audio storage and define secure access from the streaming layer.
4. Define the boundary and contracts between:
   - Existing website/player
   - Existing API/database
   - Audio storage
   - Automation engine
   - Streaming server/provider
5. Define Radio database entities and relationships without applying migrations.
6. Define role/permission and audit requirements.
7. Define public stream, now-playing, health, and admin-control API contracts.
8. Define fallback, monitoring, alerting, backup, and disaster recovery.
9. Produce an implementation sequence and production rollback plan.
10. Obtain explicit architecture and infrastructure approval before development.

### Recommended implementation order after Phase 1 approval

1. Security prerequisite remediation
2. Object storage and secure audio ingestion
3. Radio metadata schema/API
4. Admin audio library
5. Playlist and scheduling
6. Separate streaming runtime
7. Now-playing/health integration
8. Public Radio page/player
9. Failure/fallback and monitoring
10. Load, resilience, and production-readiness testing

This sequence is guidance for future planning only.

---

## M. Phase 1 Readiness

**READY WITH CONDITIONS**

Conditions:

- Approve an always-on streaming infrastructure option separate from the existing Autoscale website process.
- Approve object/media storage.
- Provide listener-capacity and bitrate requirements.
- Approve role/permission boundaries.
- Approve stream URL/domain direction.
- Define minimum monitoring, fallback, and backup requirements.
- Address critical credential and JWT-secret findings before exposing new privileged Radio controls.

---

# Phase 0 Result

**Status:** `READY WITH CONDITIONS`

## What Was Audited

- Repository
- Git/GitHub
- Frontend
- Backend/API
- Database
- Authentication
- Authorization
- Contributor system
- Storage
- File-upload behavior
- Deployment
- Replit infrastructure
- Security
- Existing media/content
- Radio integration points
- Streaming architecture
- Failure and fallback needs
- Monitoring
- Backup and recovery
- Risks
- Open decisions

## What Was Found

- The current React/Express/PostgreSQL architecture can support the Radio website UI, administration, metadata, playlists, schedules, and audit records after approved extension.
- No Radio implementation currently exists.
- No secure persistent audio-upload/storage system currently exists.
- The current public deployment is a healthy Replit Autoscale deployment.
- Autoscale is unsuitable for a continuously running 24/7 streaming engine.
- A separate always-on streaming runtime or managed provider is recommended.
- Liquidsoap and Icecast are conceptually suitable for a self-hosted architecture but introduce operational, monitoring, bandwidth, and security responsibilities.
- Several critical security hygiene findings should be handled before adding privileged Radio controls.

## What Was Not Changed

No production application behavior was changed as part of this audit.

Specifically:

- No Radio feature was implemented.
- No application source behavior was changed.
- No production database query or schema change was performed.
- No authentication or authorization behavior was changed.
- No admin or contributor permissions were changed.
- No streaming service was installed or started.
- No audio was uploaded.
- No deployment configuration was changed.
- No DNS or SSL configuration was changed.
- No paid infrastructure was purchased.
- No Git history was rewritten.

The only workspace addition is this Phase 0 audit document.

## Risks

The highest risks are:

1. Attempting continuous streaming on the existing Autoscale runtime.
2. Storing audio on a non-persistent deployment filesystem.
3. Undecided listener capacity and bandwidth cost.
4. Missing upload validation and storage controls.
5. Missing stream fallback and monitoring.
6. Existing credential and JWT-secret hygiene weaknesses.
7. Coupling Radio failure or load to the production poetry website.

## Open Decisions

Owner approval is required for streaming provider/location, storage, capacity, quality, URL/domain, permissions, monitoring, fallback, backup, and operational ownership.

## Recommendation

Preserve the existing production website architecture. Add future Radio web and management functionality to the existing React/Express/PostgreSQL application, but isolate the listener-facing 24/7 streaming engine and server in a separate always-on environment. Use persistent object storage for audio. Do not begin implementation until Phase 1 architecture and infrastructure decisions are approved.

## Next Phase

**Phase 1: Radio Architecture & Infrastructure Design**

Phase 1 should convert the verified findings and approved inputs into a detailed architecture, provider comparison, capacity model, data/API design, operational plan, security requirements, and implementation roadmap. It should not silently commit the project to infrastructure or permissions that have not been approved.

---

## Evidence Sources

Repository evidence was inspected from:

- `package.json`
- `pnpm-workspace.yaml`
- `.replit`
- `.gitignore`
- `.env.example`
- `README.md`
- `replit.md`
- `artifacts/surrur-e-mann/src/main.tsx`
- `artifacts/surrur-e-mann/src/App.tsx`
- `artifacts/surrur-e-mann/src/components/layout.tsx`
- `artifacts/surrur-e-mann/src/components/admin-layout.tsx`
- `artifacts/surrur-e-mann/src/components/contributor-layout.tsx`
- `artifacts/surrur-e-mann/src/hooks/use-admin-auth.ts`
- `artifacts/api-server/src/index.ts`
- `artifacts/api-server/src/app.ts`
- `artifacts/api-server/src/routes/`
- `artifacts/api-server/src/middlewares/adminAuth.ts`
- `artifacts/api-server/src/lib/logger.ts`
- `artifacts/api-server/src/lib/migrations.ts`
- `lib/db/src/`
- Artifact package/build/deployment configuration
- Git branch, remote, status, and history
- Current Replit deployment metadata

Authoritative Replit references:

- Deployment types: https://docs.replit.com/features/publishing/deployment-types
- App Storage: https://docs.replit.com/features/data-and-storage/object-storage
- Ports: https://docs.replit.com/features/project-setup/ports
- Deployment monitoring: https://docs.replit.com/features/publishing/monitoring-a-deployment
