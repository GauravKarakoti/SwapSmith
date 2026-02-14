import { NextRequest, NextResponse } from 'next/server';
import { getChatSessions } from '@/lib/database';

/**
 * GET /api/chat/sessions - Get all chat sessions for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const sessions = await getChatSessions(userId);

    return NextResponse.json({
      sessions,
      count: sessions.length,
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=5, stale-while-revalidate=10',
      }
    });

  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat sessions' },
      { status: 500 }
    );
  }
}
