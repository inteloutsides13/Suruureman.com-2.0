#!/usr/bin/env bash
set -euo pipefail

# Prints only variable names and presence. It never prints values.
required=(DATABASE_URL)
if [[ "${REQUIRE_PRODUCTION:-NO}" == "YES" ]]; then
  required+=(JWT_SECRET)
fi

missing=0
for name in "${required[@]}"; do
  if [[ -n "${!name:-}" ]]; then
    echo "$name: present"
  else
    echo "$name: missing"
    missing=1
  fi
done

optional=(NODE_ENV PORT CORS_ORIGINS PUBLIC_APP_URL SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASSWORD MAIL_FROM MAIL_FROM_NAME RADIO_ENABLED RADIO_PUBLIC_STREAM_URL RADIO_SCHEDULE_TIMEZONE RADIO_ADMIN_PERMISSIONS RADIO_INTERNAL_API_URL RADIO_MACHINE_ID RADIO_MACHINE_SECRET RADIO_STORAGE_PROVIDER RADIO_MONITORING_ENABLED RADIO_ALERT_WEBHOOK_URL)
for name in "${optional[@]}"; do
  if [[ -n "${!name:-}" ]]; then
    echo "$name: present"
  else
    echo "$name: absent"
  fi
done

exit "$missing"