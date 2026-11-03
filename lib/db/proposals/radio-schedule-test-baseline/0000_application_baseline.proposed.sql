-- PROPOSAL ONLY — NOT APPROVED FOR EXECUTION.
-- Data-free application baseline for a newly provisioned, disposable
-- Radio Schedule integration-test database.
--
-- This file intentionally creates no roles, grants, users, poems, or other
-- records. It does not contain or apply Radio migrations 0001–0004.
-- After separate review/approval, the intended order is this file followed
-- by the existing migrations 0001, 0002, and 0003. Migration 0004 must remain
-- unapplied so the integration suite can test it.
--
-- Types for fields altered by artifacts/api-server/src/lib/migrations.ts
-- follow that executable startup-migration SQL where it conflicts with the
-- current Drizzle declarations. See README.md for the documented basis and
-- the unresolved poets.created_at sync-script compatibility issue.

BEGIN;

DO $baseline_guard$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname = 'public'
       AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f', 'i', 'I')
  ) THEN
    RAISE EXCEPTION
      'Proposed baseline requires an empty public schema; refusing to continue.';
  END IF;
END;
$baseline_guard$;

-- Radio migration 0001 references these application identities.
-- The poets.created_at discrepancy with scripts/src/sync-prod-to-dev.ts is
-- deliberately left out of this minimum Radio test baseline; see README.md.
CREATE TABLE public.admin_users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  notes TEXT,
  activation_pending_at TIMESTAMPTZ,
  token_revoked_at TIMESTAMPTZ,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE public.poets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_urdu TEXT NOT NULL,
  bio TEXT NOT NULL,
  bio_urdu TEXT NOT NULL,
  era TEXT NOT NULL
);

CREATE TABLE public.poems (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  title_urdu TEXT NOT NULL,
  content TEXT NOT NULL,
  poet_name TEXT NOT NULL,
  poet_name_urdu TEXT NOT NULL,
  category TEXT NOT NULL,
  category_urdu TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  visual_poetry BOOLEAN NOT NULL DEFAULT FALSE,
  language TEXT NOT NULL DEFAULT 'urdu',
  status TEXT NOT NULL DEFAULT 'published',
  created_by_user_id INTEGER
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  approved_by_user_id INTEGER
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by_user_id INTEGER
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_users_role_status
  ON public.admin_users(role, status);
CREATE INDEX idx_poems_status
  ON public.poems(status);
CREATE INDEX idx_poems_created_by
  ON public.poems(created_by_user_id);
CREATE INDEX idx_poems_public_latest
  ON public.poems(status, updated_at DESC, id DESC);

CREATE TABLE public.audit_logs (
  id SERIAL PRIMARY KEY,
  actor_user_id INTEGER
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor
  ON public.audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_created
  ON public.audit_logs(created_at DESC);

COMMIT;
