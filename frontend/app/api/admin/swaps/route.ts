import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid, getAdminSwaps } from '@/lib/admin-service';

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

/**
 * GET /api/admin/swaps
 * Query params:
 *   page    – default 1
 *   limit   – default 25, max 100
 *   status  – 'all' | 'pending' | 'settled' | 'failed' | 'refunded' | 'processing'
 *   search  – free-text (orderId, userId, wallet, asset)
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await authenticate(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search')?.trim() || undefined;

    const { rows, total } = await getAdminSwaps(page, limit, status, search);

    return NextResponse.json({
      success: true,
      swaps: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[Admin Swaps GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
