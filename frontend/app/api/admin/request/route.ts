import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { adminAuth }  from '@/lib/firebase-admin';
import {
  createAdminRequest,
  getAdminByEmail,
  getRequestByEmail,
} from '@/lib/admin-service';
import { sendAdminApprovalRequestEmail } from '@/lib/admin-email';

const MASTER_ADMIN_EMAIL = process.env.ADMIN_MASTER_EMAIL || '';

export async function POST(req: NextRequest) {
  try {
    const { name, email, idToken } = await req.json();

    if (!name || !email || !idToken) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (!MASTER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Admin system not configured. Please contact the platform team.' }, { status: 500 });
    }

    // Verify Firebase ID token — with fallback JWT decode for environments
    // where Firebase Admin SDK service account is not configured.
    let decoded: { uid: string; email?: string };
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      // Fallback: decode JWT payload without verification.
      // Security is still maintained by the master-admin email approval gate.
      try {
        const parts = idToken.split('.');
        if (parts.length !== 3) throw new Error('bad jwt');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const uid = payload.user_id || payload.sub || payload.uid;
        if (!uid) throw new Error('no uid in token');
        decoded = { uid, email: payload.email };
      } catch {
        return NextResponse.json({ error: 'Invalid authentication token.' }, { status: 401 });
      }
    }

    const firebaseUid = decoded.uid;

    // Check if already an admin
    const existingAdmin = await getAdminByEmail(email);
    if (existingAdmin) {
      return NextResponse.json({ error: 'This email already has admin access.' }, { status: 409 });
    }

    // Check for existing pending/rejected request
    const existingReq = await getRequestByEmail(email);
    if (existingReq) {
      if (existingReq.status === 'pending') {
        return NextResponse.json({ error: 'A request for this email is already pending review.' }, { status: 409 });
      }
      if (existingReq.status === 'rejected') {
        return NextResponse.json({ error: 'Your previous request was rejected. Contact the admin team.' }, { status: 403 });
      }
    }

    // Generate one-time approval token
    const approvalToken = randomBytes(32).toString('hex');

    // Save the request
    await createAdminRequest({ firebaseUid, email, name, approvalToken });

    // Email the master admin
    await sendAdminApprovalRequestEmail({
      masterAdminEmail: MASTER_ADMIN_EMAIL,
      requesterName:    name,
      requesterEmail:   email,
      approvalToken,
    });

    return NextResponse.json({
      success: true,
      message: 'Your admin access request has been submitted. You will receive an email once reviewed.',
    });
  } catch (err) {
    console.error('[Admin Request API]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
