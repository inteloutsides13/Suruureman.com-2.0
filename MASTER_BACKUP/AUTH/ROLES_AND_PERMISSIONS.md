# Roles and Permissions

## Roles

- **developer:** full privileged access, including users, tools, backups/restore,
  and all admin capabilities.
- **admin:** content, settings, messages, contributor review, pending content,
  and radio operations allowed by radio permissions.
- **contributor:** contributor portal and own submissions only; cannot use the
  admin surface.

## Enforcement

- `requireAdmin` allows admin and developer.
- `requireDeveloper` allows developer only.
- `requireContributor` allows active contributors and checks account status and
  token revocation on every request.
- `requireAnyAuth` accepts any active role with contributor database checks.
- Radio endpoints additionally require named permissions such as
  `radio.audio.read`, `radio.audio.create`, `radio.audio.approve`,
  `radio.playlists.manage`, `radio.schedules.manage`, and
  `radio.emergency.manage`.

The UI guards improve navigation but are not the security boundary; the API
middleware is authoritative.