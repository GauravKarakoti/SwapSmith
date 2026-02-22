import { NextRequest, NextResponse } from 'next/server';
import { addRewardActivity, getUserByWalletOrId } from '@/lib/database';

const DAILY_LOGIN_POINTS = 10;
const DAILY_LOGIN_TOKENS = '0.1';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userIdNum = parseInt(userId);
    
    // Check if user already logged in today
    const user = await getUserByWalletOrId(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if there's already a daily login reward for today
    const { getUserRewardActivities } = await import('@/lib/database');
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
