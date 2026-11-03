# Clone Verification Checklist

- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] `pnpm run typecheck` succeeds.
- [ ] `pnpm run build` succeeds.
- [ ] API `/api/healthz` responds.
- [ ] Home, poetry, poet, video, search, contact, and radio routes load.
- [ ] Public content reads and contact submission behave as expected.
- [ ] Admin login, role guards, CRUD, analytics, and settings work.
- [ ] Contributor application, terms recording, status lookup, approval,
      activation, and portal work.
- [ ] Approval email uses a test mailbox and never logs credentials.
- [ ] Developer snapshot boundaries are understood and restore is isolated.
- [ ] Radio editorial routes enforce permissions and fail closed without storage.
- [ ] `git diff --check` is clean.
- [ ] No secret values or live data dumps are in the clone.