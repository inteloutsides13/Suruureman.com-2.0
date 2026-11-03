// Explicit, read-only verification utility; never imported by app startup.
// Ephemeral JWTs are kept private for browser verification and never logged.
import { mkdir, writeFile } from "node:fs/promises";
import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";

async function main() {
  if (process.env.MIGRATION_DATABASE_STRATEGY !== "reuse-original" ||
      process.env.MIGRATION_DATABASE_READ_ONLY !== "true" || !process.env.JWT_SECRET) {
    throw new Error("Read-only verification configuration is required.");
  }
  const setting = await pool.query("SELECT current_setting('default_transaction_read_only') AS policy");
  if (setting.rows[0].policy !== "on") throw new Error("Database must enforce read-only mode.");
  const before = await pool.query("SELECT count(*)::int AS total FROM poems WHERE status = 'published'");
  const accounts = await pool.query("SELECT id, email, role, name FROM admin_users WHERE status = 'active' AND role IN ('developer','admin','contributor') ORDER BY id");
  const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const sessions: Record<string, { token: string; role: string }> = {};
  for (const role of ["developer", "admin", "contributor"]) {
    const account = accounts.rows.find((row) => row.role === role);
    if (!account) {
      console.log(JSON.stringify({ role, status: "no-active-account" }));
      continue;
    }
    const token = jwt.sign({ userId: account.id, email: account.email, role, name: account.name },
      process.env.JWT_SECRET, { expiresIn: "15m" });
    // Invalid input exercises real signature, role, active-account and revocation
    // checks, without invoking Gemini or storing any text.
    const response = await fetch(`${base}/api/irab/text`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: "" }), signal: AbortSignal.timeout(15000),
    });
    console.log(JSON.stringify({ role, authorizationPassed: response.status === 400, httpStatus: response.status }));
    if (response.status === 400) sessions[role] = { token, role };
  }
  await mkdir("../../.local/irab-verification", { recursive: true, mode: 0o700 });
  await writeFile("../../.local/irab-verification/sessions.json", JSON.stringify(sessions), { mode: 0o600 });
  const developer = sessions.developer;
  if (developer) {
    const response = await fetch(`${base}/api/irab/text`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${developer.token}` },
      body: JSON.stringify({ text: "یہ ایک کتاب ہے" }), signal: AbortSignal.timeout(40000),
    });
    const body = await response.json() as { success?: boolean; text?: string };
    console.log(JSON.stringify({ check: "real-Gemini-through-protected-API", httpStatus: response.status,
      successfulGuardedResult: response.ok && body.success === true && typeof body.text === "string" }));
  }
  const after = await pool.query("SELECT count(*)::int AS total FROM poems WHERE status = 'published'");
  console.log(JSON.stringify({ databasePolicy: "read-only", publishedCountBefore: before.rows[0].total,
    publishedCountAfter: after.rows[0].total, databaseWritesPerformed: false }));
}
main().catch(() => { console.error("Read-only verification failed; credentials and account details withheld."); process.exitCode = 1; })
  .finally(() => pool.end());
