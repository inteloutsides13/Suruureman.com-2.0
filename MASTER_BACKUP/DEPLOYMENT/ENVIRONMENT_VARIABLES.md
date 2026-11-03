# Environment Variables

Never copy current values into Git. Use Replit Secrets or the target deployment
secret manager for secret values.

| Name | Requiredness | Purpose | Secret |
|---|---|---|---|
| `DATABASE_URL` | Required | Development/runtime PostgreSQL connection | Yes |
| `PROD_DATABASE_URL` | Script-only | Production-to-development sync source | Yes |
| `JWT_SECRET` | Required in production | JWT signing | Yes |
| `SESSION_SECRET` | Documented compatibility name | Session signing if used by a clone | Yes |
| `SEED_DEV_PASSWORD` | Bootstrap only | Development seeded developer password | Yes |
| `SEED_ADMIN_PASSWORD` | Bootstrap only | Development/production bootstrap admin password | Yes |
| `PORT` | Runtime | API/listener port, supplied by Replit | No |
| `NODE_ENV` | Runtime | `development` or `production` | No |
| `LOG_LEVEL` | Optional | Pino log level | No |
| `CORS_ORIGINS` | Optional | Comma-separated browser origins | No |
| `PUBLIC_APP_URL` | Approval flow | Canonical URL for activation links | No |
| `SMTP_HOST` | Email | SMTP hostname | No |
| `SMTP_PORT` | Email | SMTP port | No |
| `SMTP_SECURE` | Email | TLS mode | No |
| `SMTP_USER` | Email | Mailbox identity | No |
| `SMTP_PASSWORD` | Email | Mailbox password | Yes |
| `MAIL_FROM` | Email | Sender address | No |
| `MAIL_FROM_NAME` | Email | Sender display name | No |
| `RADIO_ENABLED` | Optional | Radio feature gate | No |
| `RADIO_PUBLIC_STREAM_URL` | Optional | Configured public stream link | No |
| `RADIO_SCHEDULE_TIMEZONE` | Optional | Schedule timezone, default Europe/Berlin | No |
| `RADIO_ADMIN_PERMISSIONS` | Optional | Comma-separated radio permissions | No |
| `RADIO_INTERNAL_API_URL` | Optional | Internal radio service URL | No |
| `RADIO_MACHINE_ID` | Optional radio runtime | Machine identity | Yes |
| `RADIO_MACHINE_SECRET` | Optional radio runtime | Machine HMAC secret | Yes |
| `RADIO_STORAGE_PROVIDER` | Optional radio runtime | Storage provider selector | No |
| `RADIO_MONITORING_ENABLED` | Optional | Monitoring feature gate | No |
| `RADIO_ALERT_WEBHOOK_URL` | Optional | Alert webhook | Sensitive |
| `BASE_PATH` | Vite/mockup | Artifact base path | No |
| `REPL_ID` | Replit runtime | Replit environment identifier | No |

See `.env.example` for safe empty placeholders. Replit `.replit` also contains
non-secret shared mail settings; secret values must never be copied from it.