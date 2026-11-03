# Surur-e-Man — Web Radio
## Phase 1 Architecture & Infrastructure Design

**Production website:** https://suruureman.com  
**Repository:** https://github.com/inteloutsides13/surur-e-man  
**Source document:** `docs/Surur-e-Man-Web-Radio-Phase-0-Technical-Audit.md`  
**Phase:** 1 — Architecture and infrastructure design only  
**Design date:** 8 September 2026  
**Production status:** No implementation or infrastructure changes made  

---

# 1. Executive Summary

This document defines the target architecture for adding a 24/7 Web Radio service to the existing Surur-e-Man production application. It is an implementation blueprint, not an implementation.

The central architecture decision is:

> **WEBSITE ≠ STREAMING ENGINE**

The existing Replit Autoscale deployment remains responsible for the public website, future Radio player UI, Radio administration, metadata APIs, PostgreSQL records, and editorial workflows. It must not become responsible for continuous audio generation or listener delivery.

## Recommended infrastructure

Use a **separate external always-on VPS** for the first production streaming layer:

- **Liquidsoap** for playlist automation, deterministic scheduling, audio sequencing, fallback, metadata emission, and reconnection.
- **Icecast** for the HTTPS listener-facing stream, mount point, listener connections, source authentication, and stream metadata.
- **Persistent object storage** for canonical master audio.
- A **local synchronized playout cache** on the streaming VPS so temporary object-storage or website/API outages do not immediately interrupt the stream.
- The existing **Surur-e-Man Express API and PostgreSQL database** as the canonical editorial control plane for audio metadata, rights status, playlists, schedules, settings, and playback history.

## Why this option is recommended

An external VPS provides:

- True always-on operation.
- Full Liquidsoap and Icecast compatibility.
- Direct process supervision and restart control.
- Stable public streaming ports and TLS options.
- Predictable access to a local playout cache.
- Strong isolation from the existing production website.
- Sufficient flexibility for Surur-e-Man’s custom playlist, scheduling, attribution, rights, and admin requirements.
- Lower provider lock-in than a managed AutoDJ platform.

This recommendation assumes the project owner accepts normal Linux server operations or appoints an operator. If no one will own patching, monitoring, incidents, and recovery, the recommended alternative is a managed internet-radio provider.

## Decisions still required

Implementation cannot begin safely until the owner approves:

- External VPS versus managed provider.
- Infrastructure/operator ownership.
- Launch and peak listener capacity.
- Audio bitrate, codec, and mono/stereo choice.
- Monthly budget.
- Object-storage provider.
- Stream URL/subdomain.
- Admin permission scope.
- Monitoring recipients.
- Backup RPO/RTO.
- Emergency fallback content.
- Audio rights and takedown authority.

## Final Phase 1 status

**NOT READY — DECISIONS REQUIRED**

The architecture is complete enough for owner review, cost validation, and provider selection. Phase 2 must not start until the decision gates in this document are approved.

---

# 2. Phase 0 Findings Recap

Phase 0 verified:

- Frontend: React 19, Vite 7, TypeScript, Tailwind CSS v4, Wouter, TanStack Query.
- Backend: Express 5, TypeScript, esbuild.
- Database: PostgreSQL with Drizzle ORM.
- Authentication: JWT and bcrypt.
- Roles: developer, admin, contributor.
- Production: healthy public Replit Autoscale deployment.
- The Autoscale deployment is appropriate for the website/API but not a 24/7 streaming process.
- There is no existing Radio feature, player, Radio API, schema, streaming engine, or streaming server.
- There is no persistent audio upload/storage pipeline.
- Existing media handling is URL/reference based.
- The existing frontend, API, database, authentication, admin shell, and audit patterns can be extended for Radio.
- The 24/7 streaming layer must remain separate from the existing website/API deployment.
- The production deployment filesystem must not hold the permanent audio library.
- Contributor Radio administration is not approved.
- Critical credential, JWT fallback, privileged-session, CORS, rate-limit, body-size, and health-check issues were identified.

This Phase 1 design preserves those conclusions.

---

# 3. Current Architecture

```text
PUBLIC USERS
    |
    v
https://suruureman.com
    |
    +-- React/Vite public website
    +-- Admin portal
    +-- Contributor portal
    |
    v
Replit Autoscale Express API
    |
    +-- JWT authentication and role checks
    +-- Public content APIs
    +-- Admin APIs
    +-- Contributor APIs
    +-- Audit logging
    |
    v
PostgreSQL / Drizzle
    |
    +-- Poems
    +-- Poets
    +-- Categories
    +-- Videos
    +-- Users
    +-- Contributor workflow
    +-- Settings
    +-- Audit logs
```

No existing component generates, schedules, or serves continuous audio.

---

# 4. Target Radio Architecture

```text
                           PUBLIC CONTROL PLANE
┌─────────────────────────────────────────────────────────────────────┐
│ Existing Replit Autoscale deployment                               │
│ https://suruureman.com                                              │
│                                                                     │
│ React                                                               │
│ ├── /radio page                                                     │
│ ├── Public player                                                   │
│ └── Admin Radio management                                         │
│                                                                     │
│ Express API                                                         │
│ ├── Public status / now-playing                                     │
│ ├── Audio metadata and upload coordination                          │
│ ├── Playlist management                                             │
│ ├── Schedule management                                             │
│ ├── Settings and operational status                                 │
│ └── Playback history                                                │
│                                                                     │
│ PostgreSQL / Drizzle                                                │
│ ├── Radio metadata                                                  │
│ ├── Rights and approval                                             │
│ ├── Playlists and schedules                                         │
│ ├── Settings                                                        │
│ └── Playback history                                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ authenticated metadata/control sync
                               │
                ┌──────────────┴──────────────┐
                │                             │
                v                             v
┌──────────────────────────┐     ┌────────────────────────────────────┐
│ Persistent Object Storage│     │ SEPARATE STREAMING PLANE           │
│                          │     │ External always-on VPS             │
│ Private master audio     │────>│                                    │
│ Immutable object keys    │sync │ Playout cache                      │
│ Versioning/retention     │     │ ├── Approved synchronized audio    │
└──────────────────────────┘     │ └── Emergency loop                 │
                                 │                                    │
                                 │ Liquidsoap                         │
                                 │ ├── Deterministic schedule         │
                                 │ ├── Playlist sequencing            │
                                 │ ├── Fallback chain                 │
                                 │ ├── Metadata events                │
                                 │ └── Reconnection                   │
                                 │          │                         │
                                 │          v                         │
                                 │ Icecast                            │
                                 │ ├── HTTPS listener mount           │
                                 │ ├── Source authentication          │
                                 │ ├── Listener connections           │
                                 │ └── Stream metadata                │
                                 └──────────────┬─────────────────────┘
                                                │ public HTTPS audio
                                                v
                                           LISTENERS
```

## Architectural principles

1. **Failure isolation:** Radio failure must not take down poetry, poets, search, admin, contributors, or existing APIs.
2. **Control/data separation:** PostgreSQL holds metadata; object storage holds binary audio.
3. **Control/stream separation:** Express manages editorial state; Liquidsoap executes playout.
4. **Direct delivery:** The browser listens directly to Icecast; audio never passes through Express.
5. **Local continuity:** The streaming VPS plays from a synchronized cache, not a live dependency on every object-storage read.
6. **Approved content only:** Only approved, rights-cleared, processed audio enters active playlists.
7. **Determinism:** At any moment, schedule precedence has one predictable result.
8. **Fail safe:** Invalid schedules are rejected; missing audio is skipped; fallback audio prevents silence.
9. **Secret boundaries:** Browser, public API, and database never expose source/admin/storage credentials.
10. **Replaceability:** The API talks to a streaming adapter so a managed provider could replace self-hosted streaming later.

---

# 5. Infrastructure Options Comparison

## Option A — Separate Replit Reserved VM

