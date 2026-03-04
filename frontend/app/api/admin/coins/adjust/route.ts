import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import {
  getAdminByFirebaseUid,
  adjustTestnetCoins,
  getUserCoinLogs,
} from '@/lib/admin-service';
import { neon } from '@neondatabase/serverless';

const rawSql = neon(process.env.DATABASE_URL!);

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
 * POST /api/admin/coins/adjust
 * Body: { targetUserId, action: 'gift'|'deduct'|'reset', amount, note? }
 *
 * Adjusts testnet coin balance for a user and writes an audit log entry.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await decodeToken(authHeader.substring(7));
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const admin = await getAdminByFirebaseUid(decoded.uid);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { targetUserId, action, amount, note } = body as {
      targetUserId: number;
      action: 'gift' | 'deduct' | 'reset';
      amount: number;
      note?: string;
    };

    if (!targetUserId || !['gift', 'deduct', 'reset'].includes(action)) {
      return NextResponse.json({ error: 'Missing or invalid fields: targetUserId, action' }, { status: 400 });
    }
    if ((action === 'gift' || action === 'deduct') && (typeof amount !== 'number' || amount <= 0)) {
      return NextResponse.json({ error: 'amount must be a positive number for gift/deduct' }, { status: 400 });
    }

    // Resolve firebaseUid and walletAddress for the target user
    const userRows = (await rawSql`
      SELECT firebase_uid, wallet_address FROM users WHERE id = ${targetUserId} LIMIT 1
    `) as { firebase_uid: string | null; wallet_address: string | null }[];

    if (!userRows[0]?.firebase_uid) {
      return NextResponse.json({ error: 'User not found or has no firebase_uid' }, { status: 404 });
    }

    const { balanceBefore, balanceAfter } = await adjustTestnetCoins({
      adminId:          decoded.uid,
      adminEmail:       admin.email,
      targetUserId,
      targetFirebaseUid: userRows[0].firebase_uid,
      walletAddress:    userRows[0].wallet_address,
      action,
      amount:           action === 'reset' ? 0 : amount,
      note,
    });

    return NextResponse.json({
      success: true,
      action,
      balanceBefore,
      balanceAfter,
      admin: { name: admin.name, email: admin.email },
    });
  } catch (err) {
    console.error('[Admin Coins Adjust API]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * GET /api/admin/coins/adjust?userId=<numeric>
 * Returns recent audit logs for a specific user.
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

    const userId = parseInt(new URL(req.url).searchParams.get('userId') ?? '');
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const logs = await getUserCoinLogs(userId, 30);
    return NextResponse.json({ success: true, logs });
  } catch (err) {
    console.error('[Admin Coins Adjust GET API]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
