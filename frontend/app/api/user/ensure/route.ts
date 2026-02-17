import { NextRequest, NextResponse } from 'next/server';
import { ensureUserExists } from '@/lib/user-service';

/**
 * POST /api/user/ensure
 * Ensures a user exists in the database and returns their ID
 */
export async function POST(request: NextRequest) {
  try {
    const { firebaseUid, walletAddress } = await request.json();

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'firebaseUid is required' },
        { status: 400 }
      );
    }

    const userId = await ensureUserExists(firebaseUid, walletAddress);

    return NextResponse.json({ 
      success: true, 
      userId 
    });
  } catch (error) {
    console.error('Error ensuring user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
