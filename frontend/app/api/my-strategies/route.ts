import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscribedStrategies, getUserSubscriptions } from 'shared/services/strategy-marketplace';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = Number(searchParams.get('userId'));
    
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Missing or invalid userId' },
        { status: 400 }
      );
    }

    const subscriptions = await getUserSubscribedStrategies(userId);
    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Error fetching user strategies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user strategies' },
      { status: 500 }
    );
  }
}