| Criterion | Assessment |
|---|---|
| 24/7 reliability | Reserved VM is designed to remain always running |
| Always-on processes | Supported in principle |
| Liquidsoap/Icecast | Requires confirming system packages, TCP/HTTP port behavior, TLS routing, and process startup |
| CPU/memory | Selectable machine configuration; transcoding load must be tested |
| Network/bandwidth | Account plan and deployment pricing must be verified |
| Storage | Deployment filesystem is not canonical persistent storage; object storage still required |
| Monitoring | Replit deployment monitoring provides CPU/memory visibility |
| Restart/recovery | Requires service supervision and verified restart behavior |
| Security | Replit Secrets and deployment isolation available |
| Operations | Moderate; familiar platform, but streaming-specific operations remain project-owned |
| Scalability | Primarily vertical; listener delivery may become bandwidth constrained |
| Vendor lock-in | Medium |
| Integration | Good proximity to existing Replit services |
| Failure isolation | Good only as a separate deployment/project |
| Cost | **PRICE REQUIRES CURRENT REPLIT ACCOUNT QUOTE** |
| Suitability | Viable candidate, but streaming ports, egress economics, and package/runtime behavior require a proof of concept |

### Why not recommended as the default

The Phase 0 audit verified Replit for the current website but did not verify streaming-specific port behavior, egress economics, or Liquidsoap/Icecast runtime support. A Reserved VM may work, but selecting it before a non-production proof of concept would turn assumptions into production architecture.

## Option B — External VPS with Liquidsoap and Icecast

| Criterion | Assessment |
|---|---|
| 24/7 reliability | Strong when using a reputable provider, monitoring, and service supervision |
| Always-on processes | Native |
| Liquidsoap/Icecast | Full compatibility on supported Linux distributions |
| CPU/memory | Direct sizing and observability; 1–2 vCPU and 1–2 GB RAM is a reasonable test baseline, not a final capacity |
| Network/bandwidth | Provider-specific allowances and overages; capacity model required |
| Storage | Local cache plus external object storage |
| Monitoring | Full choice of provider and application monitoring |
| Restart/recovery | systemd/supervisor, health checks, bounded reconnect, snapshots |
| Security | Full firewall, SSH, TLS, OS patching, least-privilege service users |
| Operations | Highest responsibility of the three options |
| Maintenance | OS, Liquidsoap, Icecast, TLS, monitoring, backups, and incident response are project-owned |
| Scalability | Vertical first; additional relay nodes or CDN/provider migration later |
| Vendor lock-in | Low |
| Integration | Highest flexibility for custom schedules and metadata |
| Failure isolation | Excellent when separate from the website deployment |
| Cost | Low base compute is possible; listener bandwidth can dominate |
| Suitability | Best technical fit for custom Surur-e-Man control and automation |

### Verified public pricing example

DigitalOcean publicly advertises basic Droplets starting at **US$4/month**, with included transfer starting at **500 GiB/month**. Additional outbound transfer is documented at **US$0.01/GiB**. These figures were checked on 8 September 2026 and are examples, not a project quote or final selected plan.

At 96 kbps:

- 10 continuous listeners use about 311 GB/month before overhead.
- 25 continuous listeners use about 778 GB/month.
- 50 continuous listeners use about 1.56 TB/month.
- 100 continuous listeners use about 3.11 TB/month.

Therefore, stream bandwidth—not CPU—may determine the actual plan and provider.

### Why recommended

This option best matches the planned custom database, API, rights, playlist, and schedule model. It provides complete control while maintaining a hard boundary from the production website.

## Option C — Managed internet-radio provider

| Criterion | Assessment |
|---|---|
| 24/7 reliability | Provider-managed |
| Always-on processes | Included as AutoDJ/automation |
| Liquidsoap/Icecast | Abstracted or provider-specific; direct Liquidsoap may not be available |
| CPU/memory | Provider-managed |
| Network/bandwidth | Packaged by listener or listening-hour limits |
| Storage | Often bundled, but should not automatically become the canonical archive |
| Monitoring | Usually includes basic status and analytics |
| Restart/recovery | Provider-managed |
| Security | Provider manages stream infrastructure; project retains account/API security |
| Operations | Lowest |
| Maintenance | Lowest project responsibility |
| Scalability | Plan upgrades; provider-dependent |
| Vendor lock-in | Highest |
| Integration | API capabilities vary; custom deterministic scheduling may be constrained |
| Failure isolation | Excellent |
| Cost | Predictable plans, but feature/listening-hour limits apply |
| Suitability | Best if operational simplicity is more important than custom control |

### Verified public pricing example

Radio.co publicly listed a Lite plan at **US$35/month when billed annually**, with 2 GB storage, 500 concurrent listeners, 18,000 listening hours, and up to 192 kbps at the time of research. Provider offerings can change and must be quoted again before procurement.

**PRICE REQUIRES CURRENT PROVIDER QUOTE**

### Why not selected as primary

Surur-e-Man anticipates a custom audio library, rights workflow, ordered/shuffled playlists, deterministic scheduling, metadata, playback history, and existing admin integration. A managed provider may not expose all required operations or may become a second source of truth.

It remains the preferred alternative when:

- No qualified streaming operator is available.
- Provider operational support outweighs customization.
- The chosen provider exposes adequate playlist, schedule, metadata, and status APIs.
- Listening-hour and storage limits fit the approved budget.

## Decision matrix

Scoring: 1 weak, 5 strong. Weight reflects Surur-e-Man’s stated requirements.

| Criterion | Weight | Replit Reserved VM | External VPS | Managed provider |
|---|---:|---:|---:|---:|
| Always-on confidence | 5 | 4 | 5 | 5 |
| Custom scheduling/control | 5 | 5 | 5 | 3 |
| Failure isolation | 5 | 4 | 5 | 5 |
| Operational simplicity | 4 | 3 | 2 | 5 |
| Bandwidth predictability | 5 | 2 | 4 | 4 |
| Existing app integration | 4 | 4 | 5 | 3 |
| Monitoring/recovery control | 4 | 4 | 5 | 3 |
| Low vendor lock-in | 3 | 3 | 5 | 2 |
| Current pricing clarity | 3 | 2 | 4 | 4 |
| Streaming stack proof | 4 | 2 | 5 | 5 |
| **Weighted total / 210** | | **127** | **183** | **156** |

The numerical result supports Option B, but owner willingness to operate infrastructure can override it.

---

# 6. Recommended Infrastructure

## Production components

1. Existing Replit Autoscale website/API — unchanged deployment purpose.
2. Existing PostgreSQL — extended later with Radio metadata.
3. Private persistent object storage — canonical audio masters.
4. External Linux VPS — always-on Liquidsoap, Icecast, sync agent, and local cache.
5. DNS/TLS — future dedicated stream host.
6. External monitoring — probes the public stream independently of both Replit and VPS.
7. Alert delivery — owner-approved email/chat/SMS channel.
8. Backup destinations — database, object-storage versioning, and encrypted configuration backup.

## Initial non-production sizing assumption

For proof-of-concept testing only:

- 1–2 vCPU.
- 1–2 GB RAM.
- 20–40 GB local disk for OS, logs, emergency audio, and bounded playout cache.
- 500 GB or more monthly outbound allowance.
- Ubuntu LTS or another supported stable Linux distribution.

This is not approved production sizing. Load tests must validate:

- Encoding CPU at selected codec/bitrate.
- Concurrent listener connections.
- Network throughput.
- Cache synchronization.
- Failure recovery.
- Silence detection.

---

# 7. Streaming Engine Design

## Liquidsoap responsibilities

- Fetch the active programming snapshot from a local validated manifest.
- Execute deterministic schedule selection.
- Sequence ordered playlists.
- Shuffle playlists with controlled repeat avoidance.
- Reject or skip unavailable files.
- Maintain primary, fallback, and emergency source hierarchy.
- Attach normalized now-playing metadata.
- Emit track-start and track-end events.
- Send the encoded source to Icecast.
- Reconnect after Icecast/network failure using bounded backoff.
- Expose local health/control information only on a private interface or socket.
- Produce structured logs without secrets.

## Manifest pattern

