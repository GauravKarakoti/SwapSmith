import { NextRequest, NextResponse } from 'next/server';
import { getUserSettings, createOrUpdateUserSettings } from '@/lib/database';
import { adminAuth } from '@/lib/firebase-admin';
import { rateLimiters } from '@/lib/rate-limiter';
import { applyAPISecurityHeaders } from '@/lib/security-headers';

// GET /api/user/settings - Get user settings
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

    // Validate DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // 🔐 IDOR protection: Ensure user can only access their own settings
    if (userId !== authenticatedUserId) {
      return NextResponse.json({ error: 'Forbidden: User ID mismatch' }, { status: 403 });
    }

    const settings = await getUserSettings(userId);

    if (!settings) {
      // Return empty settings if not found
      return NextResponse.json({
        userId,
        preferences: null,
        emailNotifications: null,
        updatedAt: new Date().toISOString(),
      }, {
        headers: {
          'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120',
        }
      });
    }

    return NextResponse.json({
      userId: settings.userId,
      walletAddress: settings.walletAddress,
      preferences: settings.preferences,
      emailNotifications: settings.emailNotifications,
      updatedAt: settings.updatedAt,
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120',
      }
    });

  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user settings' },
      { status: 500 }
    );
  }
}

// POST /api/user/settings - Create or update user settings
export async function POST(request: NextRequest) {
  try {
    // 🔐 Rate limiting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rateLimitResponse = rateLimiters.profile(request as any, {} as any);
    if (!rateLimitResponse) {
      const response = NextResponse.json({ error: 'Too many profile requests' }, { status: 429 });
      return applyAPISecurityHeaders(response);
    }

    // 🔐 Firebase authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      const response = NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
      return applyAPISecurityHeaders(response);
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error('Error verifying Firebase token:', error);
      const response = NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
      return applyAPISecurityHeaders(response);
    }

    const authenticatedUserId = decodedToken.uid;

    // Validate DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not configured');
      const response = NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
      return applyAPISecurityHeaders(response);
    }

    const body = await request.json();
    const {
      userId,
      walletAddress,
      preferences,
      emailNotifications,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // 🔐 IDOR protection: Ensure user can only modify their own settings
    if (userId !== authenticatedUserId) {
      return NextResponse.json({ error: 'Forbidden: User ID mismatch' }, { status: 403 });
    }

    await createOrUpdateUserSettings(
      userId,
      walletAddress,
      preferences,
      emailNotifications
    );

    return NextResponse.json({
      success: true,
      message: 'User settings updated',
    }, {
      status: 200,
    });

  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json(
      { error: 'Failed to update user settings' },
      { status: 500 }
    );
  }
}

// PATCH /api/user/settings - Partial update user settings (deprecated, use POST)
export async function PATCH(request: NextRequest) {
  return POST(request);
}
