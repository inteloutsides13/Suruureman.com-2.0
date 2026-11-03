#!/usr/bin/env bash
set -euo pipefail

# Applies a schema-only dump to an explicitly named target. This is intentionally
# not an application/data restore and requires two explicit inputs.
if [[ "${CONFIRM_SCHEMA_RESTORE:-}" != "YES" ]]; then
  echo "Set CONFIRM_SCHEMA_RESTORE=YES to apply a schema-only dump." >&2
  exit 2
fi
if [[ -z "${TARGET_DATABASE_URL:-}" || -z "${SCHEMA_BACKUP_INPUT:-}" ]]; then
  echo "TARGET_DATABASE_URL and SCHEMA_BACKUP_INPUT are required; values are never printed." >&2
  exit 2
fi
if [[ ! -f "$SCHEMA_BACKUP_INPUT" ]]; then
  echo "Schema backup file does not exist." >&2
  exit 2
fi

psql "$TARGET_DATABASE_URL" --set=ON_ERROR_STOP=1 --file="$SCHEMA_BACKUP_INPUT"
echo "Schema-only restore completed."