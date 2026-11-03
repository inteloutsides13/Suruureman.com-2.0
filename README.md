# Surrur-e-Man (سُرور مَن)

> A curated Urdu poetry website dedicated to the timeless tradition of classical and contemporary verse.

**Production website:** https://suruureman.com

---

## Overview

Surrur-e-Man is a full-stack web application for publishing, browsing, and managing Urdu poetry. It includes a public-facing poetry portal, an admin management panel, and a contributor system that allows community members to submit poems for editorial review.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS v4, Wouter (routing), TanStack Query |
| Backend / API | Express 5, TypeScript, esbuild (bundled) |
| Database | PostgreSQL (Replit-managed), Drizzle ORM |
| Auth | JWT (jsonwebtoken), bcryptjs — role-based: `developer`, `admin`, `contributor` |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/          # Express REST API (Node.js)
│   │   └── src/
│   │       ├── routes/      # API route handlers
│   │       ├── middlewares/ # Auth middleware (requireAdmin, requireContributor, etc.)
│   │       └── lib/         # DB helpers, migrations, logger
│   └── surrur-e-mann/       # React + Vite frontend
│       └── src/
│           ├── pages/       # Public pages + admin/ + contributor/
│           ├── components/  # Shared UI components
│           └── hooks/       # Auth hooks, data hooks
├── lib/
│   ├── db/                  # Drizzle ORM schema & DB client (@workspace/db)
│   ├── api-zod/             # Shared Zod validation schemas (@workspace/api-zod)
│   ├── api-spec/            # OpenAPI spec (orval codegen)
│   └── api-client-react/    # Generated React Query hooks (@workspace/api-client-react)
├── pnpm-workspace.yaml      # Workspace package definitions
└── package.json             # Root workspace scripts
```

---

## API Endpoints

### Public
- `GET /api/poems` — list published poems (paginated, filterable)
- `GET /api/poems/:id` — single poem
- `GET /api/poets` — list poets
- `GET /api/poets/:id` — poet detail + poems
- `GET /api/categories` — all categories
- `GET /api/videos` — list videos
- `GET /api/tools` — public tools
- `GET /api/health` — health check
- `POST /api/contact` — contact form

### Admin (`/api/admin/*`) — requires admin/developer JWT
- `POST /api/admin/login` — authenticate
- `GET /api/admin/stats` — site-wide statistics
- `GET /api/admin/poems` — all poems (all statuses)
- `POST|PUT|DELETE /api/admin/poems/:id` — poem management
- `GET|POST|PUT|DELETE /api/admin/poets/:id` — poet management
- `GET|POST|PUT|DELETE /api/admin/videos/:id` — video management
- `GET /api/admin/contributors` — list contributors
- `POST /api/admin/contributors` — create contributor account
- `POST /api/admin/contributors/:id/disable|enable` — session-invalidating disable/enable
- `GET /api/admin/pending` — poem approval queue
- `POST /api/admin/poems/:id/approve|reject` — approve or reject submissions
- `GET /api/admin/audit-logs` — full audit trail

### Contributor Portal (`/api/contributor/*`) — requires contributor JWT
- `GET /api/contributor/me` — profile + submission stats
- `GET|POST /api/contributor/poems` — own submissions
- `PUT|DELETE /api/contributor/poems/:id` — edit/delete own poems
- `GET|POST /api/contributor/poets` — browse/create poets
- `GET /api/contributor/categories` — category list

---

## Development

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9

### Install dependencies
```bash
pnpm install
```

### Run the API server (development)
```bash
pnpm --filter @workspace/api-server run dev
```

### Run the frontend (development)
```bash
pnpm --filter @workspace/surrur-e-mann run dev
```

### Run both (Replit)
Both services are managed as Replit workflows and start automatically.

### Build all
```bash
pnpm run build
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values before running locally.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret key for signing JWTs |
| `SESSION_SECRET` | ✅ | Session signing secret |
| `PORT` | ✅ | API server port (set automatically by Replit) |
| `NODE_ENV` | — | `development` or `production` |
| `LOG_LEVEL` | — | Pino log level (default: `info`) |
| `SEED_DEV_PASSWORD` | — | Development/bootstrap-only developer seed password; never committed |
| `SEED_ADMIN_PASSWORD` | — | Development/bootstrap-only admin seed password; never committed |
| `CORS_ORIGINS` | — | Comma-separated explicit browser origin allowlist |
| `RADIO_*` | — | Phase 2 Radio foundation settings; provider and machine credentials remain unconfigured |

**Never commit `.env` files.** See `.gitignore`.

---

## Architecture Notes

- **Monorepo**: pnpm workspaces. The frontend (`@workspace/surrur-e-mann`) and API (`@workspace/api-server`) are separate artifacts. Shared logic lives in `lib/`.
- **Database migrations**: Existing contributor migrations remain startup-managed. Radio foundation migration is reviewed separately in `lib/db/migrations/0001_radio_foundation.sql` and must be applied only to an explicitly identified non-production database during Phase 2.
- **Auth roles**: `developer` (full access) › `admin` (content + contributors) › `contributor` (own submissions only). JWTs are stateless; contributor sessions can be instantly invalidated by setting `tokenRevokedAt` on the account.
- **Public poem filtering**: `GET /api/poems` returns only `status = "published"` poems for unauthenticated requests. Admin/developer JWTs bypass this filter automatically.
- **Contributor workflow**: Submitted poems get `status = "pending"`. Admins approve or reject from the `/admin/pending` queue. Rejected poems include a reason and can be edited and resubmitted.

---

## Deployment

The application is deployed on Replit. Production URL: **https://suruureman.com**

Database schema changes are applied automatically on the next server start via the idempotent migration runner.

---

## Important Security Notes

- Privileged seed users are created only when `SEED_DEV_PASSWORD` and `SEED_ADMIN_PASSWORD` are explicitly configured. No default password is present in source.
- All admin and contributor routes are JWT-protected. Tokens are signed with `JWT_SECRET`.
- Contributor account disabling takes effect immediately (invalidates all open sessions).
- `GET /api/healthz` is a liveness check; `GET /api/readyz` verifies PostgreSQL readiness.
