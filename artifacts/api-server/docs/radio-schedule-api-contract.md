# Radio status and programme schedule API contract

## Broadcast status versus programme schedule

`GET /api/radio/status` is the existing endpoint used by `useRadioStatus` on the public Radio page and by the player. It returns station configuration, a configured public stream URL (when enabled and valid), configured now-playing metadata, and legacy active-playlist schedule occurrences. Its `status` is `available` or `offline` based on whether a usable stream URL is configured. It does **not** probe GoCast, verify that audio is reaching listeners, or establish that a live broadcast is on air. The endpoint currently does not return `isLive`; the hook treats live state as unknown when a stream is configured.

There is currently no endpoint that independently verifies the actual broadcast/provider state. Do not use the programme calendar or the configured-stream `available` flag as proof that a broadcast is live.

The new public programme endpoints are:

| Endpoint                                              | Response shape                                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/radio/schedule/today`                       | `{ date: "YYYY-MM-DD", timezone: "Asia/Dubai", programmes: ProgrammeOccurrence[] }`                                                        |
| `GET /api/radio/schedule/weekly?startDate=YYYY-MM-DD` | `{ startDate: "YYYY-MM-DD", timezone: "Asia/Dubai", programmes: ProgrammeOccurrence[] }` (seven dates, flattened and sorted by `startsAt`) |
| `GET /api/radio/schedule/date/:date`                  | `{ date: "YYYY-MM-DD", timezone: "Asia/Dubai", programmes: ProgrammeOccurrence[] }`                                                        |
| `GET /api/radio/schedule/current`                     | `{ timezone: "Asia/Dubai", currentlyScheduledProgramme: ProgrammeOccurrence \| null }`                                                     |
| `GET /api/radio/schedule/next`                        | `{ timezone: "Asia/Dubai", nextScheduledProgramme: ProgrammeOccurrence \| null }`                                                          |
| `GET /api/radio/schedule/upcoming?limit=20`           | `{ timezone: "Asia/Dubai", programmes: ProgrammeOccurrence[] }`; `limit` must be an integer from 1 to 100.                                 |

`ProgrammeOccurrence` is the public, per-date calendar item:

```ts
type ProgrammeOccurrence = {
  id: number;
  titleEn: string;
  titleUr: string;
  descriptionEn: string | null;
  descriptionUr: string | null;
  programmeType: string;
  poetName: string | null;
  externalUrl: string | null;
  thumbnailUrl: string | null;
  publicNote: string | null;
  scheduleType: "WEEKLY" | "ONE_TIME";
  date: string; // YYYY-MM-DD in Asia/Dubai
  startLocalTime: string; // HH:mm
  endLocalTime: string; // HH:mm
  startsAt: string; // ISO UTC instant
  endsAt: string; // ISO UTC instant; next calendar day for overnight programmes
  timezone: "Asia/Dubai";
};
```

Only `published` programme rows are included. Weekly rows expand on matching weekdays; one-time rows expand only on their scheduled date. Draft and cancelled rows are private to the admin API. The endpoints send `Cache-Control: no-store`.

## Existing frontend contract and calendar connection

`useRadioStatus` currently requests only `/api/radio/status`. Its `schedules` entries are legacy active-playlist records (`name`, `daysOfWeek`, `startLocalTime`, `endLocalTime`, effective dates, priority, and optional occurrence state/timestamps). They are not `ProgrammeOccurrence` items and must not be treated as the new programme calendar.

No backend endpoint change is needed for a public calendar to consume published programmes. The future frontend should call the public schedule endpoint(s) directly and use the response shapes above; it should not infer programme data from `/api/radio/status` or interpret stream availability as live status. This task intentionally does not add that UI or change the existing GoCast player.

## Admin API

Programme management is mounted under `/api/admin/radio` and requires an active Admin or Developer session plus the `radio.schedules.manage` permission for Admins (Developers bypass that permission check). The list/detail/write routes return `{ programmes, limit, offset, total }`, `{ programme }`, validation `{ valid, conflicts }`, or an error `{ message, ... }`. Publish, unpublish, and cancel are POST actions on `/programmes/:id/{publish,unpublish,cancel}`. Cancellation is a status transition; the current API does not expose a hard-delete route.

## Integration-suite guard and limitations

The separate `test:radio-schedule:integration` command is intentionally not part of the default test command. It requires the existing explicit test-target approval and identity settings, refuses source/migration-selection settings and runtime target aliases, and requires a fresh disposable PostgreSQL database provisioned with the application schema plus Radio migrations 0001–0003. In integration mode, the DB package resolves only the dedicated test target; it does not call the application's normal database resolver or use `SOURCE_DATABASE_URL`. The suite applies migration 0004, checks its post-migration schema, applies it a second time, and removes only rows created by the suite. It never drops tables or columns. The guard verifies the configured host/database/user and explicit operator confirmation, but cannot independently prove the provider resource identity or detect DNS aliases; the operator must ensure the target is physically separate from source and production. Provision a new disposable test database for a fresh pre-0004 migration run; this test suite has not been run as part of the implementation task.
