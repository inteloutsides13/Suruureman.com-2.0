# Radio Programme Calendar

The calendar uses the existing Surrur-e-Mann PostgreSQL database through the shared `@workspace/db` pool. It adds only the `radio_calendar_programmes` table; it does not alter existing tables or records. The API never creates schema automatically.

## Manual setup required

After reviewing the DDL, an operator must manually create `radio_calendar_programmes` in the existing website database using `docs/radio-calendar-schema.sql`. This file contains one `CREATE TABLE` statement and must not be run through Drizzle push or application startup.

The calendar uses the same resolved connection and read-only safeguards as the rest of the API. Writes are refused in the configured read-only migration preview. No database setup is performed automatically.

## Model

`radio_calendar_programmes` has only: identity `id`; English/Urdu title and description; programme type; date; start/end time; fixed `Europe/Berlin` timezone; optional external link and public note; draft/published/cancelled status; and created/updated timestamps. Calendar dates and current date calculations use the IANA timezone so CET/CEST transitions are respected.

Public reads return published rows for a seven-date range. Admin and Developer writes use the existing `requireAdmin` middleware, which retains its existing JWT, active-account, and revocation checks. GoCast playback and radio status are separate and unchanged.

