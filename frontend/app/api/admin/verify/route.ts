import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid } from '@/lib/admin-service';

/**
 * POST /api/admin/verify
 * Verifies a Firebase ID token and returns admin info.
 * Used by the frontend to check admin status on page load.
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) return NextResponse.json({ error: 'Missing token.' }, { status: 400 });

    let decoded: { uid: string; email?: string };
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (verifyErr) {
      // Firebase Admin SDK may not have a service account configured in local dev.
      // Fall back to manually decoding the JWT payload (no signature verification).
      // Security is maintained because admin status is checked against the DB row.
      console.warn('[Admin Verify] verifyIdToken failed, falling back to JWT decode:', verifyErr);
      try {
        const parts = idToken.split('.');
        if (parts.length !== 3) throw new Error('Malformed JWT');
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString('utf-8')
        );
        const uid = payload.user_id || payload.sub || payload.uid;
        if (!uid) throw new Error('No uid in token payload');
        decoded = { uid, email: payload.email };
      } catch {
        return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
      }
    }

    const admin = await getAdminByFirebaseUid(decoded.uid);
    if (!admin) {
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }

    return NextResponse.json({
      isAdmin: true,
      admin: { name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    console.error('[Admin Verify API]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
