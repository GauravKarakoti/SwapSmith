import { NextRequest, NextResponse } from 'next/server';
import { getSwapHistory } from '@/lib/database';

// GET /api/swap-history - Get user's swap history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const history = await getSwapHistory(userId, limit);

    return NextResponse.json({
      success: true,
      history,
      count: history.length,
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60',
      }
    });

  } catch (error) {
    console.error('Error fetching swap history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch swap history', history: [] },
      { status: 500 }
    );
  }
}
