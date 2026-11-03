-- Surur-e-Man Radio Phase 2 foundation.
-- Reviewed additive migration only. Apply to an explicitly identified
-- non-production database after backup and schema verification.
-- No production migration is performed by Phase 2.

CREATE TABLE IF NOT EXISTS radio_audio (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  title_urdu TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  original_filename TEXT NOT NULL,
  object_key TEXT,
  upload_session_id TEXT,
  processed_object_key TEXT,
  object_version INTEGER NOT NULL DEFAULT 1,
  sha256 TEXT,
  size_bytes INTEGER,
  duration_ms INTEGER,
  container TEXT,
  codec TEXT,
  bitrate_kbps INTEGER,
  sample_rate_hz INTEGER,
  channels INTEGER,
  integrated_lufs REAL,
  true_peak_db REAL,
  normalization_status TEXT NOT NULL DEFAULT 'not_started',
  processing_status TEXT NOT NULL DEFAULT 'not_started',
  editorial_status TEXT NOT NULL DEFAULT 'draft',
  rights_status TEXT NOT NULL DEFAULT 'unknown',
  rights_notes TEXT,
  rights_valid_from TIMESTAMPTZ,
  rights_valid_until TIMESTAMPTZ,
  poet_id INTEGER REFERENCES poets(id) ON DELETE SET NULL,
  poem_id INTEGER REFERENCES poems(id) ON DELETE SET NULL,
  created_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  approved_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS radio_playlists (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'sequential',
  status TEXT NOT NULL DEFAULT 'draft',
  repeat_window INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS radio_playlist_items (
  id SERIAL PRIMARY KEY,
  playlist_id INTEGER NOT NULL REFERENCES radio_playlists(id) ON DELETE CASCADE,
  audio_id INTEGER NOT NULL REFERENCES radio_audio(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  weight INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  cue_in_ms INTEGER,
  cue_out_ms INTEGER,
  attribution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_radio_playlist_item_position UNIQUE (playlist_id, position)
);

CREATE TABLE IF NOT EXISTS radio_schedules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  playlist_id INTEGER NOT NULL REFERENCES radio_playlists(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft',
  timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
  days_of_week TEXT NOT NULL DEFAULT '[]',
  start_local_time TEXT NOT NULL,
  end_local_time TEXT NOT NULL,
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 0,
  program_name TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  attribution TEXT,
  created_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS radio_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS radio_play_history (
  id SERIAL PRIMARY KEY,
  audio_id INTEGER REFERENCES radio_audio(id) ON DELETE SET NULL,
  playlist_id INTEGER REFERENCES radio_playlists(id) ON DELETE SET NULL,
  schedule_id INTEGER REFERENCES radio_schedules(id) ON DELETE SET NULL,
  manifest_version INTEGER,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  expected_duration_ms INTEGER,
  actual_duration_ms INTEGER,
  result TEXT NOT NULL DEFAULT 'started',
  failure_code TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS radio_manifests (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  payload JSONB NOT NULL,
  sha256 TEXT NOT NULL,
  published_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radio_audio_editorial_status ON radio_audio(editorial_status);
CREATE INDEX IF NOT EXISTS idx_radio_audio_processing_status ON radio_audio(processing_status);
CREATE INDEX IF NOT EXISTS idx_radio_audio_rights_status ON radio_audio(rights_status);
CREATE INDEX IF NOT EXISTS idx_radio_audio_created_at ON radio_audio(created_at);
CREATE INDEX IF NOT EXISTS idx_radio_audio_poem_id ON radio_audio(poem_id);
CREATE INDEX IF NOT EXISTS idx_radio_playlists_status ON radio_playlists(status);
CREATE INDEX IF NOT EXISTS idx_radio_playlists_fallback ON radio_playlists(is_fallback);
CREATE INDEX IF NOT EXISTS idx_radio_playlist_items_audio ON radio_playlist_items(audio_id);
CREATE INDEX IF NOT EXISTS idx_radio_schedules_status ON radio_schedules(status);
CREATE INDEX IF NOT EXISTS idx_radio_schedules_effective ON radio_schedules(effective_from, effective_until);
CREATE INDEX IF NOT EXISTS idx_radio_play_history_started_at ON radio_play_history(started_at);
CREATE INDEX IF NOT EXISTS idx_radio_play_history_audio ON radio_play_history(audio_id);
CREATE INDEX IF NOT EXISTS idx_radio_manifests_status ON radio_manifests(status);