Liquidsoap should not query the production database for every track.

The streaming adapter should periodically:

1. Authenticate to a dedicated internal API.
2. Fetch a versioned programming manifest.
3. Validate schema, version, referenced audio, and checksums.
4. Synchronize approved audio to the local cache.
5. Atomically activate the new manifest.
6. Retain the last known-good manifest.

If the API is unavailable, Liquidsoap continues using the last known-good manifest.

## Source hierarchy

```text
scheduled_source
    └── selected approved playlist
            ↓ unavailable/empty
fallback_source
    └── approved default playlist
            ↓ unavailable/empty
emergency_source
    └── synchronized known-good loop
```

The emergency loop must be present locally and validated during startup.

## Encoding

Preferred initial design:

- One broadly compatible MP3 mount.
- Proposed baseline: 96 kbps.
- Source audio normalized during ingestion, not dynamically altered unpredictably at playback.
- Liquidsoap performs final format consistency and encoding.

Final bitrate/channel settings require owner approval.

---

# 8. Streaming Server Design

## Icecast responsibilities

- Accept one authenticated Liquidsoap source.
- Expose the public listener mount.
- Maintain listener connections.
- Report listener counts and mount status.
- Carry stream metadata.
- Apply connection and source limits.
- Return standard stream responses compatible with browser audio.

## Proposed mount

```text
/surur.mp3
```

Conceptual URL:

```text
https://radio.suruureman.com/surur.mp3
```

No DNS decision or change is made in Phase 1.

## Network boundaries

- Public: HTTPS listener mount only.
- Restricted/private: Icecast admin interface.
- Restricted/private: Liquidsoap control socket.
- Restricted/private: sync agent health.
- Outbound: object storage, Surur-e-Man internal API, monitoring/alerts.
- SSH: key-based access, restricted by firewall/IP where practical.

Icecast admin and source credentials must never reach the browser, public API responses, logs, or Git.

---

# 9. Audio Storage Architecture

## Separation

```text
BINARY AUDIO FILE             DATABASE METADATA
Object storage                PostgreSQL
-------------------------     -------------------------
Immutable bytes               Title
Object key/version            Poet/author
Checksum                      Linked poem
Storage size                  Duration
                              Codec/bitrate/sample rate
                              Channel count
                              Loudness/normalization
                              Rights and approval status
                              Creator/approver
                              Lifecycle timestamps
```

## Canonical storage

- Private object-storage bucket/container.
- Immutable object keys.
- Server-generated upload authorization.
- Short-lived upload URLs or server-coordinated upload sessions.
- No permanent public write access.
- No long-lived credentials in the browser.
- Object versioning or protected archive retention where supported.

## Proposed object key

```text
radio/audio/{audioId}/{version}/{sha256}.{extension}
```

User filenames may be stored as display metadata but must not determine the object key.

## Upload lifecycle

```text
created
  ↓
uploading
  ↓
uploaded
  ↓
quarantined
  ↓ validation/transcode/metadata extraction
processing
  ↓
ready_for_review
  ↓ rights/editorial approval
approved
  ↓
active / archived

Any validation failure → rejected
```

## Proposed initial limits

These are design defaults requiring owner approval:

- Allowed upload containers: MP3 and M4A/AAC.
- Canonical playout format: normalized MP3 or lossless intermediate plus generated MP3 rendition.
- Maximum upload size: 500 MB.
- Maximum duration: 120 minutes.
- Sample rates accepted: 44.1 kHz or 48 kHz.
- Channels accepted: mono or stereo.
- Final output bitrate: selected station bitrate.
- Checksum: SHA-256.
- Filename: informational only.

The upload pipeline must inspect actual file signatures and decoded metadata, not trust extension or browser MIME type.

## Loudness

Store:

- Integrated loudness.
- True peak.
- Normalization target/version.
- Processing status.
- Processed rendition object key.

A target such as EBU R128-derived speech-friendly normalization should be validated with representative Urdu poetry recordings before approval.

## Deletion protection

An approved audio record cannot be hard-deleted while:

- Present in an active playlist.
- Referenced by an active/future schedule.
- Required by emergency/fallback programming.
- Within rights/audit retention.

Normal removal is:

1. Deactivate.
2. Remove from future schedules/playlists.
3. Archive metadata.
4. Retain object through the recovery window.
5. Purge only through an audited developer-only operation.

## Streaming cache

The VPS synchronizes only active, upcoming, fallback, and emergency files. Cache entries are verified by checksum. Cache cleanup must never delete:

- Current track.
- Next queued tracks.
- Active schedule content.
- Fallback content.
- Emergency loop.

---

# 10. Database Design

This section is planning only. No tables or migrations are created.

## 10.1 `radio_audio`

Purpose: canonical editorial and technical record for one audio item.

Important fields:

- `id`
- `title`
- `title_urdu`
- `description`
- `original_filename`
- `object_key`
- `processed_object_key`
- `object_version`
- `sha256`
- `size_bytes`
- `duration_ms`
- `container`
- `codec`
- `bitrate_kbps`
- `sample_rate_hz`
- `channels`
- `integrated_lufs`
- `true_peak_db`
- `normalization_status`
- `processing_status`
- `status`: `draft | uploading | quarantined | processing | ready_for_review | approved | rejected | inactive | archived`
- `rights_status`: `unverified | pending | cleared | restricted | expired | removed`
- `rights_notes`
- `rights_valid_from`
- `rights_valid_until`
- `poet_id` nullable
- `poem_id` nullable
- `created_by_user_id`
- `approved_by_user_id` nullable
- `approved_at` nullable
- `rejected_by_user_id` nullable
- `rejected_at` nullable
- `rejection_reason` nullable
- `archived_at` nullable
- `created_at`
- `updated_at`

Indexes:

- Status and rights status.
- Poet/poem.
- Created/approved timestamps.
- Unique object key/version.
- Unique checksum where deduplication is desired.

Constraints:

- Approved requires `processing_status=ready` and `rights_status=cleared`.
- Duration and size positive.
- Approved codec/sample rate/channel values must be allowed.
- Poet/poem references optional and use safe delete behavior.

Retention:

- Metadata/audit references retained indefinitely or per approved policy.
- Archived binary retention proposed at 90 days minimum.

## 10.2 `radio_playlists`

Purpose: named editorial sequence or pool of approved audio.

Fields:

- `id`
- `name`
- `description`
- `mode`: `sequential | shuffle`
- `status`: `draft | active | inactive | archived`
- `repeat_window`
- `is_default`
- `is_fallback`
- `created_by_user_id`
- `updated_by_user_id`
- `version`
- `created_at`
- `updated_at`
- `archived_at`

Constraints:

- At most one active default playlist.
- At most one active fallback playlist.
- Archived playlists cannot be scheduled.

## 10.3 `radio_playlist_items`

Purpose: ordered membership of audio in playlists.

Fields:

- `id`
- `playlist_id`
- `audio_id`
- `position`
- `weight` for future shuffle weighting
- `enabled`
- `cue_in_ms` nullable
- `cue_out_ms` nullable
- `created_by_user_id`
- `created_at`
- `updated_at`

Indexes/constraints:

- Unique `(playlist_id, position)`.
- Optional unique `(playlist_id, audio_id)` unless repeats are explicitly approved.
- Audio must be approved and rights-cleared before playlist activation.
- Cue values must fit audio duration.

## 10.4 `radio_schedules`

Purpose: deterministic time assignment of a playlist/program.

Fields:

- `id`
- `name`
- `playlist_id`
- `status`: `draft | active | inactive | archived`
- `timezone`: IANA identifier
- `days_of_week`
- `start_local_time`
- `end_local_time`
- `effective_from`
- `effective_until`
- `priority`
- `program_name`
- `version`
- `created_by_user_id`
- `updated_by_user_id`
- `created_at`
- `updated_at`

Indexes:

- Status/effective date.
- Day/start/end.
- Priority.
- Playlist.

Constraints:

