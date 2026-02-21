import { NextRequest, NextResponse } from 'next/server';
import { addRewardActivity, getUserRewardActivities } from '@/lib/database';

const WALLET_CONNECT_POINTS = 50;
const WALLET_CONNECT_TOKENS = '0.5';

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
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Check if user already received wallet connection reward
    const recentActivities = await getUserRewardActivities(userIdNum, 100);
    
    const alreadyRewarded = recentActivities.some(
      activity => activity.actionType === 'wallet_connected'
    );

    if (alreadyRewarded) {
      return NextResponse.json({
        success: false,
        message: 'Wallet connection reward already claimed',
        alreadyClaimed: true
      });
    }

    // Award wallet connection reward (one-time)
    const reward = await addRewardActivity(
      userIdNum,
      'wallet_connected',
      WALLET_CONNECT_POINTS,
      WALLET_CONNECT_TOKENS,
      {
        walletAddress,
        connectedAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      success: true,
      pointsEarned: WALLET_CONNECT_POINTS,
      tokensEarned: WALLET_CONNECT_TOKENS,
      message: 'Wallet connection reward claimed!',
      reward
    });
  } catch (error) {
    console.error('Error processing wallet connection reward:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
