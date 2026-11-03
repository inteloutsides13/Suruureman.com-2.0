-- Extend the existing schedule table in place; preserve legacy schedules and IDs.
ALTER TABLE radio_schedules
  ALTER COLUMN playlist_id DROP NOT NULL,
  ALTER COLUMN timezone SET DEFAULT 'Asia/Dubai',
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS title_ur TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_ur TEXT,
  ADD COLUMN IF NOT EXISTS programme_type TEXT,
  ADD COLUMN IF NOT EXISTS poet_name TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS schedule_type TEXT NOT NULL DEFAULT 'WEEKLY',
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS public_note TEXT;

CREATE INDEX IF NOT EXISTS idx_radio_schedules_programme_status_date
  ON radio_schedules(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_radio_schedules_schedule_type
  ON radio_schedules(schedule_type);
