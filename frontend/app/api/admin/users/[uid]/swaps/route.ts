import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import {
  getAdminByFirebaseUid,
  getUserSwapsForAdmin,
} from '@/lib/admin-service';

// ── Auth helper ───────────────────────────────────────────────────────────

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    return await getAdminByFirebaseUid(decoded.uid);
  } catch {
    return null;
  }
}

// ── GET /api/admin/users/[uid]/swaps ─────────────────────────────────────

/**
 * Query params:
 *   limit – max number of swaps to return (default 100, max 200)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const admin = await authenticate(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { uid } = await params;
    if (!uid) return NextResponse.json({ error: 'uid is required' }, { status: 400 });

    const firebaseUid = decodeURIComponent(uid);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100')));

    const swaps = await getUserSwapsForAdmin(firebaseUid, limit);

    const formatted = swaps.map((s) => ({
      id:               s.id,
      userId:           s.userId,
      walletAddress:    s.walletAddress,
      sideshiftOrderId: s.sideshiftOrderId,
      fromAsset:        s.fromAsset,
      fromNetwork:      s.fromNetwork,
      fromAmount:       s.fromAmount,
      toAsset:          s.toAsset,
      toNetwork:        s.toNetwork,
      settleAmount:     s.settleAmount,
      status:           s.status,
      txHash:           s.txHash,
      createdAt:        s.createdAt ? s.createdAt.toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      swaps: formatted,
      total: formatted.length,
    });
  } catch (err) {
    console.error('[Admin User Swaps GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
