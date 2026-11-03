# Database Setup

Provision PostgreSQL, set `DATABASE_URL`, and apply the schema through the
project’s reviewed Drizzle/startup migration process. Prefer an isolated
database for restoration tests. Use `DATABASE/RESTORE_GUIDE.md` for a complete
recovery and never use `push-force` or destructive seed steps casually.