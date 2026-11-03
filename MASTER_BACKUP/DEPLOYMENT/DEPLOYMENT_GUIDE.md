# Deployment Guide

## Replit deployment

The project uses the Replit application deployment target `autoscale` with an
application router. The API and web artifacts are registered separately:

- API service on port `8080`, base path `/api`, health path `/api/healthz`.
- Static web service on port `24783`, base path `/`, SPA rewrite to
  `artifacts/surrur-e-mann/dist/public/index.html`.

The production domain configured for the web client is
`https://suruureman.com`.

## Clone/deploy sequence

1. Install Node.js 24 and pnpm.
2. Install dependencies with `pnpm install --frozen-lockfile`.
3. Configure the database and secret values.
4. Run typecheck and build.
5. Verify API health and frontend routing.
6. Publish/deploy through the project’s Replit deployment configuration.

Do not run database migrations or destructive seed steps as an implicit deploy
hook. Review schema changes and data backups first.