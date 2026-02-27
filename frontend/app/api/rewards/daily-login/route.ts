import { NextRequest, NextResponse } from 'next/server';
import { addRewardActivity, getUserByWalletOrId, getUserRewardActivities } from '@/lib/database';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { users } from '../../../../../shared/schema';

const DAILY_LOGIN_POINTS = 10;
const DAILY_LOGIN_TOKENS = '0.1';

/** Look up a user by Firebase UID, wallet address, or numeric DB id. */
async function resolveUser(identifier: string) {
  const rawSql = neon(process.env.DATABASE_URL!);
  const db = drizzle(rawSql);

  // 1. Try Firebase UID
  const byFirebase = await db.select().from(users).where(eq(users.firebaseUid, identifier)).limit(1);
  if (byFirebase[0]) return byFirebase[0];

  // 2. Try wallet address
  const byWallet = await getUserByWalletOrId(identifier);
  if (byWallet) return byWallet;

  // 3. Try numeric ID
  const numId = parseInt(identifier, 10);
  if (!isNaN(numId)) {
    const byId = await db.select().from(users).where(eq(users.id, numId)).limit(1);
    if (byId[0]) return byId[0];
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Resolve user by Firebase UID, wallet address, or numeric id
    const user = await resolveUser(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userIdNum = user.id;

    // Check if there's already a daily login reward for today
    const recentActivities = await getUserRewardActivities(userIdNum, 20);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const alreadyLoggedInToday = recentActivities.some(activity => {
      if (activity.actionType !== 'daily_login') return false;
      const activityDate = new Date(activity.createdAt);
      activityDate.setHours(0, 0, 0, 0);
      return activityDate.getTime() === today.getTime();
    });

    if (alreadyLoggedInToday) {
      return NextResponse.json({
        success: false,
        message: 'Already logged in today',
        alreadyClaimed: true
      });
    }

    // Award daily login reward
    const reward = await addRewardActivity(
      userIdNum,
      'daily_login',
      DAILY_LOGIN_POINTS,
      DAILY_LOGIN_TOKENS,
      {
        loginDate: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      success: true,
      pointsEarned: DAILY_LOGIN_POINTS,
      tokensEarned: DAILY_LOGIN_TOKENS,
      message: 'Daily login reward claimed!',
      reward
    });
  } catch (error) {
    console.error('Error processing daily login reward:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
