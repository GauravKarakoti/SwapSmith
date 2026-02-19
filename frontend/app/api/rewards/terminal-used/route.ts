import { NextRequest, NextResponse } from 'next/server';
import { addRewardActivity, getUserRewardActivities } from '@/lib/database';

const TERMINAL_USAGE_POINTS = 25;
const TERMINAL_USAGE_TOKENS = '0.25';

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

    // Check if user already received terminal usage reward
    const recentActivities = await getUserRewardActivities(userIdNum, 100);
    
    const alreadyRewarded = recentActivities.some(
      activity => activity.actionType === 'terminal_used'
    );

    if (alreadyRewarded) {
      return NextResponse.json({
        success: false,
        message: 'Terminal usage reward already claimed',
        alreadyClaimed: true
      });
    }

    // Award terminal usage reward (one-time for first use)
    const reward = await addRewardActivity(
      userIdNum,
      'terminal_used',
      TERMINAL_USAGE_POINTS,
      TERMINAL_USAGE_TOKENS,
      {
        firstUsedAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      success: true,
      pointsEarned: TERMINAL_USAGE_POINTS,
      tokensEarned: TERMINAL_USAGE_TOKENS,
      message: 'Terminal usage reward claimed!',
      reward
    });
  } catch (error) {
    console.error('Error processing terminal usage reward:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
