# Backup Scripts

`schema-only.sh` creates an explicit-confirmation, schema-only PostgreSQL dump.
It does not export rows and never prints `DATABASE_URL`.

Example:

```bash
CONFIRM_SCHEMA_BACKUP=YES \
SCHEMA_BACKUP_OUTPUT=/secure/operator/path/suruureman-schema.sql \
bash MASTER_BACKUP/SCRIPTS/backup/schema-only.sh
```

Keep the output outside Git and protect it as operational backup material.