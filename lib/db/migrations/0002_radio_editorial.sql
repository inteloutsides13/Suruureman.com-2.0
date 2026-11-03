-- Surur-e-Man Radio Phase 4 additive editorial fields.
-- Existing records remain valid because category is nullable.

ALTER TABLE radio_audio
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_radio_audio_category ON radio_audio(category);