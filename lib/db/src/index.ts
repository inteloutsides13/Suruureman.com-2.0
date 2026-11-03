import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { resolveRadioScheduleDbConnection } from "./radioScheduleDbConnection";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: resolveRadioScheduleDbConnection(),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
