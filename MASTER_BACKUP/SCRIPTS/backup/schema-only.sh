#!/usr/bin/env bash
set -euo pipefail

# Creates a schema-only PostgreSQL dump. It does not export application data.
# Explicit confirmation is required so this cannot run accidentally.
if [[ "${CONFIRM_SCHEMA_BACKUP:-}" != "YES" ]]; then
  echo "Set CONFIRM_SCHEMA_BACKUP=YES to create a schema-only dump." >&2
  exit 2
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required; its value is never printed." >&2
  exit 2
fi

output="${SCHEMA_BACKUP_OUTPUT:-/tmp/suruureman-schema.sql}"
umask 077
mkdir -p "$(dirname "$output")"
pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > "$output"
echo "Schema-only dump written to $output"