- End must resolve after start; overnight schedules represented explicitly.
- Active overlaps at equal priority are rejected.
- Playlist must be active and non-empty.
- Timezone must be valid IANA timezone.

## 10.5 `radio_settings`

Purpose: singleton versioned station configuration without secrets.

Fields:

- `id`
- `station_name`
- `enabled`
- `public_stream_url`
- `public_status_message`
- `default_playlist_id`
- `fallback_playlist_id`
- `emergency_audio_id`
- `schedule_timezone`
- `metadata_poll_seconds`
- `metadata_stale_seconds`
- `configuration_version`
- `updated_by_user_id`
- `updated_at`

No source, provider, storage, or admin credentials may be stored here.

## 10.6 `radio_play_history`

Purpose: append-only evidence of actual playout.

Fields:

- `id` or time-sortable UUID
- `audio_id` nullable for emergency/external content
- `playlist_id` nullable
- `schedule_id` nullable
- `manifest_version`
- `started_at`
- `ended_at` nullable
- `expected_duration_ms`
- `actual_duration_ms` nullable
- `result`: `playing | completed | skipped | failed | interrupted | fallback | emergency`
- `failure_code` nullable
- `metadata`
- `created_at`

Indexes:

- Started time descending.
- Audio, playlist, schedule.
- Result/failure.

Retention:

- Detailed history: proposed 12 months.
- Aggregates may be retained longer.
- Security/audit history follows the main audit policy.

## Relationships

- `radio_audio.poet_id → poets.id` optional.
- `radio_audio.poem_id → poems.id` optional.
- User attribution links to existing users.
- Playlist items link playlists and approved audio.
- Schedules link active playlists.
- Settings link default/fallback/emergency records.
- Play history links actual execution to configured entities.
- All privileged mutations produce entries in the existing audit log with Radio target types.

---

# 11. API Contract Design

Conceptual response envelope for errors:

```json
{
  "message": "Human-readable summary",
  "code": "RADIO_MACHINE_CODE",
  "details": {}
}
```

## Public endpoints

### `GET /api/radio/status`

Purpose: small public availability response.

Authentication: none.

Response:

```json
{
  "enabled": true,
  "state": "online",
  "streamUrl": "https://radio.suruureman.com/surur.mp3",
  "checkedAt": "ISO-8601",
  "statusMessage": null
}
```

Validation/security:

- `streamUrl` comes from approved settings.
- No internal hostnames or credentials.
- Cache for a short period.

Errors:

- Return `state: "unknown"` or `offline` safely if monitoring data is stale.
- Do not fail the entire public site.

### `GET /api/radio/now-playing`

Purpose: current metadata.

Response:

```json
{
  "state": "playing",
  "audio": {
    "id": 123,
    "title": "Title",
    "titleUrdu": "عنوان",
    "poet": { "id": 12, "name": "Poet", "nameUrdu": "شاعر" }
  },
  "program": "Evening Poetry",
  "playlist": { "id": 5, "name": "Evening" },
  "startedAt": "ISO-8601",
  "expectedEndAt": "ISO-8601",
  "next": null,
  "metadataUpdatedAt": "ISO-8601",
  "stale": false
}
```

Rules:

- Do not expose unpublished/private data.
- `next` may be omitted to avoid schedule disclosure.
- Metadata can be stale while audio continues.

### `GET /api/radio/program`

Purpose: current public program and optional upcoming schedule summary.

Query:

- Optional `date`.
- Public range limited.

Response: program names and times only; no internal IDs are required.

## Admin audio endpoints

All require JWT, active privileged account validation, Radio permission checks, CSRF/replay consideration appropriate to bearer-token architecture, rate limits, audit logs, and strict body limits.

### `GET /api/admin/radio/audio`

- Paginated/filterable audio metadata.
- Filters: status, rights status, processing status, poet, search.
- Admin and developer.

### `POST /api/admin/radio/audio/uploads`

- Creates pending metadata and a short-lived upload session.
- Request: display metadata, expected filename, size, MIME type, optional poet/poem.
- Response: audio ID, upload URL/session, expiry, required headers.
- Reject unsupported type, excessive size, invalid references, or insufficient permission.
- Binary bytes do not pass through the normal JSON API when direct object upload is used.

### `POST /api/admin/radio/audio/:id/upload-complete`

- Verifies object existence/size/checksum.
- Moves item to quarantine/processing.
- Idempotent.

### `GET /api/admin/radio/audio/:id`

- Full metadata, validation, rights, usage references, and audit summary.

### `PATCH /api/admin/radio/audio/:id`

- Updates editable metadata using optimistic version checking.
- Does not permit clients to set technical fields or approval attribution directly.

### `POST /api/admin/radio/audio/:id/approve`

- Admin/developer with approval permission.
- Requires processing success and rights clearance.
- Optional approval note.

### `POST /api/admin/radio/audio/:id/reject`

- Requires reason.
- Removes eligibility from active programming.

### `POST /api/admin/radio/audio/:id/archive`

- Checks active playlist/schedule/fallback dependencies.
- Returns conflict with dependency list if protected.

### `DELETE /api/admin/radio/audio/:id`

- Developer-only purge.
- Requires archived status, elapsed retention, no dependencies, and explicit confirmation.

## Playlist endpoints

### `GET /api/admin/radio/playlists`
### `POST /api/admin/radio/playlists`
### `GET /api/admin/radio/playlists/:id`
### `PATCH /api/admin/radio/playlists/:id`
### `POST /api/admin/radio/playlists/:id/items`
### `PATCH /api/admin/radio/playlists/:id/items/reorder`
### `DELETE /api/admin/radio/playlists/:id/items/:itemId`
### `POST /api/admin/radio/playlists/:id/activate`
### `POST /api/admin/radio/playlists/:id/deactivate`
### `POST /api/admin/radio/playlists/:id/archive`

Validation:

- Approved/rights-cleared audio only for activation.
- Non-empty for activation.
- Positions unique.
- Optimistic version required on mutation.
- Default/fallback uniqueness enforced transactionally.

Errors:

- `404` not found.
- `409` version/dependency/activation conflict.
- `422` invalid playlist composition.

## Schedule endpoints

### `GET /api/admin/radio/schedules`
### `POST /api/admin/radio/schedules`
### `GET /api/admin/radio/schedules/:id`
### `PATCH /api/admin/radio/schedules/:id`
### `POST /api/admin/radio/schedules/:id/activate`
### `POST /api/admin/radio/schedules/:id/deactivate`
### `DELETE /api/admin/radio/schedules/:id`
### `POST /api/admin/radio/schedules/validate`
### `GET /api/admin/radio/schedules/effective?at=...`

Validation:

- IANA timezone.
- Valid day/time/effective range.
- Playlist active and eligible.
- No equal-priority ambiguity.
- Preview endpoint returns deterministic winner and fallback.

## Settings/operations endpoints

### `GET /api/admin/radio/settings`
### `PATCH /api/admin/radio/settings`

- Settings contain no secrets.
- Developer controls infrastructure-sensitive settings.
- Admin may update approved editorial settings only.

### `GET /api/admin/radio/operations/status`

Returns sanitized:

- Manifest version.
- Last sync.
- Engine heartbeat age.
- Icecast mount status.
- Metadata freshness.
- Cache readiness.
- Current fallback level.
- Recent sanitized errors.

### `POST /api/admin/radio/operations/refresh-manifest`

- Developer or scoped operator permission.
- Queues/requests refresh; does not execute arbitrary commands.
- Idempotency key required.

### `POST /api/admin/radio/operations/emergency`

Request:

```json
{
  "action": "activate",
  "reason": "Required audited reason",
  "expectedVersion": 12
}
```

- Developer by default.
- Short-lived/recent authentication recommended.
- Audit event mandatory.
- Cannot expose shell or provider credentials.

### `GET /api/admin/radio/history`

- Paginated playback history.
- Filters by date, result, audio, playlist, schedule.
- Retention-enforced.

## Internal streaming-adapter endpoints

Not public:

### `GET /api/internal/radio/manifest`

