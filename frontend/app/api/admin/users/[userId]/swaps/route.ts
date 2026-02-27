import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid, getUserSwapsForAdmin } from '@/lib/admin-service';

// ── GET /api/admin/users/[userId]/swaps ──────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded: { uid: string };
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const admin = await getAdminByFirebaseUid(decoded.uid);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const { userId } = await params;
    const swaps = await getUserSwapsForAdmin(userId, limit);

    return NextResponse.json({ success: true, swaps, count: swaps.length });
  } catch (err) {
    console.error('[Admin User Swaps GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
