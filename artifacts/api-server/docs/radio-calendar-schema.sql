-- Manually apply to the existing Surrur-e-Mann PostgreSQL database only after review.
-- This creates only the Radio Calendar table; do not run via migrations or application startup.
CREATE TABLE radio_calendar_programmes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  description_en TEXT,
  description_ur TEXT,
  programme_type TEXT NOT NULL CHECK (programme_type IN (
    'Auto DJ', 'Live Radio', 'Recorded Show', 'Poetry Hour', 'TikTok Live', 'Announcement/Break'
  )),
  programme_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time <> start_time),
  timezone TEXT NOT NULL DEFAULT 'Europe/Berlin' CHECK (timezone = 'Europe/Berlin'),
  external_link TEXT,
  public_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
