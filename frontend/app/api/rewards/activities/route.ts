import { NextRequest, NextResponse } from 'next/server';
import { getUserRewardActivities } from '@/lib/database';
import { verifyAuth } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    // Verify Firebase authentication token
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error!;
    }

    const activities = await getUserRewardActivities(authResult.userId!);

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error fetching reward activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
