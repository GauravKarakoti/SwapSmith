import { NextRequest, NextResponse } from 'next/server';
import { getUserPlanStatus } from '@/lib/plan-service';
import { getUserIdFromFirebaseUid } from '@/lib/user-service';

/**
 * GET /api/plan/status
 * Returns the authenticated user's plan, limits, and daily usage.
 */
export async function GET(request: NextRequest) {
  try {
    const firebaseUid = request.headers.get('x-firebase-uid');
    const userIdHeader = request.headers.get('x-user-id');

    let userId: number | null = null;

    if (userIdHeader) {
      userId = parseInt(userIdHeader);
    } else if (firebaseUid) {
      userId = await getUserIdFromFirebaseUid(firebaseUid);
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getUserPlanStatus(userId);

    if (!status) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(status, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Error fetching plan status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
