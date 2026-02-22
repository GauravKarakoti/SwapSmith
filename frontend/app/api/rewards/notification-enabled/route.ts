import { NextRequest, NextResponse } from 'next/server';
import { addRewardActivity, getUserRewardActivities } from '@/lib/database';

const NOTIFICATION_ENABLE_POINTS = 15;
const NOTIFICATION_ENABLE_TOKENS = '0.15';

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

    // Check if user already received notification enable reward
    const recentActivities = await getUserRewardActivities(userIdNum, 100);
    
    const alreadyRewarded = recentActivities.some(
      activity => activity.actionType === 'notification_enabled'
    );

    if (alreadyRewarded) {
      return NextResponse.json({
        success: false,
        message: 'Notification enable reward already claimed',
        alreadyClaimed: true
      });
    }

    // Award notification enable reward (one-time)
    const reward = await addRewardActivity(
      userIdNum,
      'notification_enabled',
      NOTIFICATION_ENABLE_POINTS,
      NOTIFICATION_ENABLE_TOKENS,
      {
        enabledAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      success: true,
      pointsEarned: NOTIFICATION_ENABLE_POINTS,
      tokensEarned: NOTIFICATION_ENABLE_TOKENS,
      message: 'Notification enable reward claimed!',
      reward
    });
  } catch (error) {
    console.error('Error processing notification enable reward:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
