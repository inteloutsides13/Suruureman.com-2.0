// Read-only source audit. Never imports the application or @workspace/db's pool.
import { createRequire } from "node:module";
import pg from "pg";
import * as schema from "@workspace/db/schema";

const require = createRequire(import.meta.resolve("@workspace/db/schema"));
const { is } = require("drizzle-orm");
const { PgTable, getTableConfig } = require("drizzle-orm/pg-core");
const expected = Object.values(schema).filter((value) => is(value, PgTable)).map((table) => {
  const config = getTableConfig(table);
  return {
    name: config.name as string,
    schema: (config.schema ?? "public") as string,
    columns: config.columns.map((column: { name: string; notNull: boolean; getSQLType(): string }) => ({
      name: column.name, type: column.getSQLType(), required: column.notNull,
    })),
  };
});
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const safeCode = (error: unknown) => {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code) ? code : "UNCLASSIFIED";
};
const normalizeType = (type: string) => type.toLowerCase()
  .replace(/^serial$/, "integer")
  .replace(/^bigserial$/, "bigint")
  .replace(/^timestamp$/, "timestamp without time zone")
  .replace(/^timestamptz$/, "timestamp with time zone")
  .replace(/^varchar(?:\(\d+\))?$/, "character varying");

interface TableAudit {
  table: string;
  exists: boolean;
  missingColumns: string[];
  typeMismatches: { column: string; expected: string; actual: string }[];
  nullableRequiredColumns: string[];
  unexpectedRequiredColumns: string[];
  permissions: { select: boolean; insert: boolean; update: boolean; delete: boolean } | null;
  rowCount: string | null;
  countError: string | null;
}

