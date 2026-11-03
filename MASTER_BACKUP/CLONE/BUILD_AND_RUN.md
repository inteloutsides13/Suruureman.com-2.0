# Build and Run

```bash
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/surrur-e-mann run dev
```

The API health check is `/api/healthz`. The web artifact is an SPA and must
serve `index.html` for client-side routes. Use the Replit artifact manifests for
production ports and paths.