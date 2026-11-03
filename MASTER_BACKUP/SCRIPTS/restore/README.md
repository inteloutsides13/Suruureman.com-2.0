# Restore Scripts

`schema-only.sh` applies only a schema dump after two explicit confirmations
through environment variables. It does not restore rows and does not start or
modify the application.

```bash
CONFIRM_SCHEMA_RESTORE=YES \
TARGET_DATABASE_URL='<operator-managed-value>' \
SCHEMA_BACKUP_INPUT=/secure/operator/path/suruureman-schema.sql \
bash MASTER_BACKUP/SCRIPTS/restore/schema-only.sh
```

Use an isolated target for testing. Do not place connection strings in shell
history, logs, Git, or chat.