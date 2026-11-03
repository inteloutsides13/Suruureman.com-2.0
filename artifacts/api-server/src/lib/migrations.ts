import { pool } from "@workspace/db";
import { logger } from "./logger.js";

/**
 * Idempotent migration for the Contributor Management System.
 * Safe to run multiple times — uses IF NOT EXISTS for all changes.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info("Running contributor system migrations...");

    await client.query(`
      -- ─── admin_users: new columns ────────────────────────────────
      ALTER TABLE admin_users
        ADD COLUMN IF NOT EXISTS status           TEXT    NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS last_login_at   TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS notes           TEXT,
        ADD COLUMN IF NOT EXISTS token_revoked_at TIMESTAMPTZ;

      -- ─── poems: contributor approval workflow columns ─────────────
      ALTER TABLE poems
        ADD COLUMN IF NOT EXISTS status              TEXT NOT NULL DEFAULT 'published',
        ADD COLUMN IF NOT EXISTS created_by_user_id  INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejected_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS rejected_at         TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason    TEXT;

      -- ─── poems: latest public activity timestamp ───────────────────
      -- Backfill existing records from their original posting time so
      -- introducing this field does not reshuffle historical poems.
      ALTER TABLE poems
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
      UPDATE poems SET updated_at = created_at WHERE updated_at IS NULL;
      ALTER TABLE poems
        ALTER COLUMN updated_at SET DEFAULT NOW(),
        ALTER COLUMN updated_at SET NOT NULL;

      -- ─── audit_logs: new table ────────────────────────────────────
      CREATE TABLE IF NOT EXISTS audit_logs (
        id            SERIAL PRIMARY KEY,
        actor_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        action        TEXT NOT NULL,
        target_type   TEXT,
        target_id     INTEGER,
        metadata      TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ─── contributor applications and activation ──────────────────
      ALTER TABLE admin_users
        ADD COLUMN IF NOT EXISTS activation_pending_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS contributor_applications (
        id                      SERIAL PRIMARY KEY,
        full_name               TEXT NOT NULL,
        email                   TEXT NOT NULL,
        date_of_birth           DATE,
        contact_information     TEXT,
        bio                     TEXT NOT NULL,
        contribution_area       TEXT NOT NULL,
        preferred_language      TEXT NOT NULL,
        category                TEXT NOT NULL,
        portfolio               TEXT,
        terms_version           TEXT NOT NULL,
        terms_accepted_at       TIMESTAMPTZ NOT NULL,
        status                  TEXT NOT NULL DEFAULT 'pending',
        rejection_reason        TEXT,
        reviewed_by_user_id     INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        reviewed_at             TIMESTAMPTZ,
        user_id                 INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        activation_token_hash   TEXT,
        activation_token_ciphertext TEXT,
        activation_expires_at   TIMESTAMPTZ,
        activation_used_at      TIMESTAMPTZ,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE contributor_applications
        ADD COLUMN IF NOT EXISTS date_of_birth DATE,
        ADD COLUMN IF NOT EXISTS activation_token_ciphertext TEXT;

      -- ─── Performance indexes ──────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_admin_users_role_status ON admin_users(role, status);
      CREATE INDEX IF NOT EXISTS idx_poems_status             ON poems(status);
      CREATE INDEX IF NOT EXISTS idx_poems_created_by        ON poems(created_by_user_id);
      CREATE INDEX IF NOT EXISTS idx_poems_public_latest     ON poems(status, updated_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor        ON audit_logs(actor_user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created      ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_contributor_applications_status ON contributor_applications(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_contributor_applications_email ON contributor_applications(email);
      CREATE INDEX IF NOT EXISTS idx_contributor_applications_token ON contributor_applications(activation_token_hash);
    `);

    logger.info("Contributor system migrations complete");
  } catch (err: any) {
    logger.error({ err: err?.message }, "Migration error — server will continue");
  } finally {
    client.release();
  }
}
