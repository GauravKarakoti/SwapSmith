import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid, getCoinUsersList } from '@/lib/admin-service';

/** Decode a raw Firebase JWT without full SDK verification (dev fallback) */
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
 * GET /api/admin/coins/users
 * Returns paginated list of users with testnet coin balances.
 *
 * Query params:
 *   page   – default 1
 *   limit  – default 20
 *   search – wallet address or firebaseUid substring
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

    const { searchParams } = new URL(req.url);
    const page       = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
    const limit      = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
    const search     = searchParams.get('search') ?? undefined;
    const hasSwapped = searchParams.get('hasSwapped') === 'true' ? true : undefined;

    const result = await getCoinUsersList(page, limit, search, hasSwapped);

    return NextResponse.json({
      success: true,
      ...result,
      page,
      limit,
      admin: { name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    console.error('[Admin Coins Users API]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
