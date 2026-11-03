# Architecture

## Boundary map

```text
Browser
  └─ React/Vite artifact: artifacts/surrur-e-mann
       └─ /api requests
            └─ Express artifact: artifacts/api-server
                 └─ @workspace/db
                      └─ PostgreSQL

Shared contracts:
  lib/api-spec → Orval → lib/api-zod + lib/api-client-react
Shared database:
  lib/db/src/schema + lib/db/migrations
```

## Packages

- `artifacts/surrur-e-mann`: public website, admin UI, contributor UI, and tests.
- `artifacts/api-server`: Express routes, JWT guards, business logic, migrations,
  mailer, radio policy, and internal radio API.
- `artifacts/mockup-sandbox`: isolated component preview server for the canvas.
- `lib/db`: Drizzle database client and schema.
- `lib/api-spec`: OpenAPI source and Orval configuration.
- `lib/api-zod`: generated request/response validation types.
- `lib/api-client-react`: generated React Query hooks.
- `scripts`: seed and development synchronization utilities.

## Request flow

The frontend uses the artifact base path and calls `/api`. Express mounts the
route index at `/api`, applies CORS, request logging, JSON/body limits, security
headers, and then dispatches to route modules. Database access is through the
shared Drizzle client. Admin/contributor routes require bearer JWTs and perform
database checks for active role and token revocation.

## Build and run

- `pnpm run typecheck`: TypeScript project-reference checks.
- `pnpm run build`: typecheck followed by recursive package builds.
- API development: `pnpm --filter @workspace/api-server run dev`.
- Web development: `pnpm --filter @workspace/surrur-e-mann run dev`.
- API production start: `node --enable-source-maps artifacts/api-server/dist/index.mjs`.
- Web production output: `artifacts/surrur-e-mann/dist/public`.

## Data safety

Application backup snapshots and live contributor/contact data are not equivalent
to a full database backup. Preserve database structure with the repository and
preserve live data with an encrypted PostgreSQL-native operator backup.