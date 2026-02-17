import { NextRequest, NextResponse } from 'next/server';
import { getUserSettings, createOrUpdateUserSettings } from '@/lib/database';

// GET /api/user/settings - Get user settings
export async function GET(request: NextRequest) {
  try {
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
    // Validate DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
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
