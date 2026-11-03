# Technical Stack

| Layer | Current implementation |
|---|---|
| Runtime | Node.js 24, with Python and PostgreSQL modules provisioned by Replit |
| Package manager | pnpm |
| Language | TypeScript 5.9 |
| Frontend | React 19, Vite, Tailwind CSS, Wouter, TanStack React Query, Framer Motion |
| API | Express 5, CORS, Pino HTTP logging |
| Database | PostgreSQL 16, `pg`, Drizzle ORM, Drizzle-Zod |
| Validation | Zod v4 and generated API schemas |
| API contracts | OpenAPI source with Orval-generated Zod and React Query clients |
| Build | Vite frontend; esbuild API bundle |
| Tests | Vitest in the web package |
| Email | Nodemailer with Hostinger SMTP |
| Auth | JSON Web Tokens, bcrypt password hashes, role/status checks |
| Deployment | Replit autoscale application deployment with static web artifact and API service |

Authoritative package manifests are at the repository root and in each workspace
package. Generated files should be regenerated with the documented package scripts
instead of edited by hand.