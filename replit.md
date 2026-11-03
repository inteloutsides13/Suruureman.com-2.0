# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the full-stack **Suruureman** Urdu poetry website.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS
- **Animations**: Framer Motion

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (Poems, Categories, Poets, Videos)
│   └── surrur-e-mann/      # React + Vite frontend (Urdu poetry website)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (seed.ts for database seeding)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Suruureman — Urdu Poetry Website

A high-end luxury Urdu poetry website named "Suruureman" (سُرُور مَن).

### Design
- **Color palette**: Deep near-black background, rich crimson red, soft gold accents
- **Fonts**: Noto Nastaliq Urdu (poetry), Playfair Display (headings), Inter (body)
- **Aesthetic**: Luxury minimal, inspired by the ornate gold logo

### Features
- Hero section with centered logo and featured poem snippet
- Featured poetry section with elegant framed poem cards
- Visual poetry with atmospheric imagery (admin-controlled)
- Poetry categories (Ghazal, Nazm, Qasida, Marsiya, Rubaie)
- Videos section with YouTube integration (full URLs auto-extracted)
- Latest poems section
- Full poetry collection browser with category filtering + Load More pagination (6/page)
- Poem detail page with like button (localStorage) + social share menu (WhatsApp, Twitter, Facebook, Copy Link)
- Share tracking: increments shares counter + records event on every share click
- Search page (/search?q=)
- Responsive navigation with bilingual (English/Urdu) labels + search icon + Contact link
- Contact page (/contact) with public form that saves messages to DB
- Admin panel (/admin) with JWT auth and full CRUD for poems/poets/videos + visual poetry management
- Admin categories CRUD (/admin/categories) with poem-count and delete-protection
- Admin messages inbox (/admin/messages) for viewing/deleting contact form submissions
- Admin settings page (/admin/settings) — contact info + social media links (stored in DB)
- Admin backups page (/admin/backups) — five-slot rotating application-data snapshots stored in the same database, not full database backups or PostgreSQL point-in-time recovery. New snapshots include poems, poets, videos, categories, tools, and allowlisted public contact/social settings; checksum validation and explicit confirmation are required, and restore merges transactionally without deleting rows absent from the snapshot. Excludes Radio data, analytics events and engagement counters, accounts/password hashes, contributor applications/tokens, contact messages, and audit logs. Legacy snapshots remain restorable with the same setting allowlist.
- Footer social links rendered dynamically from settings
- Brand: "SURUUREMAN" (formerly "Surrur-e-Man"), renamed site-wide

### Public Routes
- `GET /api/poems` — List poems (supports ?featured, ?category, ?limit, ?offset, ?poetName, ?search, ?visualPoetry)
- `GET /api/poems/:id` — Single poem (auto-increments views + records view event)
- `POST /api/poems/:id/like` — Like poem (records like event)
- `POST /api/poems/:id/unlike` — Unlike poem
- `POST /api/poems/:id/share` — Track share (increments shares + records share event)
- `GET /api/categories` — List categories with poem counts
- `POST /api/contact` — Submit contact message (public)
- `GET /api/admin/settings/public` — Read-only settings (social/contact for footer)
- `GET /api/poets` — List poets with poem counts
- `GET /api/poets/:id` — Single poet
- `GET /api/videos` — List videos

### Admin Routes (require Bearer JWT from POST /api/admin/login)
- `POST /api/admin/login` — Returns JWT (env: ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET)
- `GET /api/admin/stats` — Counts + totals: poems/poets/videos/totalLikes/totalViews/totalShares
- `GET /api/admin/analytics?range=7d|30d&start=&end=` — Events grouped by day (likes/views/shares)
- `GET /api/admin/top-poems` — Top 5 poems by likes, views, shares
- `POST/PUT/DELETE /api/poems` — Poem CRUD
- `PATCH /api/poems/:id/visual` — Toggle visualPoetry flag and/or update imageUrl (safe partial update)
- `POST/PUT/DELETE /api/poets` — Poet CRUD
- `POST/PUT/DELETE /api/videos` — Video CRUD (youtubeId accepts full URLs, ID extracted automatically)
- `POST/PUT/DELETE /api/categories` — Category CRUD (delete blocked if poems use it)
- `GET/DELETE /api/admin/messages/:id` — Contact messages inbox
- `GET/PUT /api/admin/settings` — Key-value settings (contact info + social links)
- `GET/POST/DELETE /api/admin/backups`, `POST /api/admin/backups/:id/restore` — Backup management

