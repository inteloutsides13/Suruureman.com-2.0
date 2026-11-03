import type { RadioScheduleTestTarget } from "./radioScheduleTestTarget.js";
import {
  buildPre0004ColumnContract,
  type SchemaSnapshot,
  verifyPre0004Schema,
} from "./radioScheduleBaselineContract.js";
import type {
  RadioScheduleTestClient,
  RadioScheduleTestPool,
} from "./radioScheduleTestRunnerCore.js";

export type BaselineSetupDependencies = {
  pool: RadioScheduleTestPool;
  loadSql(): Promise<{ baseline: string; migrations: [string, string, string] }>;
  onSuccess(): void;
  onFailure(): void;
};

const EMPTY_PUBLIC_SCHEMA = `
  SELECT
    (SELECT count(*) FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public') AS relation_count,
    (SELECT count(*) FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public') AS routine_count,
    (SELECT count(*) FROM pg_catalog.pg_type t
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype <> 'p') AS type_count,
    (SELECT array_agg(nspname ORDER BY nspname)
       FROM pg_catalog.pg_namespace
      WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'public')
        AND nspname NOT LIKE 'pg_toast%') AS extra_schemas,
    current_schema() AS current_schema,
    current_schemas(false) AS search_path`;

const SNAPSHOT_QUERIES = {
  tables: `SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
  columns: `SELECT table_name AS table, column_name AS column, udt_name AS type,
      (is_nullable='YES') AS nullable, column_default AS "defaultValue"
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`,
  objects: `SELECT c.relname AS name FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('i','I')
    UNION SELECT con.conname FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class r ON r.oid=con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public'`,
  foreignKeys: `SELECT format('%s.%s>%s.%s:%s', src.relname, sa.attname, dst.relname, da.attname,
      CASE con.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
        WHEN 'r' THEN 'RESTRICT' WHEN 'a' THEN 'NO ACTION' WHEN 'd' THEN 'SET DEFAULT' END) AS key
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class src ON src.oid=con.conrelid
    JOIN pg_catalog.pg_namespace ns ON ns.oid=src.relnamespace
    JOIN pg_catalog.pg_class dst ON dst.oid=con.confrelid
    JOIN LATERAL unnest(con.conkey) WITH ORDINALITY sk(attnum, ord) ON true
    JOIN LATERAL unnest(con.confkey) WITH ORDINALITY dk(attnum, ord) ON dk.ord=sk.ord
    JOIN pg_catalog.pg_attribute sa ON sa.attrelid=src.oid AND sa.attnum=sk.attnum
    JOIN pg_catalog.pg_attribute da ON da.attrelid=dst.oid AND da.attnum=dk.attnum
    WHERE ns.nspname='public' AND con.contype='f'`,
  settings: `SELECT table_name AS table, column_name AS column,
      (is_nullable='YES') AS nullable, column_default AS "defaultValue"
    FROM information_schema.columns
    WHERE table_schema='public' AND
      ((table_name='radio_audio' AND column_name='category') OR
       (table_name='radio_schedules' AND column_name='timezone'))`,
};

function assertFreshDatabase(row: Record<string, unknown>, target: RadioScheduleTestTarget): void {
  if (row.database_name !== target.database || row.database_user !== target.user) {
    throw new Error("Connected database identity does not match the explicitly confirmed test target.");
  }
  if (row.current_schema !== "public" || !Array.isArray(row.search_path) ||
      row.search_path[0] !== "public") {
    throw new Error("The test target must use public as its first and current schema.");
  }
  if (Number(row.relation_count) !== 0 || Number(row.routine_count) !== 0 ||
      Number(row.type_count) !== 0 ||
      (Array.isArray(row.extra_schemas) && row.extra_schemas.length > 0)) {
    throw new Error("The test target is not a fresh database; no changes were made.");
  }
}

async function readSnapshot(client: RadioScheduleTestClient): Promise<SchemaSnapshot> {
  const [tables, columns, objects, foreignKeys, settings] = await Promise.all(
    Object.values(SNAPSHOT_QUERIES).map((query) => client.query(query)),
  );
  return {
    tables: tables.rows.map((row) => String(row.name)),
    columns: columns.rows.map((row) => ({
      table: String(row.table), column: String(row.column),
      type: String(row.type), nullable: row.nullable === true,
      defaultValue: row.defaultValue == null ? null : String(row.defaultValue),
    })),
    objects: objects.rows.map((row) => String(row.name)),
    foreignKeys: foreignKeys.rows.map((row) => String(row.key)),
    settings: settings.rows.map((row) => ({
      table: String(row.table), column: String(row.column),
      nullable: row.nullable === true,
      defaultValue: row.defaultValue == null ? null : String(row.defaultValue),
    })),
  };
}

export async function prepareRadioScheduleBaseline(
  target: RadioScheduleTestTarget,
  dependencies: BaselineSetupDependencies,
): Promise<boolean> {
  let client: RadioScheduleTestClient | undefined;
  try {
    client = await dependencies.pool.connect();
    const identity = await client.query(`SELECT current_database() AS database_name,
      current_user AS database_user, ${EMPTY_PUBLIC_SCHEMA.slice(EMPTY_PUBLIC_SCHEMA.indexOf("SELECT") + 6)}`);
    assertFreshDatabase(identity.rows[0] ?? {}, target);

    // All destructive-risk checks complete before any DDL file is loaded or executed.
    const sql = await dependencies.loadSql();
    const contract = buildPre0004ColumnContract(sql.baseline, sql.migrations);
    await client.query(sql.baseline);
    for (const migration of sql.migrations) {
      await client.query("BEGIN");
      try {
        await client.query(migration);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      }
    }
    const errors = verifyPre0004Schema(await readSnapshot(client), contract);
    if (errors.length) throw new Error("Pre-0004 schema verification failed.");
    dependencies.onSuccess();
    return true;
  } catch {
    try { dependencies.onFailure(); } catch { /* sanitized failure */ }
    return false;
  } finally {
    client?.release();
    await dependencies.pool.end().catch(() => undefined);
  }
}
