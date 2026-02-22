import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const leaderboard = await getLeaderboard(100);

    // Mark current user if authenticated
    const enrichedLeaderboard = leaderboard.map(entry => ({
      ...entry,
      userName: (entry.walletAddress && typeof entry.walletAddress === 'string')
        ? `${entry.walletAddress.slice(0, 6)}...${entry.walletAddress.slice(-4)}` 
        : `User ${entry.userId}`,
      isCurrentUser: userId ? entry.userId === parseInt(userId) : false,
    }));

    return NextResponse.json(enrichedLeaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
