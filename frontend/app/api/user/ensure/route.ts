import { NextRequest, NextResponse } from 'next/server';
import { ensureUserExists } from '@/lib/user-service';
import { userEnsureBodySchema, validateInput } from '@/lib/api-validation';

/**
 * POST /api/user/ensure
 * Ensures a user exists in the database and returns their ID
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateInput(userEnsureBodySchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { firebaseUid, walletAddress } = validation.data;
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
