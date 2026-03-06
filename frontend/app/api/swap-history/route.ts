import { NextRequest, NextResponse } from 'next/server';
import { getSwapHistory } from '@/lib/database';
import { adminAuth } from '@/lib/firebase-admin';

// GET /api/swap-history - Get user's swap history
export async function GET(request: NextRequest) {
  try {
    // 🔐 Firebase authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error('Error verifying Firebase token:', error);
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const authenticatedUserId = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // 🔐 IDOR protection: Ensure user can only access their own swap history
    if (userId !== authenticatedUserId) {
      return NextResponse.json({ error: 'Forbidden: User ID mismatch' }, { status: 403 });
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
