# PHASE 6 — RADIO INFRASTRUCTURE PREPARATION & INTEGRATION READINESS COMPLETION REPORT

## 1. Executive Summary

- Status: **READY WITH CONDITIONS**
- Prepared:
  - A provider-neutral website-to-runtime integration boundary.
  - A future stream, Now Playing, playlist, schedule, emergency, storage, and machine-authentication contract.
  - A local AzuraCast/Liquidsoap/Icecast integration plan without installing or configuring any runtime.
  - A client Radio PC readiness handoff checklist.
  - A future environment-variable contract without adding values, placeholders, or secrets.
  - Minimum observability and failure/recovery requirements.
- Verified:
  - The existing website already exposes a provider-neutral public status read model.
  - The public status endpoint remains offline-safe and does not infer live state from a hostname.
  - The existing machine-authenticated internal boundary is fail-closed when machine credentials are absent.
  - The existing manifest, playback-event, cache-report, and storage abstractions were inspected.
  - Existing Radio tables are present and contain no development records requiring migration or cleanup.
  - No real provider, storage backend, public stream, or client machine was touched.
- Remaining:
  - Final provider/runtime selection.
  - Client PC, Windows, network, audio, and capacity audit.
  - Safe staging machine credentials and shared replay protection if the future deployment is multi-instance.
  - Schedule overlap decision: reject, warn, or allow.
  - A concrete provider adapter and runtime integration after owner approval.
- Blocked:
  - The client Radio PC is unavailable.
  - No infrastructure audit can be truthfully completed until the client provides the PC and network environment.
  - No live stream or runtime execution can be validated in this phase.

## 2. Website ↔ Runtime Integration Boundary

- Existing website inputs:
  - `radio_settings` stores the provider-neutral editorial/public settings currently used by the website.
  - Approved Radio audio records carry editorial status, processing status, rights status, object references, checksums, and media metadata.
  - Playlists carry status, mode, repeat window, ordered items, weights, enabled flags, cue values, and attribution.
  - Schedules carry playlist, status, timezone, days, local times, effective dates, priority, and program metadata.
  - Emergency state stores editorial intent such as enabled/type/audio/message and explicitly reports `broadcastExecution: "not_available"`.
  - `radio_manifests` provides a versioned, hashed payload foundation for a future runtime pull.
- Future runtime inputs:
  - Eventually, a signed machine request may read the latest active manifest through `GET /api/internal/radio/manifest`.
  - The manifest may contain the active playlist/schedule decision, approved media references, fallback reference, and emergency audio reference.
  - Object keys are internal references only; a future storage adapter must provide the runtime with controlled media access rather than exposing storage credentials or private URLs to browsers.
  - No runtime is currently authorized or configured to consume these records.
- Future runtime outputs:
  - The existing authenticated internal boundary accepts playback events through `POST /api/internal/radio/events`.
  - It accepts cache reports through `POST /api/internal/radio/cache-report`.
  - Future work may add signed heartbeat, online/offline, Now Playing, current-program, and failure events only after their contract and provider are approved.
  - The current public status endpoint does not receive a runtime heartbeat and therefore remains offline unless an explicitly enabled public stream URL is configured.
- Public/private boundary:
  - `/api/radio/status` exposes a small anonymous read model: safe station display values, a validated public stream URL only when enabled, safe Now Playing metadata, and effective public schedules.
  - Admin settings, permission data, machine credentials, storage credentials, upload sessions, object keys, internal audit data, and emergency actors are not public fields.
  - `/api/internal/radio/*` is machine-authenticated and must never be called by browser code.
  - An object key in a machine-only manifest is not a public download URL and must remain behind a future storage/runtime access policy.
- One-way information:
  - Website/editorial system to runtime: approved manifest, schedule/playlist instructions, approved media references, fallback reference, and emergency intent.
  - Runtime to website: signed operational facts such as heartbeat, playback events, cache health, Now Playing, current program, and failure status.
  - Editorial approval remains authoritative in the website/database; runtime playback cannot approve or publish content.
