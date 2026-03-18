import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/adminAuth';
import { giftAllUsers } from '@/lib/admin-service';
import { logAdminAction, AUDIT_ACTIONS, getIpAddress, getUserAgent } from '../../../../../../shared/lib/audit-logger';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const admin = await verifyAdminToken(authHeader);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const result = await giftAllUsers({
      adminId:   admin.uid,
      adminEmail: admin.email ?? 'unknown',
      amount,
      note:      body.note ?? `Broadcast gift of ${amount} coins`,
    });

    // Log the bulk gift action
    await logAdminAction({
      adminId: admin.uid,
      adminEmail: admin.email ?? 'unknown',
      action: AUDIT_ACTIONS.GIFT_COINS_ALL,
      targetResource: 'users',
      targetId: 'all',
      metadata: {
        amount,
        note: body.note ?? `Broadcast gift of ${amount} coins`,
        usersAffected: result.usersGifted, // <-- Change this to result.usersGifted
      },
      ipAddress: getIpAddress(req.headers),
      userAgent: getUserAgent(req.headers),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[admin/coins/gift-all] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}