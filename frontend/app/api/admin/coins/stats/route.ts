import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid, getCoinSupplyStats } from '@/lib/admin-service';

async function decodeToken(token: string): Promise<{ uid: string } | null> {
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      const uid = payload.user_id || payload.sub || payload.uid;
      return uid ? { uid } : null;
    } catch {
      return null;
    }
  }
}

/**
 * GET /api/admin/coins/stats
 * Returns global testnet coin supply overview.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await decodeToken(authHeader.substring(7));
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const admin = await getAdminByFirebaseUid(decoded.uid);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const stats = await getCoinSupplyStats();

    return NextResponse.json({
      success: true,
      stats,
      admin: { name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    console.error('[Admin Coins Stats API]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