- Result:
  - **PASS for the documented provider-neutral boundary.**
  - The actual runtime connection remains intentionally unimplemented and fail-closed.

## 3. Stream Contract

- Hostname:
  - Target display hostname: `radio.suruureman.com`.
  - The value remains configurable through the protected Radio settings route.
  - The public endpoint rejects malformed/private/internal hostnames and uses the safe default display hostname when configured data is unsafe.
- Path:
  - Optional `stream_path` remains a display/configuration field.
  - A future provider adapter must define whether it is an Icecast mount, an AzuraCast endpoint, or another approved public path before constructing runtime URLs.
  - No path is currently active.
- Format:
  - Target: MP3.
  - Future runtime must verify the actual content type and stream behavior rather than relying only on the stored display value.
- Bitrate:
  - Target: 96 kbps.
  - The approved initial capacity target is 10 simultaneous listeners at 96 kbps MP3 stereo.
  - The runtime and network audit must verify stereo output and overhead rather than assuming the nominal bitrate is the complete bandwidth requirement.
- Availability:
  - The website exposes a public stream only when the `enabled` setting is exactly `"true"` and `public_stream_url` passes HTTP/HTTPS and private-host filtering.
  - Without a valid enabled stream URL, the public endpoint returns `available: false`, `streamUrl: null`, and `status: "offline"`.
  - A hostname alone never means the station is live.
  - The website does not currently perform a network reachability probe, which is intentional until a provider/runtime contract exists.
- Result:
  - **PASS — offline-safe and provider-neutral.**
  - No fake stream URL or stream credential was created.

## 4. Now Playing Contract

- Fields:
  - `title`: required for a public Now Playing object.
  - `artist`: optional poet/artist/performer value.
  - `program`: optional current program/show value.
  - `contentType`: optional category/type value.
  - `artworkUrl`: optional public HTTP/HTTPS URL, filtered against private/internal hosts.
  - `updatedAt`: optional ISO timestamp indicating the metadata update time.
  - A future contract may add `startedAt`, but no schema or endpoint change is introduced in this phase.
- Missing-data behavior:
  - Missing optional fields normalize to null/undefined presentation values.
  - Missing title produces no public Now Playing object.
  - The frontend never fabricates a title, artist, program, or artwork.
- Stale-data behavior:
  - The current website preserves the runtime-provided `updatedAt` for display/read-model purposes but does not claim freshness from it.
  - A future runtime contract must define the stale threshold and should suppress or mark stale metadata rather than presenting it as current.
  - Until that rule exists, a missing/invalid operational source must be treated as offline or unavailable.
- Offline behavior:
  - The public endpoint returns `nowPlaying: null` unless a safe stream URL and title are both present.
  - The frontend clears Now Playing data when the status is offline, empty, or in error.
  - Runtime restart or website unavailability must not result in fabricated live state.
- Result:
  - **PASS for the current safe read model; freshness signaling remains a future contract decision.**

## 5. Playlist Runtime Contract

- Approved media:
  - Only audio satisfying `isBroadcastEligible` may be approved for broadcast use, added to a playlist, activate a playlist, or be selected for emergency audio.
  - Eligibility requires ready processing, approved editorial status, cleared and currently valid rights, an object reference, and a checksum.
  - Rejected and archived audio disables existing playlist items.
  - The runtime must treat the website manifest as an allowlist, not as a source of editorial authority.
- Ordering:
  - Sequential playlists use deterministic item position.
  - Website reorder preserves item IDs and metadata and updates positions transactionally.
  - A future manifest should carry a version and deterministic ordered items.
- Random:
  - Random selection remains a runtime behavior and is not executed by the website.
  - The runtime must select only enabled, eligible manifest items.
- Weighted:
  - Weighted selection is represented by optional item weights.
  - Weight interpretation remains future runtime behavior and must be explicitly documented before implementation.
  - Missing or invalid weights must not make ineligible content playable.
