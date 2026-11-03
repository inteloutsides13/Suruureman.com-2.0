# Directory Structure

```text
.
├── artifacts/
│   ├── api-server/
│   │   ├── src/{app.ts,index.ts,routes,middlewares,lib}
│   │   └── .replit-artifact/artifact.toml
│   ├── surrur-e-mann/
│   │   ├── src/{App.tsx,main.tsx,pages,components,hooks,lib,content,test}
│   │   ├── public/
│   │   └── .replit-artifact/artifact.toml
│   └── mockup-sandbox/
├── lib/
│   ├── api-client-react/
│   ├── api-spec/
│   ├── api-zod/
│   └── db/
│       ├── src/schema/
│       └── migrations/
├── scripts/
│   └── src/{seed.ts,sync-prod-to-dev.ts,hello.ts}
├── docs/                         # project phase and completion reports
├── backups/                      # repository archives; not a live DB dump
├── MASTER_BACKUP/                # this source-derived recovery package
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig*.json
├── .replit
├── .env.example
└── replit.md
```

Ignored by design: dependencies, compiled output, `.env` files, Replit local
state, agent memory, and uploaded `attached_assets/`.