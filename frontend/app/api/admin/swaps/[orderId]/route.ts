import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid, getAdminSwapById } from '@/lib/admin-service';
import { SIDESHIFT_CONFIG } from '../../../../../../shared/config/sideshift';

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
 * GET /api/admin/swaps/[orderId]
 * Returns local DB record merged with live SideShift order details.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const admin = await authenticate(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId } = await params;
    const localSwap = await getAdminSwapById(orderId);
    if (!localSwap) {
      return NextResponse.json({ error: 'Swap not found' }, { status: 404 });
    }

    // Fetch live data from SideShift API
    let sideshiftData: Record<string, unknown> | null = null;
    try {
      const res = await fetch(`${SIDESHIFT_CONFIG.BASE_URL}/orders/${orderId}`, {
        headers: { 'Content-Type': 'application/json' },
        next: { revalidate: 0 },
      });
      if (res.ok) {
        sideshiftData = await res.json() as Record<string, unknown>;
      }
    } catch (e) {
      console.warn('[Admin Swaps] SideShift fetch failed for', orderId, e);
    }

    // Optionally fetch quote if quoteId is available
    let quoteData: Record<string, unknown> | null = null;
    if (localSwap.quoteId) {
      try {
        const qRes = await fetch(`${SIDESHIFT_CONFIG.BASE_URL}/quotes/${localSwap.quoteId}`, {
          headers: { 'Content-Type': 'application/json' },
          next: { revalidate: 0 },
        });
        if (qRes.ok) {
          quoteData = await qRes.json() as Record<string, unknown>;
        }
      } catch { /* ignore */ }
    }

    return NextResponse.json({
      success: true,
      swap: localSwap,
      sideshiftOrder: sideshiftData,
      sideshiftQuote: quoteData,
    });
  } catch (err) {
    console.error('[Admin Swaps Detail GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
