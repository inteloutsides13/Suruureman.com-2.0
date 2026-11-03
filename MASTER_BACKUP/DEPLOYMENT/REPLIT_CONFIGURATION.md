# Replit Configuration

Authoritative files:

- `.replit`: Node/Python/PostgreSQL modules, deployment target, workflow name,
  post-build pruning, user environment values, and post-merge hook.
- `artifacts/api-server/.replit-artifact/artifact.toml`: API artifact, port 8080,
  `/api` path, production bundle/run command, health check.
- `artifacts/surrur-e-mann/.replit-artifact/artifact.toml`: web artifact, port
  24783, static production directory, SPA rewrite.
- `artifacts/mockup-sandbox/.replit-artifact/artifact.toml`: design preview
  artifact at `/__mockup`, port 8081.

The normal web and API workflows are:

```text
pnpm --filter @workspace/surrur-e-mann run dev
pnpm --filter @workspace/api-server run dev
```

The mockup server is a separate development artifact and is not the production
website.