- Archived/rejected behavior:
  - Inactive or archived playlists cannot be treated as active runtime instructions.
  - Archived playlists cannot receive new items.
  - Rejected/archived audio cannot become playable through a stale playlist or manifest.
  - A runtime must revalidate manifest version/status and fail closed when its cached manifest is invalid or stale beyond an approved threshold.
- Result:
  - **PASS for the website-to-runtime editorial boundary.**
  - No AutoDJ, Liquidsoap, runtime selection, or playback loop was built.

## 6. Schedule Runtime Contract

- Timezone:
  - Station and default schedule timezone: `Europe/Berlin`.
  - Schedule records may retain an explicit valid IANA timezone.
  - The future runtime must interpret local times using the schedule timezone and must not convert them using the server's local timezone implicitly.
- Fields:
  - Schedule ID and version.
  - Name and program title.
  - Playlist ID/version and active status.
  - Days of week.
  - Start and end local times.
  - Timezone.
  - Effective start and end dates.
  - Priority.
  - Attribution where applicable.
- Effective dates:
  - The website validates dates and rejects reversed ranges.
  - The public endpoint returns only active, currently effective schedules attached to active playlists.
  - The runtime must use the manifest version and effective window when deciding what to consume.
- Priority:
  - `priority` exists in the schema and is available for a future runtime decision.
  - No priority arbitration behavior is invented in this phase.
- Overlap decision:
  - **Schedule overlap policy: reject, warn, or allow.**
  - No overlap policy is implemented or assumed.
- Result:
  - **READY WITH CONDITIONS — contract documented; real-time scheduling intentionally absent.**

## 7. Emergency Runtime Contract

- Website state:
  - The website stores emergency editorial intent: enabled/disabled, type, selected eligible audio, message, and activation/deactivation metadata.
  - Supported conceptual emergency types are poetry, message, and playlist.
  - Emergency updates require the relevant Radio permission and eligible audio when an audio reference is selected.
  - Emergency state writes are transactional.
- Runtime execution:
  - A future runtime may consume a signed manifest/emergency instruction containing:
    - emergency OFF/ON;
    - emergency type;
    - approved selected audio reference;
    - emergency message;
    - activation timestamp;
    - manifest/configuration version.
  - The runtime must acknowledge receipt/execution separately from website intent.
  - Runtime execution failure must not be represented as successful website broadcast execution.
- Permissions:
  - Contributors cannot read or modify emergency controls.
  - Admin permissions are checked server-side.
  - Developers retain the existing privileged authority.
- Current limitation:
  - The website response explicitly reports `broadcastExecution: "not_available"`.
  - The current system cannot interrupt an actual live broadcast.
- Result:
  - **PASS as an editorial foundation; runtime emergency execution is not implemented.**

## 8. Storage Contract

- Existing abstraction:
  - `RadioStorageProvider` defines upload-session creation, upload completion, metadata lookup, object retrieval, read access, archive, and deletion.
  - `UnconfiguredRadioStorageProvider` deliberately fails every byte operation with `RadioStorageNotConfiguredError`.
  - No deployment-local filesystem or ephemeral fallback is used.
- Future provider:
  - The provider remains undecided and must be selected by the owner after the client/runtime decision.
  - A concrete provider adapter must implement the existing interface without changing the editorial eligibility contract.
- Upload lifecycle:
  - Website metadata is validated before an upload session is requested.
  - A pending object key is allocated under the audio record.
  - Provider completion returns object metadata.
  - Size and SHA-256 are checked before the record moves to quarantined state.
  - Processing and editorial approval remain separate later states.
- Object verification:
  - Completed upload metadata must include a 64-character SHA-256 and match the expected size.
  - Future processing must verify the processed object, checksum, media format, duration, and any normalization contract before approval.
- Privacy:
  - Storage credentials, upload URLs, object keys, and private read URLs are not sent to public browser status.
  - Public artwork or stream URLs must be explicit public HTTP/HTTPS values and pass safety filtering.
  - A future runtime should use short-lived or machine-scoped access where appropriate, not browser credentials.
