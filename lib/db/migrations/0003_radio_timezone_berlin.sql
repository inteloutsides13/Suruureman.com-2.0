-- Surrur-e-Mann Radio Phase 5A timezone correction.
-- The application contract uses Europe/Berlin as the canonical station timezone.
-- This changes only the default for future rows; existing schedule records are untouched.

ALTER TABLE IF EXISTS radio_schedules
  ALTER COLUMN timezone SET DEFAULT 'Europe/Berlin';