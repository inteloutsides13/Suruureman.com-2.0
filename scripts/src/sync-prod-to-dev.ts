import { Pool } from "pg";

// This script syncs PRODUCTION → DEV. Production is treated as source of truth.
// Run with: PROD_DATABASE_URL=<prod_url> DATABASE_URL=<dev_url> pnpm --filter @workspace/scripts run sync-prod-to-dev

const PROD_URL = process.env.PROD_DATABASE_URL;
const DEV_URL = process.env.DATABASE_URL;

if (!PROD_URL || !DEV_URL) {
  console.error("❌ PROD_DATABASE_URL and DATABASE_URL must both be set");
  process.exit(1);
}

const prod = new Pool({ connectionString: PROD_URL, max: 3 });
const dev = new Pool({ connectionString: DEV_URL, max: 3 });

async function query(pool: Pool, sql: string, params?: any[]) {
  const r = await pool.query(sql, params);
  return r.rows;
}

async function main() {
  const devClient = await dev.connect();

  try {
    await devClient.query("BEGIN");

    // Clear dev tables in FK-safe order
    console.log("🗑️  Clearing dev tables...");
    await devClient.query("DELETE FROM events");
    await devClient.query("DELETE FROM contact_messages");
    await devClient.query("DELETE FROM settings");
    await devClient.query("DELETE FROM poems");
    await devClient.query("DELETE FROM poets");
    await devClient.query("DELETE FROM videos");
    await devClient.query("DELETE FROM categories");
    console.log("✅ Dev tables cleared");

    // CATEGORIES
    const categories = await query(prod, "SELECT * FROM categories ORDER BY id");
    for (const r of categories) {
      await devClient.query(
        `INSERT INTO categories (id, name, name_urdu, slug, description)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET name=$2, name_urdu=$3, slug=$4, description=$5`,
        [r.id, r.name, r.name_urdu, r.slug, r.description]
      );
    }
    console.log(`✅ categories: ${categories.length} rows`);

    // POETS
    const poets = await query(prod, "SELECT * FROM poets ORDER BY id");
    for (const r of poets) {
      await devClient.query(
        `INSERT INTO poets (id, name, name_urdu, bio, bio_urdu, era, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET name=$2, name_urdu=$3, bio=$4, bio_urdu=$5, era=$6`,
        [r.id, r.name, r.name_urdu, r.bio, r.bio_urdu, r.era, r.created_at]
      );
    }
    console.log(`✅ poets: ${poets.length} rows`);

    // POEMS
    const poems = await query(prod, "SELECT * FROM poems ORDER BY id");
    for (const r of poems) {
      await devClient.query(
        `INSERT INTO poems (id, title, title_urdu, content, poet_name, poet_name_urdu,
           category, category_urdu, featured, image_url, likes, views, shares, visual_poetry, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET
           title=$2, title_urdu=$3, content=$4, poet_name=$5, poet_name_urdu=$6,
           category=$7, category_urdu=$8, featured=$9, image_url=$10,
           likes=$11, views=$12, shares=$13, visual_poetry=$14`,
        [r.id, r.title, r.title_urdu, r.content, r.poet_name, r.poet_name_urdu,
         r.category, r.category_urdu, r.featured, r.image_url,
         r.likes, r.views, r.shares, r.visual_poetry, r.created_at]
      );
    }
    console.log(`✅ poems: ${poems.length} rows`);

    // VIDEOS
    const videos = await query(prod, "SELECT * FROM videos ORDER BY id");
    for (const r of videos) {
      await devClient.query(
        `INSERT INTO videos (id, title, title_urdu, description, youtube_id, thumbnail_url, duration, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET title=$2, title_urdu=$3, description=$4, youtube_id=$5, thumbnail_url=$6, duration=$7`,
        [r.id, r.title, r.title_urdu, r.description, r.youtube_id, r.thumbnail_url, r.duration, r.created_at]
      );
    }
    console.log(`✅ videos: ${videos.length} rows`);

    // EVENTS
    const events = await query(prod, "SELECT * FROM events ORDER BY id");
    for (const r of events) {
      await devClient.query(
        `INSERT INTO events (id, type, poem_id, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [r.id, r.type, r.poem_id, r.created_at]
      );
    }
    console.log(`✅ events: ${events.length} rows`);

    // CONTACT MESSAGES
    const msgs = await query(prod, "SELECT * FROM contact_messages ORDER BY id");
    for (const r of msgs) {
      await devClient.query(
        `INSERT INTO contact_messages (id, name, email, message, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [r.id, r.name, r.email, r.message, r.created_at]
      );
    }
    console.log(`✅ contact_messages: ${msgs.length} rows`);

    // SETTINGS
    const settings = await query(prod, "SELECT * FROM settings ORDER BY id");
    for (const r of settings) {
      await devClient.query(
        `INSERT INTO settings (id, key, value) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET value=$3`,
        [r.id, r.key, r.value]
      );
    }
    console.log(`✅ settings: ${settings.length} rows`);

    await devClient.query("COMMIT");
    console.log("\n✅ SYNC COMMITTED");

    // Reset sequences
    for (const t of ["poems", "poets", "categories", "videos", "events", "contact_messages", "settings"]) {
      await devClient.query(`SELECT setval('${t}_id_seq', COALESCE((SELECT MAX(id) FROM ${t}), 1))`);
    }
    console.log("✅ Sequences reset");

    // Print summary
    const tables = ["poems", "poets", "categories", "videos", "events", "contact_messages", "settings"];
    console.log("\n📊 DEV COUNTS AFTER SYNC:");
    for (const t of tables) {
      const [{ count }] = await query(dev, `SELECT COUNT(*) as count FROM ${t}`);
      console.log(`  ${t}: ${count}`);
    }
    console.log("\n✅ SYNC COMPLETE — Development database mirrors production");

  } catch (e) {
    await devClient.query("ROLLBACK");
    console.error("❌ SYNC FAILED — ROLLED BACK:", e);
    process.exit(1);
  } finally {
    devClient.release();
    await dev.end();
    await prod.end();
  }
}

main();
