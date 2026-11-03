export function resolveDatabaseConnection(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const strategy = env.MIGRATION_DATABASE_STRATEGY;
  if (!strategy) {
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL must be configured.");
    return env.DATABASE_URL;
  }
  if (strategy !== "reuse-original") {
    throw new Error("Unsupported migration database strategy.");
  }
  const source = env.SOURCE_DATABASE_URL?.trim();
  if (!source)
    throw new Error(
      "SOURCE_DATABASE_URL is required for approved original-database reuse.",
    );
  const readOnly = env.MIGRATION_DATABASE_READ_ONLY ?? "true";
  if (!["true", "false"].includes(readOnly))
    throw new Error("Migration read-only setting must be true or false.");
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error("The approved source database connection is invalid.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("A PostgreSQL connection is required.");
  if (readOnly === "true") {
    const options = url.searchParams.get("options") ?? "";
    url.searchParams.set(
      "options",
      `${options} -c default_transaction_read_only=on`.trim(),
    );
  }
  return url.toString();
}
