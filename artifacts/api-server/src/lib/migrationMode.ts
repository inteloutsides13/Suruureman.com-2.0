export function isReadOnlyMigrationPreview(): boolean {
  return process.env.MIGRATION_DATABASE_STRATEGY === "reuse-original"
    && process.env.MIGRATION_DATABASE_READ_ONLY !== "false";
}
