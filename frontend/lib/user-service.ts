import { getUserByWalletOrId, users } from './database';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

/**
 * Get or create user in database
 * This ensures a user record exists before we try to save progress
 */
export async function ensureUserExists(firebaseUid: string, walletAddress?: string): Promise<number> {
  if (!db) {
    console.warn('Database not configured');
    throw new Error('Database not configured');
  }

  try {
    // Try to find user by wallet address if provided
    if (walletAddress) {
      const existingUser = await getUserByWalletOrId(walletAddress);
      if (existingUser) {
        return existingUser.id;
      }
    }

    // Check if user exists by Firebase UID
    const { eq } = await import('drizzle-orm');
    
    const existingUsers = await db.select().from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);

    if (existingUsers[0]) {
      console.log('User found with ID:', existingUsers[0].id);
      return existingUsers[0].id;
    }

    // Create new user
    console.log('Creating new user for Firebase UID:', firebaseUid);
    const newUser = await db.insert(users)
      .values({
        firebaseUid: firebaseUid,
        walletAddress: walletAddress || null,
        totalPoints: 0,
        totalTokensClaimed: '0',
      })
      .returning();

    console.log('User created with ID:', newUser[0].id);
    return newUser[0].id;
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    throw error;
  }
}

/**
 * Get user database ID from Firebase UID
 */
export async function getUserIdFromFirebaseUid(firebaseUid: string): Promise<number | null> {
  if (!db) {
    return null;
  }

  try {
    const { eq } = await import('drizzle-orm');
    
    const existingUsers = await db.select().from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);

    return existingUsers[0]?.id || null;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
}
