import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { usersTable, toolsTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { runMigrations } from "./lib/migrations.js";

if (process.env.MIGRATION_DATABASE_STRATEGY === "reuse-original") {
  throw new Error("Original-database reuse must use the migration-safe entrypoint. Automatic migrations and seeds are disabled.");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedUsers() {
  try {
    const [{ total }] = await db.select({ total: count() }).from(usersTable);
    if (Number(total) > 0) {
      logger.info("Admin users already exist — skipping seed");
      return;
    }
    const devPassword = process.env.SEED_DEV_PASSWORD;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!devPassword || !adminPassword) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("SEED_DEV_PASSWORD and SEED_ADMIN_PASSWORD are required when seeding production users");
      }
      logger.warn("Seed passwords are not configured; skipping initial privileged-user seed");
      return;
    }
    const devHash = await bcrypt.hash(devPassword, 12);
    const adminHash = await bcrypt.hash(adminPassword, 12);
    await db.insert(usersTable).values([
      { email: "intel.outsides@gmail.com", passwordHash: devHash, role: "developer", name: "Developer" },
      { email: "info@suruureman.com", passwordHash: adminHash, role: "admin", name: "Administrator" },
    ]).onConflictDoNothing();
    logger.info("Admin users seeded successfully");
  } catch (err) {
    if (process.env.NODE_ENV === "production" && err instanceof Error && err.message.includes("SEED_")) {
      throw err;
    }
    logger.error({ err }, "Failed to seed admin users — server will start anyway");
  }
}

async function seedTools() {
  try {
    const [{ total }] = await db.select({ total: count() }).from(toolsTable);
    if (Number(total) > 0) {
      logger.info("Tools already exist — skipping seed");
      return;
    }
    await db.insert(toolsTable).values({
      title: "e'raab Tool",
      titleUrdu: "اِعْراب",
      description: "Online tool for adding correct diacritical marks to Urdu text.",
      descriptionUrdu: "اردو متن میں خودکار اِعْراب شامل کرنے کا آن لائن ٹول",
      url: "https://aeraabrestor-4wqqnaqg.manus.space/",
      active: true,
      displayOrder: 1,
    }).onConflictDoNothing();
    logger.info("Aeraab Tool seeded successfully");
  } catch (err) {
    logger.error({ err }, "Failed to seed tools — server will start anyway");
  }
}

// Run migrations first, then seed, then start server
runMigrations()
  .then(() => seedUsers())
  .then(() => seedTools())
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  });
