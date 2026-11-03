# Clone From Scratch

## 1. Source and runtime

```bash
git clone https://github.com/inteloutsides13/Suruureman.com.git
cd Suruureman.com
corepack enable
pnpm install --frozen-lockfile
```

Use Node.js 24 and pnpm. Do not use the old `surur-e-man` repository.

## 2. Environment

Copy `.env.example` to a local secret-managed environment. Set `DATABASE_URL`,
`JWT_SECRET`, bootstrap passwords when needed, and any approved SMTP/public URL
values. Never commit `.env`.

## 3. Database

Provision PostgreSQL, apply the current Drizzle schema/migrations, then start
the API once so idempotent contributor migrations run. For a data-bearing clone,
restore an operator-approved encrypted dump or sanitized content export; do not
run destructive seed/sync utilities against production.

## 4. Development

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/surrur-e-mann run dev
```

The API uses the configured `PORT` (Replit artifact default 8080) and the web
artifact uses its Vite port/base path.

## 5. Build and production

```bash
pnpm run build
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

Serve `artifacts/surrur-e-mann/dist/public` as an SPA with the rewrite described
in `DEPLOYMENT/REPLIT_CONFIGURATION.md`. Configure CORS and `PUBLIC_APP_URL`
for the actual canonical domain.

## 6. External services

Configure Hostinger SMTP for approval email. Configure an approved radio object
storage provider only if radio byte operations are required. YouTube embeds and
public sharing remain external browser integrations.

## 7. Verification

Run the checklist in `VERIFICATION_CHECKLIST.md`, then verify authentication,
contributor application/approval/activation, email delivery, content CRUD,
backup boundaries, and radio behavior separately. Health and configured links
must not be treated as proof of an available radio runtime.