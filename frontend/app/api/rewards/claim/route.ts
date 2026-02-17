import { NextRequest, NextResponse } from 'next/server';
import { claimPendingTokens } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await claimPendingTokens(parseInt(userId));

    if (!result) {
      return NextResponse.json(
        { error: 'No pending tokens to claim' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Token claim initiated',
      ...result,
    });
  } catch (error) {
    console.error('Error claiming tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