- Runtime media access:
  - The future runtime may consume approved object references from a signed manifest or a provider-specific controlled access mechanism.
  - The runtime must not infer permission from a filename or stale local cache.
- Result:
  - **PASS — provider-neutral and fail-closed.**
  - No provider, object storage, real audio, or production credential was configured.

## 9. Machine Authentication Contract

- Machine ID:
  - Required header: `x-radio-machine-id`.
  - The value must match the server-side `RADIO_MACHINE_ID`.
- Timestamp:
  - Required header: `x-radio-timestamp`.
  - It must be an integer Unix timestamp within the configured five-minute clock-skew window.
- Nonce:
  - Required header: `x-radio-nonce`.
  - It must match the allowed hexadecimal/hyphen format and must not have been used previously during the process's replay window.
- Signature:
  - Required header: `x-radio-signature`.
  - HMAC-SHA256 signs timestamp, nonce, method, path without query, and a canonical JSON body digest.
  - Comparison uses timing-safe equality.
- Replay protection:
  - Used nonces are retained in memory for the five-minute window and expired during subsequent requests.
  - The future production deployment must use a shared, durable nonce/replay store if multiple API instances can accept the same machine traffic.
  - Machine IDs should be included in a shared replay key when that store is designed.
- Authentication failure behavior:
  - Missing configuration returns HTTP 503 and does not pretend the machine is authenticated.
  - Missing or mismatched headers, stale timestamps, invalid/replayed nonces, and invalid signatures return HTTP 401.
  - Machine endpoints are rate-limited through the existing Radio machine rate limiter.
- Browser exposure:
  - `RADIO_MACHINE_ID` and `RADIO_MACHINE_SECRET` are server-side environment values only.
  - No machine secret is included in frontend code, public status, or public settings.
  - No production machine secret was created.
- Result:
  - **PASS for the existing foundation; shared replay storage and machine provisioning remain future deployment decisions.**

## 10. Local AzuraCast Integration Plan

- Architecture:

  ```text
  SURUR-E-MAN WEBSITE
          |
          | signed, provider-neutral integration
          v
  CLIENT RADIO PC
          |
       AzuraCast
       /       \
   Liquidsoap  Icecast
       |         |
     AutoDJ    Stream
       |
   Live/RJ/Broadcast
       |
  RØDECaster Pro II + Broadcast Software
  ```

- Dependencies:
  - Client-owned Windows 11 Pro PC readiness.
  - Approved provider/runtime choice after physical and network audit.
  - Storage provider decision and audio ingest path.
  - Machine identity and secret provisioning through a secure environment flow.
  - Public hostname, TLS, firewall, router, and port-forwarding decisions.
  - A written schedule-overlap policy.
- Website integration:
  - Website publishes or exposes an approved versioned manifest through the existing machine-authenticated boundary after a future publish workflow is approved.
  - Website remains the authority for editorial approval, rights, playlist status, schedule data, and emergency intent.
  - Public `/api/radio/status` remains a safe read model, not a direct provider dashboard proxy.
- Runtime integration:
  - A future client-side adapter would pull the active manifest, verify its hash/version, obtain approved media through the selected storage path, and feed the approved runtime.
  - The runtime would send signed playback/cache/heartbeat/Now Playing events back through explicit endpoints.
  - AzuraCast, Liquidsoap, Icecast, broadcast software, and RØDECaster configuration must be performed only in the dedicated infrastructure phase.
- Result:
  - **READY FOR CLIENT PC READINESS AUDIT; no local runtime has been installed or configured.**

## 11. Future Client PC Readiness Checklist

- Hardware:
  - Confirm CPU model, core count, and virtualization support.
  - Confirm RAM and sustained resource headroom while broadcast software and runtime components are active.
  - Confirm system and media storage type, capacity, health, and free disk.
  - Confirm network adapter type and driver stability.
  - Confirm uninterrupted power, UPS coverage, and safe restart behavior.
  - Confirm physical access, maintenance ownership, and backup/recovery responsibility.
