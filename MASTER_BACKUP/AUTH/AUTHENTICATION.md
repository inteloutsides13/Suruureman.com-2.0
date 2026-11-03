# Authentication

## Admin and contributor login

- `POST /api/admin/login` accepts the configured admin email/password and returns
  a JWT.
- Passwords are bcrypt-hashed. Bootstrap credentials come from seed environment
  variables only when no privileged users exist.
- Protected requests send `Authorization: Bearer <JWT>`.
- Production requires `JWT_SECRET`; development generates an ephemeral secret if
  none is configured.
- The frontend stores and clears the application admin session through
  `src/hooks/use-admin-auth`.

## Request validation

The API verifies the JWT signature, role, active database account, matching role,
and token revocation timestamp. Contributor requests additionally verify that the
account still exists, is active, and still has the contributor role.

The API applies login and contributor-status rate limits, CORS allowlisting,
request-body limits, structured logging, and security response headers.

## Session invalidation

Disabling an account or resetting its password updates `token_revoked_at`.
Tokens issued before that timestamp are rejected. This provides server-side
invalidaton even if a token has not reached its normal expiry.