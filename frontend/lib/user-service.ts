import { getUserByWalletOrId, users } from './database';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import logger from './logger';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

/**
 * Get or create user in database
 * This ensures a user record exists before we try to save progress
 */
export async function ensureUserExists(firebaseUid: string, walletAddress?: string): Promise<number> {
  if (!db) {
    logger.warn('Database not configured');
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
      logger.info('User found', { userId: existingUsers[0].id });
      return existingUsers[0].id;
    }

    // Create new user
    logger.info('Creating new user', { firebaseUid });
    const newUser = await db.insert(users)
      .values({
        firebaseUid: firebaseUid,
        walletAddress: walletAddress || null,
        totalPoints: 0,
        totalTokensClaimed: '0',
      })
      .returning();

    logger.info('User created', { userId: newUser[0].id });
    return newUser[0].id;
  } catch (error) {
    logger.error('Error ensuring user exists', { 
      error: error instanceof Error ? error.message : String(error) 
    });
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
    logger.error('Error getting user ID', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}
