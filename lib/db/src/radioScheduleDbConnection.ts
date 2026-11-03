import { resolveDatabaseConnection } from "./connection.js";
import { resolveRadioScheduleTestTarget } from "./radioScheduleTestTarget.js";

export function resolveRadioScheduleDbConnection(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!Object.hasOwn(env, "RADIO_SCHEDULE_DB_TEST_MODE")) {
    return resolveDatabaseConnection(env);
  }
  if (env.RADIO_SCHEDULE_DB_TEST_MODE !== "1") {
    throw new Error(
      "Radio Schedule integration database mode must be explicitly enabled.",
    );
  }
  return resolveRadioScheduleTestTarget(env).connectionString;
}
