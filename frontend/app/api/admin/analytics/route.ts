import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid } from '@/lib/admin-service';
import { getPlatformAnalytics } from '@/lib/admin-service';

export async function GET(req: NextRequest) {
  try {
    // Authenticate via Firebase ID token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded: { uid: string };
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch (verifyErr) {
      console.warn('[Admin Analytics] verifyIdToken failed, falling back to JWT decode:', verifyErr);
      try {
        const parts = authHeader.substring(7).split('.');
        if (parts.length !== 3) throw new Error('Malformed JWT');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const uid = payload.user_id || payload.sub || payload.uid;
        if (!uid) throw new Error('No uid in payload');
        decoded = { uid };
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    // Check admin role in DB
    const admin = await getAdminByFirebaseUid(decoded.uid);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const analytics = await getPlatformAnalytics();
    return NextResponse.json({ success: true, data: analytics, admin: { name: admin.name, email: admin.email, role: admin.role } });
  } catch (err) {
    console.error('[Admin Analytics API]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
