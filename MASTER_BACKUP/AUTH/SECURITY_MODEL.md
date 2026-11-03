# Security Model

- Secrets are environment-provided and excluded by `.gitignore`.
- JWT signing uses `JWT_SECRET`; production fails closed if it is missing.
- Passwords are bcrypt hashes and are never part of normal API responses.
- Activation tokens are hashed and encrypted at rest, expire after the configured
  72-hour window, and are single-use.
- Token revocation is checked against database lifecycle state.
- CORS is allowlisted; production defaults to the Suruureman domains.
- JSON and URL-encoded request bodies have explicit limits.
- Security headers include content-type sniffing, frame, referrer, permissions,
  and production HSTS controls.
- Logs should contain operational context, not passwords, tokens, SMTP secrets,
  database URLs, or private application data.

## Security-sensitive data excluded from Git

`.env`, SMTP passwords, JWT/session secrets, database credentials, API keys,
activation/session tokens, password hashes, private keys, and live data dumps.