import { NextRequest, NextResponse } from 'next/server';
import { incrementTerminalUsage, getUserPlanStatus } from '@/lib/plan-service';
import { getUserIdFromFirebaseUid } from '@/lib/user-service';

async function resolveUserId(request: NextRequest): Promise<number | null> {
  const userIdHeader = request.headers.get('x-user-id');
  const firebaseUid = request.headers.get('x-firebase-uid');
  if (userIdHeader) return parseInt(userIdHeader);
  if (firebaseUid) return getUserIdFromFirebaseUid(firebaseUid);
  return null;
}

/**
 * POST /api/plan/usage/terminal
 * Checks and increments terminal usage for the authenticated user.
 * Returns 429 with upgradeRequired: true if limit exceeded.
 */
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { count, limit } = await incrementTerminalUsage(userId);
    return NextResponse.json({ success: true, count, limit });
  } catch (error: unknown) {
    const err = error as Error & { code?: string; plan?: string };
    if (err.code === 'LIMIT_EXCEEDED') {
      return NextResponse.json(
        {
          error: 'Usage limit exceeded',
          upgradeRequired: true,
          currentPlan: err.plan ?? 'free',
          message: 'You have reached your daily terminal limit. Upgrade your plan to continue.',
        },
        { status: 429 }
      );
    }
    console.error('Error incrementing terminal usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/plan/usage/terminal
 * Returns current terminal usage status without incrementing.
 */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = await getUserPlanStatus(userId);
    if (!status) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({
      plan: status.plan,
      count: status.dailyTerminalCount,
      limit: status.dailyTerminalLimit,
      exceeded: status.terminalLimitExceeded,
    });
  } catch (error) {
    console.error('Error fetching terminal usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
