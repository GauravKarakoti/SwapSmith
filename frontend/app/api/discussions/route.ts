import { NextRequest, NextResponse } from 'next/server';
import { getDiscussions, createDiscussion, deleteDiscussion, likeDiscussion } from '@/lib/database';

// GET /api/discussions - Get all discussions or filtered by category
export async function GET(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');

    const discussions = await getDiscussions(category || undefined, limit);

    return NextResponse.json({
      discussions,
      count: discussions.length,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      }
    });

  } catch (error) {
    console.error('Error fetching discussions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discussions' },
      { status: 500 }
    );
  }
}

// POST /api/discussions - Create a new discussion
export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { userId, username, content, category } = body;

    if (!userId || !username || !content) {
      return NextResponse.json(
        { error: 'userId, username, and content are required' },
        { status: 400 }
      );
    }

    if (content.trim().length < 5) {
      return NextResponse.json(
        { error: 'Content must be at least 5 characters' },
        { status: 400 }
      );
    }

    const discussion = await createDiscussion(
      userId,
      username,
      content.trim(),
      category || 'general'
    );

    return NextResponse.json({
      success: true,
      discussion,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating discussion:', error);
    return NextResponse.json(
      { error: 'Failed to create discussion' },
      { status: 500 }
    );
  }
}

// DELETE /api/discussions - Delete a discussion
export async function DELETE(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'id and userId are required' },
        { status: 400 }
      );
    }

    await deleteDiscussion(parseInt(id), userId);

    return NextResponse.json({
      success: true,
      message: 'Discussion deleted',
    });

  } catch (error) {
    console.error('Error deleting discussion:', error);
    return NextResponse.json(
      { error: 'Failed to delete discussion' },
      { status: 500 }
    );
  }
}

// PATCH /api/discussions - Like a discussion
export async function PATCH(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    await likeDiscussion(parseInt(id));

    return NextResponse.json({
      success: true,
      message: 'Discussion liked',
    });

  } catch (error) {
    console.error('Error liking discussion:', error);
    return NextResponse.json(
      { error: 'Failed to like discussion' },
      { status: 500 }
    );
  }
}
