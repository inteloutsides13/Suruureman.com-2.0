// Approved migration entrypoint: deliberately does not import index or migrations.
async function start() {
  if (process.env.MIGRATION_DATABASE_STRATEGY !== "reuse-original") {
    throw new Error("Approved original-database reuse must be explicitly configured.");
  }
  if (!process.env.JWT_SECRET?.trim()) throw new Error("The original JWT_SECRET must be configured before application startup.");
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("A valid PORT is required.");
  const { pool } = await import("@workspace/db");
  const { isReadOnlyMigrationPreview } = await import("./lib/migrationMode.js");
  try {
    const settings = await pool.query("SELECT current_setting('default_transaction_read_only') AS read_only");
    if (settings.rows[0].read_only !== (isReadOnlyMigrationPreview() ? "on" : "off")) {
      throw new Error("The configured database write policy was not established.");
    }
    const { default: app } = await import("./app.js");
    const server = app.listen(port, "0.0.0.0", () => {
      console.info(`Migration-safe API started; migrations/seeds disabled; read-only preview: ${isReadOnlyMigrationPreview()}.`);
    });
    server.on("error", async () => {
      console.error("Migration-safe API could not listen. Connection details are withheld.");
      await pool.end();
      process.exitCode = 1;
    });
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      process.once(signal, () => {
        server.close(() => { void pool.end(); });
      });
    }
  } catch {
    await pool.end();
    throw new Error("Migration-safe API startup failed. Connection details are withheld.");
  }
}

start().catch(() => {
  console.error("Migration-safe API remains disabled. Verify approved database configuration and the original JWT_SECRET. No migrations or seeds were run.");
  process.exitCode = 1;
});
