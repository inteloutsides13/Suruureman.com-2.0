# Radio Configuration

## Environment names

- `RADIO_ENABLED`
- `RADIO_PUBLIC_STREAM_URL`
- `RADIO_SCHEDULE_TIMEZONE` (default `Europe/Berlin`)
- `RADIO_ADMIN_PERMISSIONS`
- `RADIO_INTERNAL_API_URL`
- `RADIO_MACHINE_ID`
- `RADIO_MACHINE_SECRET`
- `RADIO_STORAGE_PROVIDER`
- `RADIO_MONITORING_ENABLED`
- `RADIO_ALERT_WEBHOOK_URL`

## Editorial behavior

- Audio moves through draft/uploading/quarantined/processing/ready-for-review/
  approved/rejected/inactive/archived states.
- Rights are unknown/cleared/restricted/expired/takedown.
- Processing is not-started/uploaded/quarantined/processing/ready/failed.
- Playlists support sequential, weighted, and random modes.
- Schedules store local day/time windows, effective dates, priority, and timezone.
- Default timezone is Europe/Berlin; same-day end times are exclusive.
- Emergency state is an editorial setting and must not be presented as proof of
  a working playback provider.