- Windows:
  - Record Windows edition, version, build, and licensing state.
  - Verify virtualization readiness only during the PC audit.
  - Verify WSL2 readiness only if the approved runtime requires it.
  - Verify Docker readiness only if the approved runtime requires it.
  - Record firewall state and the change-approval owner.
  - Record idle and broadcast-load CPU, RAM, disk, and network usage.
  - Confirm automatic updates, restart windows, sleep/hibernation, and power settings.
- Network:
  - Measure sustained upload bandwidth and latency.
  - Record public IP behavior and whether it is static or dynamic.
  - Check CGNAT status.
  - Verify inbound connectivity only with owner approval during the infrastructure phase.
  - Record router model, administrative ownership, and port-forwarding capability.
  - Define firewall and port requirements only after runtime selection.
  - Confirm HTTPS/TLS and `radio.suruureman.com` DNS ownership/plan.
  - Confirm ISP restrictions, outage behavior, and backup connectivity.
- Audio:
  - Confirm RØDECaster Pro II model, firmware, and ownership.
  - Confirm stable USB connection and dedicated port.
  - Confirm microphone/input inventory and monitoring path.
  - Confirm broadcast software choice and support requirements.
  - Confirm sample rate, channel layout, encoding, and loudness/true-peak plan.
  - Confirm the handoff from live/RJ software into the future runtime.
- Capacity:
  - Validate 10 simultaneous listeners at 96 kbps MP3 stereo rather than assuming it.
  - Nominal listener payload is approximately 960 kbps aggregate before protocol and operational overhead.
  - Confirm sustained upload headroom, not merely a speed-test peak.
  - Test stream stability, reconnect behavior, and runtime resource use under the target listener count.
- Result:
  - **NOT YET EXECUTED — client PC unavailable.**
  - This checklist is prepared for the future controlled readiness audit.

## 12. Environment Contract

- Variables documented:
  - Existing server-side machine authentication:
    - `RADIO_MACHINE_ID`
    - `RADIO_MACHINE_SECRET`
  - Existing server-side Radio admin permission configuration:
    - `RADIO_ADMIN_PERMISSIONS`
  - Future conceptual runtime/provider values, to be finalized after approval:
    - `RADIO_STREAM_PUBLIC_URL`
    - `RADIO_STREAM_HOSTNAME`
    - `RADIO_STREAM_PATH`
    - `RADIO_STREAM_ENABLED`
    - `RADIO_PROVIDER_MODE`
    - `RADIO_STORAGE_PROVIDER`
    - `RADIO_MACHINE_REPLAY_STORE`
    - `RADIO_RUNTIME_HEARTBEAT_TTL_SECONDS`
- Existing application behavior:
  - Public stream and station display values currently come from protected `radio_settings` records.
  - The website does not require or add a provider-specific environment variable to remain offline.
  - The internal machine adapter fails closed when its existing machine variables are absent.
- Secrets protected:
  - No values were added to environment configuration.
  - No secret-looking placeholder was committed.
  - Machine secrets must remain server-side and must never be read by browser JavaScript.
  - Future provider/storage credentials must use the project secrets flow and must not be placed in this documentation or database settings.
- Result:
  - **PASS — contract documented without secret material or provider lock-in.**

## 13. Observability / Recovery Plan

- Monitoring:
  - Website public Radio status and offline/available state.
  - Runtime online/offline heartbeat.
  - Public stream reachability from an approved monitoring location.
  - Now Playing freshness and missing/stale metadata.
  - Machine authentication success/failure and replay rejection counts.
  - Storage availability, upload completion, checksum failures, and provider errors.
  - Manifest version, publication time, cache age, and cache verification status.
  - Emergency intent state versus runtime execution acknowledgement.
  - Playback failures, skipped items, and runtime restart events.
- Health:
  - Separate website health, machine heartbeat health, stream reachability, storage health, and manifest freshness.
  - Do not reduce all health to a single “live” flag.
  - A missing heartbeat must not be treated as a successful broadcast.