- Machine authentication.
- Conditional request by version/ETag.
- Returns only approved, active, time-relevant programming and signed/download references.

### `POST /api/internal/radio/events`

- Receives track start/end/failure, fallback transitions, and heartbeats.
- Signed request or mTLS.
- Timestamp, nonce/idempotency key, narrow clock-skew window.
- Rate limited.

### `POST /api/internal/radio/cache-report`

- Reports local availability/checksum for required assets.
- No filesystem paths returned publicly.

Internal endpoints should use a separate authentication mechanism from human JWTs.

---

# 12. Playlist Architecture

## Modes

### Sequential

- Sort by explicit integer position.
- Resume policy is configurable: continue from persisted cursor or restart at first item.
- Proposed default: continue from last successful item for the active playlist version.

### Shuffle

- Shuffle eligible items.
- Enforce configurable repeat window.
- Persist or deterministically seed cycle state so restarts do not immediately repeat content.
- Manual weights are future-compatible but not required for launch.

## Eligibility

An item is playable only when:

- Audio status is approved.
- Rights status is cleared and within validity dates.
- Processing status is ready.
- Processed object and local cached file validate.
- Item is enabled.
- Cue boundaries are valid.

## Editing and activation

- Draft edits do not affect the active manifest until published.
- Activation creates a new immutable playlist version.
- Active playout completes or transitions according to an approved cutover policy.
- Proposed default: do not interrupt the current track; use the new version on the next item.

## Empty playlist behavior

- Draft empty playlist: allowed.
- Activation of empty playlist: rejected.
- Runtime empty/ineligible playlist: move to fallback playlist.
- Empty fallback: move to emergency loop and page the operator.

---

# 13. Scheduling Architecture

## Timezone

- Store an IANA timezone, not a fixed UTC offset.
- Proposed station timezone: `Asia/Dubai`, subject to owner approval.
- Persist timestamps in UTC.
- Evaluate recurring local schedules using the configured IANA timezone.

## Schedule selection algorithm

At each transition:

1. Select active schedules whose effective date and local day/time include now.
2. Exclude schedules with inactive/ineligible playlists.
3. Sort by priority descending.
4. If one highest-priority schedule exists, select it.
5. If multiple highest-priority schedules overlap, treat configuration as invalid; do not guess.
6. Use active default playlist when no schedule matches.
7. Use fallback playlist if default is unavailable.
8. Use emergency loop if fallback is unavailable.

## Priority proposal

- 1000: emergency override.
- 500–899: special event.
- 100–499: regular programming.
- 0: default schedule.

Actual allowed ranges require approval.

## Overnight schedules

A schedule whose end time is earlier than start time spans midnight and must be normalized into deterministic intervals during validation.

## Changes

- Schedule changes are versioned.
- API validation previews conflicts before activation.
- Streaming adapter receives a new manifest atomically.
- Current track continues unless an emergency override explicitly interrupts it.

---

# 14. Now Playing Architecture

## Source of truth

The streaming engine is the source of truth for **actual current playout**. The database schedule is the source of truth for intended programming.

Liquidsoap emits:

- Track start.
- Track completion.
- Track failure/skip.
- Fallback transition.
- Emergency transition.
- Heartbeat.

The API records these events in play history and maintains a small current-state projection.

## Update flow

```text
Liquidsoap starts item
    ↓ signed event
Internal API
    ↓
play history + current state
    ↓
GET /api/radio/now-playing
    ↓ every 15–30 seconds
Browser player
```

## Polling versus realtime

Recommended launch design: HTTP polling.

- Poll every 15 seconds while playing and page visible.
- Poll every 30 seconds while paused or backgrounded.
- Use cache validators where possible.
- Mark stale after 90 seconds.
- Do not stop audio because metadata is stale.

SSE may be introduced later if polling load or timeliness justifies it. WebSockets are unnecessary for launch.

## Failure behavior

- Metadata unavailable: player continues stream and displays “Live Radio”.
- Metadata stale: retain last known item with a stale indicator or remove timing.
- Track event delayed: use stream metadata as a display fallback when safe.
- Database/API unavailable: streaming continues from the last known-good manifest.

---

# 15. Public Player Architecture

## Launch scope

- Dedicated `/radio` page.
- Play/pause.
- Volume and mute.
- Live/connecting/offline status.
- Now-playing title and Urdu title where present.
- Poet/author.
- Current program.
- Accessible status text.
- Mobile, tablet, and desktop responsive layout.

## Player state

```text
idle
  → loading
  → playing
  → paused
  → reconnecting
  → unavailable
```

## Browser behavior

- Playback starts only after user interaction due to autoplay restrictions.
- Use native HTML audio through a controlled React service/hook.
- Stream URL comes from `/api/radio/status`, not a secret or build-time hardcode.
- HTTPS page requires HTTPS audio to avoid mixed content.
- Volume is stored locally; no user account required.
- Media Session API may provide lock-screen metadata where supported.

## Reconnection

- On transient failure: retry with exponential backoff and jitter.
- Example delays: 2, 5, 10, 20, then 30 seconds capped.
- Stop automatic retries after an extended threshold and show explicit retry.
- Append a cache-busting token only when needed to force live-edge reconnection.
- Never create duplicate audio elements/connections.

## Page-level versus persistent player

Recommended launch: **page-level `/radio` player**.

Reason:

- Lower implementation and state complexity.
- Clear user expectation.
- Easier accessibility and mobile testing.
- Avoids route-transition and duplicate playback risks.

A persistent global mini-player can be a later approved enhancement if continuous playback during navigation is a requirement.

---

# 16. Domain and URL Architecture

Recommended conceptual structure:

```text
Public Radio page
https://suruureman.com/radio

Public metadata
https://suruureman.com/api/radio/status
https://suruureman.com/api/radio/now-playing
https://suruureman.com/api/radio/program

Admin control plane
https://suruureman.com/api/admin/radio/...

Listener stream
https://radio.suruureman.com/surur.mp3
```

Why a dedicated stream subdomain:

- Streaming can move providers without changing the website route.
- Separates stream TLS, caching, monitoring, and incident handling.
- Makes provider migration possible through DNS.
- Avoids proxying audio through the website/API.

DNS TTL should be lowered before a planned provider migration and restored afterward. No DNS or SSL change occurs in Phase 1.

---

# 17. Capacity and Bandwidth Model

## Formula

For continuous listening:

```text
monthly decimal GB
≈ bitrate_kbps × average_concurrent_listeners × 0.324
```

This excludes protocol/TLS overhead. Add at least 5–10% planning margin.

More precise usage:

```text
GB = bitrate_kbps × 1000 / 8
     × listening_seconds
     / 1,000,000,000
```

## Continuous-listener examples

| Average concurrent listeners | 64 kbps | 96 kbps | 128 kbps |
|---:|---:|---:|---:|
| 10 | 207 GB/mo | 311 GB/mo | 415 GB/mo |
| 25 | 518 GB/mo | 778 GB/mo | 1.04 TB/mo |
| 50 | 1.04 TB/mo | 1.56 TB/mo | 2.07 TB/mo |
| 100 | 2.07 TB/mo | 3.11 TB/mo | 4.15 TB/mo |
| 250 | 5.18 TB/mo | 7.78 TB/mo | 10.37 TB/mo |
| 500 | 10.37 TB/mo | 15.55 TB/mo | 20.74 TB/mo |

## Session-based example

If 5,000 monthly sessions average 30 minutes at 96 kbps:

```text
96,000 bits/sec ÷ 8 × 1,800 sec × 5,000
≈ 108 GB/month before overhead
```

## Capacity tiers

| Tier | Peak concurrent | Suggested design target | Notes |
|---|---:|---:|---|
| Pilot | 25 | 50 | Internal/soft launch |
| Launch | 100 | 200 | Requires measured average session data |
| Growth | 500 | 750 | Consider managed delivery or relay architecture |
| Large | 1,000+ | Provider/CDN design | Do not rely on one small VPS |

These are examples, not owner requirements.

### OPEN DECISION — OWNER INPUT REQUIRED

