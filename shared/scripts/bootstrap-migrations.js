/**
 * bootstrap-migrations.js
 *
 * Run this ONCE before running `npm run db:migrate` when the database already
 * has tables/types created outside of Drizzle's migration tracking system.
 *
 * What it does:
 *  1. Creates the `drizzle` schema (IF NOT EXISTS)
 *  2. Creates the `drizzle.__drizzle_migrations` tracking table (IF NOT EXISTS)
 *  3. If the table is empty, inserts a single bootstrap record marking all
 *     migrations up to idx 13 (0013_numerous_grandmaster) as applied.
 *
 * After this, running `npm run db:migrate` will ONLY run new migrations
 * (idx >= 14) without touching already-existing tables/types.
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set in .env');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function bootstrap() {
  console.log('🔧 Bootstrapping Drizzle migration tracking table...\n');

  // 1. Create the `drizzle` schema
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  console.log('✅ Schema `drizzle` ensured.');

  // 2. Create the migrations tracking table
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id      SERIAL PRIMARY KEY,
      hash    text NOT NULL,
      created_at bigint
    )
  `;
  console.log('✅ Table `drizzle.__drizzle_migrations` ensured.');

  // 3. Check if already bootstrapped
  const existing = await sql`SELECT COUNT(*) as cnt FROM drizzle.__drizzle_migrations`;
  const count = parseInt(existing[0].cnt, 10);

  if (count > 0) {
    console.log(`⚠️  Migration table already has ${count} row(s). Skipping insert.`);
    console.log('   If you need to re-bootstrap, manually truncate drizzle.__drizzle_migrations first.');
  } else {
    // Insert bootstrap record marking migrations 0001–0013 as complete.
    // Drizzle compares created_at of the last record against each migration's
    // `when` timestamp. By setting created_at = 1772613194931 (the `when` of
    // 0013_numerous_grandmaster), all migrations up to idx 13 are skipped.
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES ('bootstrap-0001-to-0013', 1772613194931)
    `;
    console.log('✅ Bootstrap record inserted (migrations 0001–0013 marked as applied).');
    console.log('   created_at = 1772613194931  (matches when of 0013_numerous_grandmaster)');
  }

  console.log('\n✅ Bootstrap complete!');
  console.log('   Now run:  npm run db:migrate');
  console.log('   This will only apply migration 0014_missing_tables (and any future ones).\n');
}

bootstrap().catch(err => {
  console.error('Bootstrap failed:', err.message);
  process.exit(1);
});
