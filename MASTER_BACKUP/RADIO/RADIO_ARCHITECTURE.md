# Radio Architecture

## Layers

1. **Editorial data:** `radio_audio`, playlists, playlist items, schedules,
   settings, play history, and manifests.
2. **Authorization:** bearer JWT plus permission strings handled by
   `radioAuth.ts`/`radioMachineAuth.ts`.
3. **Storage boundary:** `radioStorage.ts` exposes a provider-neutral interface
   for object metadata/bytes and fails closed without a configured provider.
4. **Public surface:** `/api/radio/status` and the frontend `/radio` page.
5. **Internal machine surface:** `/api/internal/radio/*`, HMAC authenticated
   with timestamp/nonce replay protection.

## Safety invariants

- Backend eligibility remains authoritative.
- A playlist can contain an item without that item being playable.
- Editorial emergency state does not claim runtime playback is available.
- Hashes, object keys, and manifest payloads are metadata; they do not supply
  the audio bytes.
- Machine credentials are environment secrets and never belong in Git.