- Initial peak listeners.
- Expected average listeners.
- Average session duration.
- 12-month growth target.
- Primary audience geography.
- Monthly infrastructure budget.
- Required uptime.

---

# 18. Audio Quality Recommendation

| Option | Voice/poetry quality | Bandwidth | Compatibility | Use case |
|---|---|---|---|---|
| 64 kbps mono MP3/AAC | Good speech, limited music ambience | Lowest | Broad | Bandwidth-sensitive spoken-word launch |
| 96 kbps MP3 | Good balance for voice and light musical material | Medium | Excellent | Recommended initial baseline |
| 128 kbps stereo MP3 | Better music/ambience | Highest | Excellent | Mixed music/poetry where quality justifies cost |

## Provisional recommendation

- **96 kbps MP3**
- 44.1 kHz
- Stereo only when source material benefits; otherwise encoded mono can reduce waste
- One stream rendition for initial launch

Why:

- Broad browser/device compatibility.
- Good intelligibility for poetry and spoken word.
- Better ambience than 64 kbps.
- 25% less bandwidth than 128 kbps.

This is not final until representative recordings and listener-cost targets are approved.

---

# 19. Failure and Fallback Architecture

## Hierarchy

```text
PRIMARY
Scheduled approved playlist
      ↓ unavailable / invalid / empty
FALLBACK
Approved default fallback playlist
      ↓ unavailable / invalid / empty
EMERGENCY
Known-good local emergency loop
```

## Expected behavior

| Failure | Required behavior |
|---|---|
| Missing scheduled file | Skip, record failure, continue next eligible item |
| Invalid/corrupt audio | Quarantine/deactivate, skip, alert content operator |
| Empty playlist | Use fallback; reject empty activation in admin |
| Object storage unavailable | Continue from local cache and last known-good manifest |
| API/database unavailable | Continue current/local programming; queue events locally |
| Liquidsoap crash | Service supervisor restarts; emergency source must initialize first |
| Icecast crash | Supervisor restarts; Liquidsoap reconnects with bounded backoff |
| Source connection lost | Icecast marks source unavailable; external monitor pages operator |
| Network failure | Continue local generation, reconnect when route recovers |
| Schedule invalid | Refuse manifest activation; retain previous valid manifest |
| Metadata failure | Audio continues; player shows generic Live Radio/stale state |
| Cache too small | Protect active/next/fallback/emergency, stop prefetch, alert |

## Silence prevention

- Emergency audio must be local, checksum-verified, and infallible.
- Blank/silence detection must alert independently of HTTP mount availability.
- A technically “online” mount producing silence is an incident.

---

# 20. Monitoring Architecture

## Monitoring matrix

| Signal | Frequency | Warning | Critical/page |
|---|---:|---|---|
| Website HTTPS | 60 sec | 2 failures | 5 min unavailable |
| Public API health | 60 sec | 2 failures | 5 min unavailable |
| Stream mount HTTP/audio | 30 sec | 1 failure | 2 consecutive failures / 60 sec |
| Audible signal/silence | 15 sec | 30 sec silence | 60 sec silence |
| Liquidsoap heartbeat | 15 sec | 30 sec late | 60 sec late |
| Icecast source connected | 15 sec | 30 sec down | 60 sec down |
| Metadata freshness | 30 sec | 90 sec old | 5 min old |
| Manifest sync | 60 sec | 5 min late | 15 min late or rejected |
| Schedule evaluation | Every transition | One failure | Fallback/emergency activation |
| Storage read | Every sync/read | Retry event | Required fallback asset unavailable |
| CPU | 60 sec | >80% for 10 min | >90% for 5 min |
| Memory | 60 sec | >80% for 10 min | >90% or OOM risk |
| Disk/cache | 5 min | >80% | >90% |
| Network/egress | 5 min | >80% planned | >90% planned |
| Listener count | 60 sec | >80% tested peak | >90% tested peak |
| Certificate expiry | Daily | <30 days | <7 days |

## Alert recipients

Proposed:

- Primary: streaming operator/on-call developer.
- Escalation after 15 minutes: project developer/owner.
- Editorial/rights failures: Radio admin/content owner.
- Daily summary: developer and approved admin.

**OPEN DECISION — OWNER INPUT REQUIRED:** exact people and channels.

## Observability

- Structured logs with event IDs and manifest versions.
- No credentials, signed URLs, tokens, or sensitive object keys in public logs.
- Correlate API manifest version, Liquidsoap active version, and playback event.
- Retain operational logs according to provider/storage cost and incident needs.

---

# 21. Backup and Disaster Recovery

## Proposed objectives

| Data | RPO | RTO | Retention |
|---|---:|---:|---:|
| PostgreSQL Radio metadata | 1 hour target with PITR; 24h minimum fallback | 4 hours | 30 days minimum |
| Audio object storage | Near-zero for committed objects with versioning | 8 hours | Deleted versions 90 days |
| Playlist/schedule/settings | Same as PostgreSQL | 4 hours | 30 days/PITR |
| Streaming config/manifest | 24 hours, plus version control | 2 hours | 90 days |
| Local playout cache | No backup; reproducible | 4 hours to refill | Not applicable |
| Secrets | Re-provisioning runbook, not plaintext backup | 4 hours | Provider-managed versions where supported |

These targets require owner approval and provider capability validation.

## Procedures

- Daily logical PostgreSQL backup in addition to managed recovery where available.
- Object-storage versioning and lifecycle retention.
- Daily inventory/checksum report for approved active audio.
- Encrypted/versioned non-secret streaming configuration.
- Separate secure record of required secret names and rotation procedure.
- Quarterly restoration test.
- Annual full streaming disaster exercise or after major architecture changes.

## Disaster scenarios

- Accidental metadata deletion.
- Audio object deletion/corruption.
- VPS loss.
- Provider outage.
- Credential compromise.
- Database region failure.
- DNS/TLS failure.
- Bad manifest/config deployment.

For VPS loss, provision replacement from documented automation/config, restore emergency audio, sync active cache, connect source, validate privately, then update stream endpoint/DNS if required.

---

# 22. Security Architecture

## Trust zones

1. Public browser.
2. Public website/API.
3. Privileged admin API.
4. Internal streaming adapter.
5. Private object storage.
6. Streaming VPS.
7. Icecast public listener mount.
8. Monitoring/alert providers.

## Mandatory prerequisites from Phase 0

Before privileged Radio implementation:

1. Rotate source-exposed bootstrap credentials and redesign initialization.
2. Remove predictable JWT fallback; fail closed when secret is absent.
3. Apply active-account/token-revocation validation to privileged users.
4. Define allowlisted CORS policy.
5. Add endpoint-specific rate limits.
6. Add explicit JSON and upload size limits.
7. Add appropriate security headers.
8. Expand health/readiness semantics.

These are not fixed in Phase 1.

## Human access

- Developer: full Radio control.
- Admin: scoped editorial operations only.
- Contributor: no Radio access.
- Sensitive emergency/infrastructure actions require recent authentication or step-up verification.
- All mutations are audited.
- Optimistic version checks prevent accidental overwrites.

## Machine access

- Streaming adapter uses a dedicated machine identity.
- Do not reuse human JWTs.
- Prefer mTLS or short-lived signed requests.
- If HMAC is used: sign method, path, body hash, timestamp, nonce; reject replay and excessive clock skew.
- Credentials have narrow scope and rotation procedure.

## Object storage

- Private by default.
- Browser uploads use short-lived scoped authorization.
- Streaming downloads use short-lived signed access or private machine credentials.
- No list-all permission unless required.
- Separate upload/quarantine and approved prefixes or logical policies.

## Upload processing

- Validate file signature and decode in an isolated worker/process.
- Reject malformed media.
- Enforce duration, size, codec, sample rate, and channel limits.
- Compute checksum.
- Extract metadata without trusting embedded tags.
- Strip or sanitize unneeded metadata.
- Keep quarantined audio unavailable to public/streaming identities.

## Streaming credentials

