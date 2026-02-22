import { NextRequest, NextResponse } from 'next/server';
import { purchasePlan } from '@/lib/plan-service';
import { getUserIdFromFirebaseUid } from '@/lib/user-service';

/**
 * POST /api/plan/purchase
 * Body: { plan: 'premium' | 'pro' }
 * Deducts SwapSmith coins and activates the plan for 30 days.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { plan } = body;

    if (plan !== 'premium' && plan !== 'pro') {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "premium" or "pro".' },
        { status: 400 }
      );
    }

    const result = await purchasePlan(userId, plan);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 402 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      newPlan: result.newPlan,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('Error purchasing plan:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
