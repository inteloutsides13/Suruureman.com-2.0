# Radio Schedule verification on Replit Development

This is a separate, opt-in entrypoint for the Replit-managed Development database. It reads only the platform-selected `DATABASE_URL`; it never falls back to `SOURCE_DATABASE_URL` and does not use the API workflow's `MIGRATION_DATABASE_STRATEGY`.

## Before authorizing a run

1. In this Repl, open the Database pane and select **Development** in its environment selector.
2. Confirm the Repl/project identity and the **Development** environment label in the pane. Do not infer isolation from a hostname or database name.
3. Confirm the Replit Development workspace is open. The entrypoint also requires Replit's `REPLIT_DEV_DOMAIN` marker.
4. Only after those checks, run the dedicated command below from the Replit Development workspace. The approval values are command-scoped; they do not change `.replit`, shared variables, Secrets, or the API workflow.

```sh
RADIO_SCHEDULE_DEV_DATABASE_APPROVAL=I_APPROVE_RADIO_SCHEDULE_MIGRATION_ON_REPLIT_DEVELOPMENT \
RADIO_SCHEDULE_DEV_DATABASE_TARGET=DEVELOPMENT_SELECTED_IN_REPLIT_DATABASE_PANE \
pnpm --filter @workspace/api-server run radio-schedule:verify:replit-development
```

The process refuses to proceed without both exact approval values, `REPLIT_DEV_DOMAIN`, and `DATABASE_URL`. It validates PostgreSQL URL syntax, requires explicit secure TLS, and rejects URL parameters that can override the target. It does not require a test-looking host or database name. A database error is sanitized in the runner output.

The existing API workflow continues using its existing migration-safe entrypoint and source-database strategy; do not use that workflow for this verification. This entrypoint applies only migration `0004_radio_programme_schedule.sql` after checking the connected database/user and the baseline Radio Schedule table. It does not seed, truncate, drop, or reset data.

The Replit Database pane's Development selection and Replit's environment-selected `DATABASE_URL` are the operator/provider trust boundary. The runner cannot independently attest to a provider resource ID without connecting; never authorize it unless the pane confirms Development for this Repl.
