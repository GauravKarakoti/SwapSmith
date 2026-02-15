import { NextRequest, NextResponse } from 'next/server';
import { getChatHistory, addChatMessage, clearChatHistory } from '@/lib/database';

// GET /api/chat/history - Get chat history for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const history = await getChatHistory(userId, sessionId || undefined, limit);

    return NextResponse.json({
      history: history.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
        sessionId: msg.sessionId,
        createdAt: msg.createdAt,
      })),
      count: history.length,
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=10, stale-while-revalidate=30',
      }
    });

  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
}

// POST /api/chat/history - Add chat message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      walletAddress,
      role,
      content,
      sessionId,
      metadata,
    } = body;

    if (!userId || !role || !content) {
      return NextResponse.json(
        { error: 'userId, role, and content are required' },
        { status: 400 }
      );
    }

    if (!['user', 'assistant'].includes(role)) {
      return NextResponse.json(
        { error: 'role must be either "user" or "assistant"' },
        { status: 400 }
      );
    }

    await addChatMessage(
      userId,
      walletAddress,
      role as 'user' | 'assistant',
      content,
      sessionId,
      metadata
    );

    return NextResponse.json({
      success: true,
      message: 'Chat message added',
    }, {
      status: 201,
    });

  } catch (error) {
    console.error('Error adding chat message:', error);
    return NextResponse.json(
      { error: 'Failed to add chat message' },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/history - Clear chat history
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    await clearChatHistory(userId, sessionId || undefined);

    return NextResponse.json({
      success: true,
      message: 'Chat history cleared',
    }, {
      status: 200,
    });

  } catch (error) {
    console.error('Error clearing chat history:', error);
    return NextResponse.json(
      { error: 'Failed to clear chat history' },
      { status: 500 }
    );
  }
}
