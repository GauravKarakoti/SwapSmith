import { NextRequest, NextResponse } from 'next/server';
import { getUserRewardsStats } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Get user from headers or session (in real app, use proper auth)
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stats = await getUserRewardsStats(parseInt(userId));

    if (!stats) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching rewards stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
