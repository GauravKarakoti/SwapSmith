import { NextRequest, NextResponse } from 'next/server';
import { getUserRewardActivities } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const activities = await getUserRewardActivities(parseInt(userId));

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error fetching reward activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