- Failure handling:
  - Public website falls back to offline/empty/error states.
  - Invalid or stale manifests are rejected by the runtime.
  - Missing media is skipped or fails the controlled item according to a future approved runtime policy; it must not bypass editorial eligibility.
  - Machine-authentication failures are rejected and logged without revealing secrets.
  - Emergency intent is shown as intent until runtime acknowledgement exists.
- Recovery:
  - Runtime restart reloads the latest verified manifest.
  - Network interruption leaves the website truthful and avoids fabricated availability.
  - Website outage leaves the runtime behavior to a future approved cached-manifest policy; it must be documented before live use.
  - Storage failure blocks new ingest and approval-dependent transitions rather than creating unverified playable records.
  - Stream failure produces an offline/failed operational state and an actionable alert.
- Result:
  - **READY AS A PLAN; no monitoring or recovery infrastructure was installed.**

## 14. Testing Evidence

- `git status --short --untracked-files=all` — inspected before Phase 6 edits; existing Radio and unrelated work was preserved.
- Source audit:
  - `lib/db/src/schema/radio.ts` — reviewed Radio settings, audio, playlist, schedule, history, and manifest structures.
  - `artifacts/api-server/src/routes/radio-public.ts` — reviewed public read-model fields and URL safety filtering.
  - `artifacts/api-server/src/routes/radio-internal.ts` — reviewed machine-only manifest, playback-event, and cache-report boundary.
  - `artifacts/api-server/src/lib/radioMachineAuth.ts` — reviewed timestamp, nonce, HMAC, body hash, timing-safe comparison, and fail-closed behavior.
  - `artifacts/api-server/src/lib/radioStorage.ts` — reviewed provider-neutral fail-closed storage interface.
  - `artifacts/api-server/src/lib/radioValidation.ts` — reviewed eligibility contract and upload metadata validation.
  - `artifacts/api-server/src/routes/radio.ts` — reviewed protected settings, upload lifecycle, emergency intent, playlist, and schedule operations.
  - `artifacts/surrur-e-mann/src/hooks/use-radio-status.ts` — reviewed offline, empty, error, and missing Now Playing behavior.
- Development database inspection:
  - Radio audio count: 0.
  - Radio playlists count: 0.
  - Radio playlist items count: 0.
  - Radio schedules count: 0.
  - Radio manifests count: 0.
  - Radio play history count: 0.
  - No migration or data mutation was performed.
- Phase 6 code change:
  - General Radio settings upserts are now transactional, matching the existing emergency-state transaction boundary.
- `pnpm --filter @workspace/db exec tsc -b` — passed.
- `pnpm --filter @workspace/api-server run typecheck` — passed.
- `pnpm --filter @workspace/surrur-e-mann run typecheck` — passed.
- `pnpm --filter @workspace/api-server run build` — passed.
- `pnpm --filter @workspace/surrur-e-mann run build` — passed; existing non-blocking tooltip sourcemap warning remains.
- `git diff --check` — passed.
- `GET /api/radio/status` — HTTP 200; `available: false`, `streamUrl: null`, `nowPlaying: null`, `status: "offline"`.
- `GET /api/internal/radio/manifest` without machine credentials — HTTP 503; machine authentication is not configured.
- `GET /api/internal/radio/events` without machine credentials — HTTP 503; machine authentication is not configured.
- `GET /api/internal/radio/cache-report` without machine credentials — HTTP 503; machine authentication is not configured.
- `GET /api/admin/radio/settings` without authorization — HTTP 401.
- `GET /api/contributor/radio/submissions` without authorization — HTTP 401.
- `/radio` at 402×874 — rendered successfully; offline state and sticky player visible.
- `/radio` at 1440×1000 — rendered successfully; offline state, player, and schedule section visible.
- `/admin/radio` at 1440×1000 without authentication — redirected to sign-in.
- `/contributor/radio` at 402×874 without authentication — redirected to sign-in.
- Browser logs — no Radio runtime errors; existing React DevTools informational message only.
- No real stream, Now Playing source, listener count, provider, storage, machine, DNS, or PC readiness test was executed.