async function main() {
  const result: Record<string, unknown> = {
    auditedAt: new Date().toISOString(),
    readOnly: true,
    connectionEstablished: false,
    status: "BLOCKED",
  };
  let client: pg.Client | undefined;
  let phase = "connection-validation";
  try {
    const connectionString = process.env.SOURCE_DATABASE_URL?.trim();
    if (!connectionString) throw Object.assign(new Error(), { code: "SOURCE_SECRET_MISSING" });
    const source = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(source.protocol)) {
      throw Object.assign(new Error(), { code: "INVALID_POSTGRES_CONNECTION" });
    }
    const destinationValue = process.env.DATABASE_URL;
    if (destinationValue) {
      const destination = new URL(destinationValue);
      const sameEndpoint = source.hostname === destination.hostname
        && (source.port || "5432") === (destination.port || "5432")
        && source.pathname === destination.pathname;
      result.matchesDestinationManagedEndpoint = sameEndpoint;
      if (sameEndpoint) throw Object.assign(new Error(), { code: "SOURCE_MATCHES_DESTINATION" });
    }
    result.providerFamily = source.hostname.endsWith(".neon.tech") ? "Neon"
      : source.hostname.endsWith(".supabase.co") || source.hostname.endsWith(".supabase.com") ? "Supabase"
      : "Other PostgreSQL";
    phase = "connect";
    client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000, application_name: "suruur_read_only_migration_audit" });
    client.on("error", () => { /* Do not print driver errors that may include credentials. */ });
    await client.connect();
    result.connectionEstablished = true;
    phase = "read-only-transaction";
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    const settings = await client.query("SELECT current_setting('transaction_read_only') AS read_only, current_setting('server_version_num') AS version");
    if (settings.rows[0].read_only !== "on") throw Object.assign(new Error(), { code: "READ_ONLY_NOT_ENFORCED" });
    result.readOnlyEnforced = true;
    result.postgresVersionNumber = settings.rows[0].version;
    phase = "schema-metadata";
    const tables = await client.query(`
      SELECT n.nspname AS schema, c.relname AS name,
             has_table_privilege(c.oid, 'SELECT') AS can_select,
             has_table_privilege(c.oid, 'INSERT') AS can_insert,
             has_table_privilege(c.oid, 'UPDATE') AS can_update,
             has_table_privilege(c.oid, 'DELETE') AS can_delete
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p') AND n.nspname = 'public' ORDER BY c.relname`);
    const columns = await client.query(`
      SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default, is_identity, is_generated
      FROM information_schema.columns WHERE table_schema = 'public'`);
    const constraints = await client.query(`
      SELECT contype, count(*)::int AS count FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' GROUP BY contype`);
    result.constraintCounts = Object.fromEntries(constraints.rows.map((row) => [row.contype, row.count]));
    const validation = await client.query(`
      SELECT count(*)::int AS unvalidated FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND c.contype = 'f' AND NOT c.convalidated`);
    result.unvalidatedForeignKeys = validation.rows[0].unvalidated;
    const report: TableAudit[] = [];
    for (const table of expected) {
      const found = tables.rows.find((row) => row.schema === table.schema && row.name === table.name);
      const actualColumns = columns.rows.filter((row) => row.table_schema === table.schema && row.table_name === table.name);
      const missingColumns = table.columns.filter((column: { name: string }) => !actualColumns.some((row) => row.column_name === column.name)).map((column: { name: string }) => column.name);
      const typeMismatches = table.columns.flatMap((column: { name: string; type: string }) => {
        const actual = actualColumns.find((row) => row.column_name === column.name);
        return actual && normalizeType(column.type) !== normalizeType(actual.data_type)
          ? [{ column: column.name, expected: column.type, actual: actual.data_type }] : [];
      });
      const nullableRequiredColumns = table.columns.filter((column: { name: string; required: boolean }) =>
        column.required && actualColumns.some((row) => row.column_name === column.name && row.is_nullable === "YES"))
        .map((column: { name: string }) => column.name);
      const unexpectedRequiredColumns = actualColumns.filter((row) =>
        !table.columns.some((column: { name: string }) => column.name === row.column_name)
        && row.is_nullable === "NO" && row.column_default === null
        && row.is_identity === "NO" && row.is_generated === "NEVER").map((row) => row.column_name);
      const item = {
        table: table.name, exists: Boolean(found), missingColumns, typeMismatches,
        nullableRequiredColumns, unexpectedRequiredColumns,
        permissions: found ? { select: found.can_select, insert: found.can_insert, update: found.can_update, delete: found.can_delete } : null,
        rowCount: null as string | null, countError: null as string | null,
      };
      if (found?.can_select) {
        phase = "aggregate-count";
        await client.query("SAVEPOINT audit_count");
        try {
          const count = await client.query(`SELECT count(*)::text AS total FROM ${quote(table.schema)}.${quote(table.name)}`);
          item.rowCount = count.rows[0].total;
        } catch (error) {
          item.countError = safeCode(error);
          await client.query("ROLLBACK TO SAVEPOINT audit_count");
        }
        await client.query("RELEASE SAVEPOINT audit_count");
      }
      report.push(item);
    }
    result.tables = report;
    result.publicTableCount = tables.rowCount;
    result.expectedTableCount = expected.length;
    result.status = report.every((table) => table.exists && table.permissions?.select && table.rowCount !== null
      && !table.missingColumns.length && !table.typeMismatches.length
      && !table.nullableRequiredColumns.length && !table.unexpectedRequiredColumns.length)
      ? "READ_ONLY_SCHEMA_COMPATIBLE" : "SCHEMA_OR_ACCESS_REVIEW_REQUIRED";
    const complete = (name: string) => report.some((table) => table.table === name
      && table.permissions?.select && table.missingColumns.length === 0);
    if (complete("admin_users")) {
      phase = "authentication-aggregate";
      const accounts = await client.query(`
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE role = 'developer')::int AS developer,
          count(*) FILTER (WHERE role = 'admin')::int AS admin,
          count(*) FILTER (WHERE role = 'contributor')::int AS contributor,
          count(*) FILTER (WHERE role NOT IN ('developer', 'admin', 'contributor'))::int AS unknown_role,
          count(*) FILTER (WHERE status = 'active')::int AS active,
          count(*) FILTER (WHERE status = 'disabled')::int AS disabled,
          count(*) FILTER (WHERE status = 'activation_pending')::int AS activation_pending,
          count(*) FILTER (WHERE password_hash ~ $1)::int AS bcrypt_hashes
        FROM public.admin_users`, ["^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$"]);
      result.accountAggregates = accounts.rows[0];
    }
    if (complete("poems")) {
      phase = "public-data-comparison";
      const published = await client.query("SELECT count(*)::int AS total FROM public.poems WHERE status = 'published'");
      result.publishedPoems = published.rows[0].total;
      try {
        const response = await fetch("https://suruureman.com/api/poems?sort=latest&limit=4", { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error();
        const data = await response.json() as { total: number; poems: { id: number }[] };
        const latest = await client.query("SELECT id FROM public.poems WHERE status = 'published' ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT 4");
        result.productionPublicComparison = {
          publishedCountMatches: published.rows[0].total === data.total,
          latestOrderMatches: JSON.stringify(latest.rows.map((row) => row.id)) === JSON.stringify(data.poems.map((poem) => poem.id)),
          individualRecordsPrinted: false,
        };
      } catch {
        result.productionPublicComparison = { status: "PUBLIC_API_COMPARISON_UNAVAILABLE" };
      }
    }
    await client.query("ROLLBACK");
    result.transactionRolledBack = true;
  } catch (error) {
    result.status = "BLOCKED";
    result.failedPhase = phase;
    result.errorCode = safeCode(error);
    result.errorMessage = "Audit stopped. Credentials, connection details, individual records, and driver error messages are intentionally withheld.";
    if (client) await client.query("ROLLBACK").catch(() => {});
    process.exitCode = 1;
  } finally {
    if (client) await client.end().catch(() => {});
  }
  console.log(JSON.stringify(result, null, 2));
}

await main();
