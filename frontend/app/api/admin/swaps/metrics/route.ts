import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid, getSwapMetrics } from '@/lib/admin-service';

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
 * GET /api/admin/swaps/metrics
 * Returns API usage metrics: request counts, error rate, spike detection.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await authenticate(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const metrics = await getSwapMetrics();
    return NextResponse.json({ success: true, metrics });
  } catch (err) {
    console.error('[Admin Swaps Metrics GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