### Admin Panel Frontend
- `/admin/login` — Login page; initial credentials are supplied through secure environment variables when seeding an empty database
- `/admin/dashboard` — Stats + engagement totals + line charts (likes/views/shares over time) + date filter (7d/30d/custom) + top 5 poems by each metric
- `/admin/poems`, `/admin/poems/new`, `/admin/poems/:id/edit`
- `/admin/poets`, `/admin/poets/new`, `/admin/poets/:id/edit`
- `/admin/videos`, `/admin/videos/new`, `/admin/videos/:id/edit`
- `/admin/visual-poetry` — Mark poems as visual, attach image URLs, preview before saving
- `/admin/categories` — Full CRUD for categories, slug auto-generation, poem counts, delete protection
- `/admin/messages` — Contact form inbox with read/delete
- `/admin/settings` — Contact info and social links management
- `/admin/backups` — Create/restore/delete snapshots (max 5, FIFO rotation)

### Database Schema (PostgreSQL)
- `poems` — id, title, titleUrdu, content, poetName, poetNameUrdu, category, categoryUrdu, featured, imageUrl, likes, views, shares (NEW), visualPoetry (NEW), createdAt
- `categories` — id, name, nameUrdu, slug, description
- `poets` — id, name, nameUrdu, bio, bioUrdu, era
- `videos` — id, title, titleUrdu, description, youtubeId, thumbnailUrl, duration
- `events` — id, type ("like"|"share"|"view"), poemId (FK→poems, cascade delete), createdAt
- `contact_messages` — id, name, email, message, createdAt
- `settings` — id, key (unique), value (key-value store for contact info + social links)
- `backups` — id, name, data (JSON snapshot), createdAt (max 5, FIFO rotation)

### Seed data
Run: `pnpm --filter @workspace/scripts run seed`
Contains: 8 poems by Ghalib, Iqbal, Faiz, Mir; 5 categories; 4 poets; 3 videos

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json`. Always typecheck from the root with `pnpm run typecheck`.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Second-account migration safety

This project is an exact migration of the existing Suruur E Man / Radio Suruur FM application, not a rebuild or redesign. Preserve the existing authentication, poetry rules, contributor workflows, e'raab instructions/retries, and radio behavior. OCR remains on hold.

Canonical user-facing product terminology is **اِعْراب — e'raab**, with English **e'raab** (lowercase). Do not use IRAB, I'rab, I‘rab, Iraab, Aeraab, or E'raab as product labels. Preserve technical `/irab`, `POST /api/irab/text`, and existing internal identifiers. Do not redesign this tool or alter its linguistic instructions, model, output guard, retry policy, rate limiter, or request structure.

The user selected reuse of the verified original Neon database, accepting shared live records between projects. Do not create an isolated copy or initialize the destination's default database unless the user changes this decision. Reuse does not transfer database ownership; preserve the old project/database lifecycle.

- Explicit reuse configuration is MIGRATION_DATABASE_STRATEGY=reuse-original. SOURCE_DATABASE_URL is selected only under that setting; missing source credentials fail instead of falling back to the destination database.
- Normal writes are enabled only in this new project's development environment through MIGRATION_DATABASE_READ_ONLY=false. This connects to the shared original database, so real user actions affect shared production data. The shared/production environment has no writable override and remains protected by the default read-only policy.
- The agent must not perform test writes, fake logins/accounts, artificial emails, or e'raab submissions. The user will perform real-world tests manually.
- e'raab remains restricted to developer, admin, and contributor roles. Its shared tools row is currently inactive and must not be changed as part of verification; the web Tools page supplies a local `/irab` card only for those authenticated roles. Keep visitors blocked and do not change the e'raab engine or its instructions.
- The stateless POST exception is the exact `/api/irab/text` route. It retains original JWT, active-account/revocation, allowed-role, validation and rate-limit checks; it does not persist submitted text. Do not broaden this exception.
- Use the migration-safe API entrypoint, not the original index/start scripts, when reusing the original database. It never runs migrations or seeds and verifies the requested session write policy before listening.
- The old project, production database, and deployment are protected sources of truth. Never reset, truncate, drop, overwrite, or seed their data.
- Inspect the live schema before any migration; run no migration unless the current application genuinely requires missing schema and the change is additive/non-destructive. The current source schema check found no missing tables or columns, so migrations and seeds remain disabled.
- The development API runs the migration-safe entrypoint against the original database with normal operations enabled. The API production service still uses its HTTP 503 safety gate, and the old production deployment/domain remain unchanged. Do not publish, change DNS, or cut over without separate user approval.
- The original API startup performs migrations/seeds. Establish a safe startup strategy before running it against any production database.
- The new project's runtime-managed DATABASE_URL is not evidence that the original production database has migrated. Do not use it to create an empty replacement and claim success.
- Use Secrets for credentials; never expose them, commit them, or include them in source exports. Raw transferred uploads remain private audit evidence under ignored .local storage.
- Do not publish or change the production domain until the required verification and user approvals are complete. DNS cutover requires separate explicit approval.
- Never force-push, rewrite history, or create a competing GitHub repository. Independent current GitHub main synchronization is still unverified.
- See docs/migration for source provenance, executed checks, remaining blockers, and rollback guidance.

## Codegen

Run: `pnpm --filter @workspace/api-spec run codegen`
