import { NextRequest, NextResponse } from 'next/server';
import { getUserRewardsStats } from '@/lib/database';
import { verifyAuth } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    // Verify Firebase authentication token
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error!;
    }

    const stats = await getUserRewardsStats(authResult.userId!);

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
