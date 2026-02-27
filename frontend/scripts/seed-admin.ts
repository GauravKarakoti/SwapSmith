/**
 * One-time script to bootstrap the first admin user directly into the database.
 * 
 * Usage:
 *   1. Find your Firebase UID in Firebase Console → Authentication → Users → your email
 *   2. Run: npx tsx scripts/seed-admin.ts
 *      (set FIREBASE_UID, ADMIN_EMAIL, ADMIN_NAME env vars, or edit the defaults below)
 * 
 * Example:
 *   FIREBASE_UID=abc123 ADMIN_EMAIL=you@email.com ADMIN_NAME="Your Name" npx tsx scripts/seed-admin.ts
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { adminUsers } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const FIREBASE_UID = process.env.FIREBASE_UID || '';
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL  || '';
const ADMIN_NAME   = process.env.ADMIN_NAME   || 'Admin';

async function main() {
  if (!FIREBASE_UID || !ADMIN_EMAIL) {
    console.error('❌  Set FIREBASE_UID and ADMIN_EMAIL environment variables before running this script.');
    console.error('    Example: FIREBASE_UID=abc123 ADMIN_EMAIL=you@email.com npx tsx scripts/seed-admin.ts');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌  DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db  = drizzle(sql);

  // Check if already exists
  const existing = await db.select().from(adminUsers).where(eq(adminUsers.firebaseUid, FIREBASE_UID)).limit(1);
  if (existing.length > 0) {
    console.log(`⚠️  Admin with Firebase UID "${FIREBASE_UID}" already exists:`, existing[0]);
    process.exit(0);
  }

  const [created] = await db.insert(adminUsers).values({
    firebaseUid: FIREBASE_UID,
    email:       ADMIN_EMAIL,
    name:        ADMIN_NAME,
    role:        'admin',
    isActive:    true,
    approvedAt:  new Date(),
    approvedBy:  'seed-script',
  }).returning();

  console.log('✅  Admin user created:', created);
}

main().catch((err) => {
  console.error('❌  Error:', err);
  process.exit(1);
});
