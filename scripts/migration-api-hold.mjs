// Temporary migration safety gate. Does not import the app, access a database,
// run migrations, or seed data. Remove from service commands only after a
// verified database strategy and safe application startup are established.
import { createServer } from "node:http";

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("A valid PORT is required for the migration safety gate.");
}

createServer((_request, response) => {
  response.writeHead(503, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify({
    code: "MIGRATION_API_DISABLED",
    error: "Original-database reuse is approved. Production remains disabled pending remaining service configuration, live verification, and publishing approval. Development can serve original records read-only. This safety-gate service does not access a database or run migrations or seeds.",
  }));
}).listen(port, "0.0.0.0", () => {
  process.stderr.write("Migration safety gate active: application startup, database access, migrations, and seeds are disabled.\n");
});