## 15. Files Changed

- `artifacts/api-server/src/routes/radio.ts`
  - Made protected Radio settings updates atomic so a multi-setting write cannot partially apply.
- `docs/Radio-Surur-FM-Phase-6-Infrastructure-Preparation-Integration-Readiness-Completion-Report.md`
  - Documents the website/runtime boundary, future contracts, local runtime plan, client PC checklist, environment contract, observability/recovery plan, and Phase 6 completion status.

## 16. Production Safety Review

Confirm:

- No PC changes.
- No router changes.
- No firewall changes.
- No DNS changes.
- No streaming runtime.
- No provider configuration.
- No storage provider configuration.
- No public stream.
- No real credentials added.
- No machine secret created.
- No real audio uploaded.
- No production data mutation.
- No unrelated feature removed.
- No provider-specific fallback added.
- No deployment-local file used as an audio store.

## 17. Known Issues / Limitations

- The client Radio PC is unavailable, so hardware, Windows, network, audio, power, and capacity readiness remain unverified.
- AzuraCast, Liquidsoap, Icecast, RØDECaster, broadcast software, storage, DNS, router, firewall, and public network behavior remain unconfigured.
- The future provider and storage provider remain undecided.
- The current public status endpoint does not verify live stream reachability or metadata freshness; it only exposes an explicitly enabled safe URL and configured read-model metadata.
- The current machine replay protection is process-local. A future multi-instance deployment requires shared replay protection before production machine traffic is enabled.
- The existing internal manifest endpoint has no active manifest in development and therefore cannot be used by a runtime.
- The current internal event endpoints record playback/cache evidence but do not yet provide a complete runtime heartbeat or public Now Playing ingestion contract.
- Schedule overlap behavior remains undefined.
- No automated infrastructure integration test exists because no runtime or provider is configured.

## 18. Decisions Required

- Choose the final runtime/provider path after the client PC and network audit; AzuraCast is a likely candidate, not a final approval.
- Choose the storage provider and access model.
- Decide whether schedule overlaps should be rejected, warned about, or allowed.
- Define the Now Playing freshness threshold and whether stale data is hidden or explicitly labeled.
- Define the runtime acknowledgement semantics for emergency execution.
- Decide whether the future deployment is single-instance or requires shared machine nonce/replay storage.
- Approve the public DNS/TLS and inbound-network plan during the infrastructure phase.

## 19. Final Status

**READY WITH CONDITIONS**

The existing website Radio system is ready for the next controlled client PC readiness audit and future integration design. The website/runtime boundary, storage and machine-authentication foundations, public stream contract, editorial manifest boundary, readiness checklist, environment contract, and observability/recovery plan are documented without selecting or touching a provider.

The conditions are operational rather than website blockers: the client PC and network must become available, provider/storage/runtime choices must be approved, and the unresolved schedule overlap and runtime acknowledgement decisions must be settled before live infrastructure work.

## 20. Recommended Next Phase

Run the smallest controlled next phase:

1. Audit the client-owned PC, Windows environment, network, power, audio chain, and upload capacity.
2. Confirm the runtime/provider and storage decisions.
3. Decide schedule overlap and Now Playing freshness behavior.
4. Provision non-production machine identity and shared replay protection only through the approved secrets flow.
5. Build one isolated staging adapter against the existing manifest and public-status contracts.
6. Validate manifest verification, approved-media access, stream delivery, Now Playing, heartbeat, failure handling, and emergency acknowledgement.
7. Perform listener-capacity testing for 10 simultaneous listeners at 96 kbps MP3 stereo.
8. Approve DNS, firewall, router, TLS, and public activation only after staging gates pass.

Do not install or configure AzuraCast, Icecast, Liquidsoap, Docker, WSL2, Windows, router/firewall rules, RØDECaster, broadcast software, object storage, DNS, AutoDJ, or a public stream during this preparation phase.

**Website Radio complete + integration contract documented + client PC readiness checklist prepared + no live infrastructure touched.**