- Icecast source and admin credentials remain only on server-side secret storage.
- Separate source and admin credentials.
- Rotate on compromise and scheduled cadence.
- Public listener mount requires no management credential.
- Liquidsoap control interface is not public.

---

# 23. Roles and Permissions

Fine-grained permissions are technically preferable to using role names alone.

## Developer

- View/manage all Radio records.
- Manage station settings.
- Configure stream URL references.
- Trigger manifest refresh.
- Activate/deactivate emergency mode.
- View operational status and detailed failures.
- Purge archived audio after retention.
- Manage role permissions.
- No endpoint reveals raw credentials.

## Admin

Proposed approved scope:

- Create/upload/edit audio metadata.
- Record rights evidence/status.
- Approve/reject audio if assigned approval permission.
- Manage playlists.
- Manage regular schedules.
- View playback history and sanitized operational status.
- Cannot manage infrastructure credentials.
- Cannot purge protected audio.
- Cannot change machine identities.
- Cannot execute arbitrary server commands.
- Emergency activation only if explicitly granted.

## Contributor

**NO Radio administration by default.**

No upload, playlist, schedule, settings, operational, or history access.

## Permission names for future design

- `radio.audio.read`
- `radio.audio.create`
- `radio.audio.approve`
- `radio.audio.archive`
- `radio.audio.purge`
- `radio.playlists.manage`
- `radio.schedules.manage`
- `radio.settings.manage`
- `radio.operations.read`
- `radio.operations.control`
- `radio.emergency.control`
- `radio.history.read`

Role-to-permission mapping may begin in code/config and later move to a permission table if needed.

---

# 24. Content and Rights Control

Only owner-approved, rights-cleared audio may be broadcast.

Technical requirements:

- Rights status is separate from editorial status.
- Approval records actor and time.
- Rights validity dates can automatically make content ineligible.
- Active manifests exclude expired/restricted/removed audio.
- Takedown deactivates future playout and triggers manifest refresh.
- Current playback interruption behavior must be owner-defined for urgent takedowns.
- Audit history records uploads, metadata edits, rights changes, approvals, playlist use, schedules, archive, and purge.
- Scheduled-content protection prevents deletion while referenced.
- Object retention allows recovery after accidental removal.

This design does not create a licensing platform. Legal authority and evidence requirements are owner responsibilities.

---

# 25. Cost Framework

## Categories

### Existing website/API

- Existing Replit Autoscale cost continues.
- Radio metadata/player requests add modest web traffic compared with audio.
- Exact incremental cost depends on request volume.

### Streaming VPS

- Base compute.
- Included outbound transfer.
- Transfer overage.
- Snapshot/backups.
- Optional managed support.

Verified example only:

- DigitalOcean basic Droplets publicly start at US$4/month.
- Included transfer starts at 500 GiB/month.
- Additional outbound transfer is documented at US$0.01/GiB.

The final plan must include enough RAM/CPU and transfer. The cheapest advertised plan is not automatically suitable.

### Object storage

- Stored master and processed audio.
- Upload/API requests.
- Retrieval/egress to VPS.
- Versioned/deleted-object retention.
- Inventory and backup.

**UNKNOWN / REQUIRES CURRENT PROVIDER PRICING**

### Monitoring

- External uptime/audio probes.
- Log retention.
- Alert delivery.
- Optional silence-detection service.

**UNKNOWN / REQUIRES CURRENT PROVIDER PRICING**

### Domain/TLS

- Existing domain may support a subdomain without a separate registration.
- TLS can use provider-managed certificates or ACME.
- DNS/provider fees depend on current account.

### Managed provider alternative

Verified example:

- Radio.co Lite publicly listed US$35/month billed annually, 2 GB storage, 500 concurrent listeners, 18,000 listening hours, and up to 192 kbps during research.

**PRICE REQUIRES CURRENT PROVIDER QUOTE**

## Example VPS transfer overage

At a documented US$0.01/GiB:

- 1 TB beyond allowance ≈ US$10.24.
- 3 TB beyond allowance ≈ US$30.72.
- 10 TB beyond allowance ≈ US$102.40.

This excludes compute, storage, monitoring, taxes, protocol overhead, and provider policy changes.

## Required owner budget inputs

- Monthly base infrastructure ceiling.
- Acceptable bandwidth overage.
- Managed support requirement.
- Backup/monitoring budget.
- Growth reserve.

---

# 26. Implementation Dependency Map

```text
OWNER ARCHITECTURE APPROVAL
        ↓
SECURITY PREREQUISITES
        ↓
PROVIDER + OPERATOR + BUDGET APPROVAL
        ↓
PERSISTENT AUDIO STORAGE
        ↓
SECURE UPLOAD / PROCESSING PIPELINE
        ↓
RADIO DATABASE SCHEMA + MIGRATION PLAN
        ↓
RADIO API CONTRACTS
        ↓
ADMIN AUDIO LIBRARY + RIGHTS APPROVAL
        ↓
PLAYLISTS
        ↓
DETERMINISTIC SCHEDULING
        ↓
SEPARATE STREAMING VPS
        ↓
LIQUIDSOAP + ICECAST + LOCAL CACHE
        ↓
NOW PLAYING + PLAY HISTORY
        ↓
PUBLIC /RADIO PLAYER
        ↓
FALLBACK + MONITORING + ALERTS
        ↓
BACKUP / RESTORE / ROLLBACK TEST
        ↓
LOAD + RESILIENCE + SECURITY TESTING
        ↓
STAGED PRODUCTION RELEASE
```

Parallel work after prerequisites:

- Public player design can proceed against mocked contracts.
- VPS automation can proceed in a non-production environment.
- Monitoring design can be configured against test endpoints.

Production cutover remains dependent on end-to-end validation.

---

# 27. Production Topology and Flows

## Audio flow

```text
Admin browser
  → short-lived authorized upload
  → private object storage quarantine
  → validation/processing
  → approved processed object
  → streaming sync agent
  → checksum-verified VPS cache
  → Liquidsoap
  → Icecast
  → listener browser
```

## Metadata flow

```text
Liquidsoap track event
  → authenticated internal API
  → play history/current state in PostgreSQL
  → public now-playing API
  → Radio player
```

## Control flow

```text
Developer/Admin
  → JWT + scoped permission
  → Radio admin API
  → PostgreSQL versioned state
  → manifest generation
  → authenticated streaming adapter fetch
  → atomic local manifest activation
```

## Failure isolation

- Existing public pages do not call Radio APIs unless the Radio UI is mounted.
- Radio API failures return isolated unavailable states.
- Express never waits on the stream for core content requests.
- Streaming uses last known-good local state when website/API is unavailable.
- Icecast receives audio directly from Liquidsoap.
- Listeners receive audio directly from Icecast.

---

# 28. Rollback Strategy

Radio must be independently disableable.

## Application rollback

- Feature flag hides `/radio` navigation and disables player initialization.
- Public Radio endpoints return disabled/unavailable without affecting other APIs.
- Admin Radio navigation is hidden while records remain intact.
- Existing poetry/admin/contributor routes continue.

## Streaming rollback

- Keep prior versioned Liquidsoap/Icecast config.
- Keep prior known-good manifest.
- Roll back service version/config independently.
- Emergency loop remains available during rollback.
- Stream DNS is changed only through an approved incident procedure.

## Database rollback

- Incident rollback must not drop Radio tables or delete records.
- Disable feature usage and deploy prior compatible application version.
- Schema rollback occurs only through a separately reviewed migration procedure.

## Provider rollback/migration

- Canonical metadata and audio remain outside a managed streaming provider.
- Provider adapter can be disabled.
- Dedicated stream subdomain can point to replacement service after validation.

## Kill switch

Proposed station setting:

```text
radio.enabled = false
```

Effects:

- Player reports unavailable.
- New manifests are not activated.
- Streaming shutdown is controlled separately to allow a graceful message or emergency loop.

---

# 29. Risks

| Risk | Severity | Mitigation |
|---|---:|---|
| No infrastructure operator | Critical | Select managed provider or assign trained operator |
| Underestimated bandwidth | Critical | Approve capacity model; alerts at 80/90%; scalable plan |
| Single VPS failure | High | Rebuild automation, snapshots, external monitor, tested RTO; future standby/relay |
| Object storage outage | High | Local active/fallback/emergency cache |
| Source credential compromise | Critical | Secret manager, narrow scope, rotation, no browser exposure |
| Existing bootstrap/JWT issues | Critical | Security prerequisites before Radio controls |
| Invalid/malicious upload | High | Quarantine, decode validation, strict limits, isolated processing |
| Rights violation | High | Rights clearance gate, takedown workflow, audit |
| Schedule ambiguity | High | Reject equal-priority overlap; deterministic preview |
| Dead air | Critical | Three-level fallback, local emergency loop, silence detection |
| Metadata drift | Medium | Engine events as actual source; stale thresholds |
| Website-stream coupling | Critical | Separate streaming plane and direct listener delivery |
| Provider lock-in | Medium | Canonical internal model, object storage, provider adapter |
| Admin token remains valid after disable | High | Privileged revocation prerequisite |
| Cost growth | High | Usage monitoring and budget alerts |
| Disaster recovery untested | High | Quarterly restores and pre-launch exercise |
| One rendition excludes constrained users | Medium | Measure demand; consider later low-bitrate mount |
| Public player browser differences | Medium | Browser/device matrix and real stream testing |

---

# 30. Open Decisions

## Mandatory owner approvals

1. Approve external VPS + Liquidsoap + Icecast, or choose managed provider.
2. Name the infrastructure/incident operator.
3. Approve monthly budget and overage policy.
4. Provide launch and 12-month listener estimates.
5. Approve proposed 96 kbps MP3 baseline or another format.
6. Approve object-storage provider.
7. Approve `radio.suruureman.com` as conceptual stream host.
8. Approve `Asia/Dubai` as station schedule timezone.
9. Approve page-level player for launch.
10. Approve developer/admin permissions and emergency authority.
11. Confirm contributors have no Radio access.
12. Approve upload size/duration/formats.
13. Approve loudness/normalization target after sample testing.
14. Approve fallback and emergency content.
15. Name monitoring recipients and channels.
16. Approve RPO/RTO and retention.
17. Define content-rights evidence and takedown authority.
18. Approve playback-history retention.
19. Approve whether a single VPS is sufficient for launch.
20. Approve the Phase 0 security remediation as a prerequisite.

## Pricing decisions

- Replit Reserved VM: **PRICE REQUIRES CURRENT REPLIT ACCOUNT QUOTE**
- Selected VPS: **PRICE REQUIRES CURRENT PROVIDER QUOTE**
- Object storage: **PRICE REQUIRES CURRENT PROVIDER QUOTE**
- Managed Radio: **PRICE REQUIRES CURRENT PROVIDER QUOTE**
- Monitoring/alerts: **PRICE REQUIRES CURRENT PROVIDER QUOTE**

---

# 31. Final Recommendation

Approve the following architecture direction:

1. Preserve the existing production Replit Autoscale website/API.
2. Add future Radio UI, metadata, editorial administration, schedules, and history to the existing application.
3. Use PostgreSQL for Radio metadata and state.
4. Use private persistent object storage for audio.
5. Use a separate external VPS with a checksum-verified local playout cache.
6. Use Liquidsoap for automation and fallback.
7. Use Icecast for listener delivery.
8. Use a dedicated HTTPS stream subdomain.
9. Keep the browser connected directly to Icecast, not Express.
10. Use an authenticated adapter/manifest boundary between the website and streaming VPS.
11. Keep contributor Radio access disabled.
12. Complete security prerequisites before exposing privileged Radio controls.
13. Validate the architecture in a non-production proof of concept before procurement or production cutover.

If the owner cannot assign ongoing infrastructure operations, replace items 5–7 with a managed provider that passes a documented API/feature evaluation. Keep the internal database, object storage, and provider-adapter boundaries so the provider is not the sole source of truth.

---

# 32. Phase 2 Readiness

## Status

**NOT READY — DECISIONS REQUIRED**

Phase 2 may begin only after:

- Infrastructure option is approved.
- Operator is assigned.
- Capacity and budget are approved.
- Audio quality is approved.
- Storage provider is approved.
- Domain direction is approved.
- Permission model is approved.
- Monitoring/fallback/backup targets are approved.
- Content-rights controls are approved.
- Security prerequisites are accepted as required work.

Phase 2 should be scoped as prerequisites and non-production foundations, not an immediate production stream launch.

---

# 33. What Was Changed

The only workspace addition from Phase 1 is this architecture document.

Explicit confirmation:

- No production code changed.
- No Radio code was implemented.
- No database migration was performed.
- No Radio tables were created.
- No Radio API was created.
- No streaming server was installed.
- No Liquidsoap was installed.
- No Icecast was installed.
- No audio was uploaded.
- No DNS was changed.
- No SSL was changed.
- No infrastructure was purchased.
- No production deployment configuration was changed.
- No existing roles were changed.
- No contributor permissions were changed.
- No secret was created or exposed.
- No production data was modified.

---

# 34. Decision Record

| Decision | Phase 1 recommendation | Status |
|---|---|---|
| Website/stream separation | Mandatory | Recommended, owner approval required |
| Streaming location | External VPS | Open approval |
| Automation | Liquidsoap | Open approval |
| Listener server | Icecast | Open approval |
| Canonical audio storage | Private object storage | Open provider selection |
| Playout resilience | Local verified cache | Recommended |
| Metadata source | Liquidsoap actual-play events | Recommended |
| Public metadata transport | HTTP polling at launch | Recommended |
| Public player | Page-level `/radio` at launch | Open approval |
| Stream URL | `radio.suruureman.com/surur.mp3` | Conceptual; open approval |
| Quality | 96 kbps MP3 baseline | Open approval |
| Timezone | `Asia/Dubai` | Open approval |
| Contributor access | None | Recommended |
| Phase 2 | Blocked pending decisions | Not ready |

---

# 35. Evidence and Research Sources

## Project sources

- `docs/Surur-e-Man-Web-Radio-Phase-0-Technical-Audit.md`
- Existing Surur-e-Man repository, branch, deployment metadata, frontend, API, Drizzle schema, authentication, admin, contributor, storage, and build/deployment configuration inspected during Phase 0

## Replit references

- Deployment types: https://docs.replit.com/features/publishing/deployment-types
- Publishing costs: https://docs.replit.com/billing/deployment-pricing
- Machine configuration: https://docs.replit.com/features/publishing/machine-configuration
- App Storage: https://docs.replit.com/features/data-and-storage/object-storage
- Ports: https://docs.replit.com/features/project-setup/ports
- Monitoring: https://docs.replit.com/features/publishing/monitoring-a-deployment

## Streaming references

- Liquidsoap documentation: https://www.liquidsoap.info/doc-dev/
- Liquidsoap source/fallback concepts: https://www.liquidsoap.info/doc-dev/sources
- Icecast documentation: https://icecast.org/docs/
- Icecast admin/mount metadata interface: https://icecast.org/docs/icecast-2.4.1/admin-interface.html

## Pricing references checked on 8 September 2026

- DigitalOcean Droplet pricing: https://www.digitalocean.com/pricing/droplets/
- DigitalOcean Droplet pricing documentation: https://docs.digitalocean.com/products/droplets/details/pricing
- DigitalOcean bandwidth billing: https://docs.digitalocean.com/platform/billing/bandwidth/
- Radio.co plans: https://www.radio.co/pricing

Prices and plan limits are time-sensitive. Revalidate all pricing immediately before procurement.

---

# Phase 1 Result

**Recommended architecture:** Existing Replit Autoscale control plane + private object storage + separate external VPS with Liquidsoap/Icecast and local playout cache.

**Final status:** **NOT READY — DECISIONS REQUIRED**

**Next action:** Owner reviews and approves the mandatory decisions in Section 30. Only then should Phase 2 be scoped.
