import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import {
  getAdminByFirebaseUid,
  getAdminUsersList,
  updateUserAdminStatus,
} from '@/lib/admin-service';
import type { AdminUserRow } from '@/lib/admin-service';

/** Batch-fetch Firebase emails for a page of users */
async function enrichWithEmails(rows: AdminUserRow[]): Promise<AdminUserRow[]> {
  const uids = rows.map(r => r.firebaseUid).filter(Boolean) as string[];
  if (uids.length === 0) return rows;

  // Build uid→email map
  const uidEmailMap: Record<string, string> = {};
  await Promise.allSettled(
    uids.map(async (uid) => {
      try {
        const fbUser = await adminAuth.getUser(uid);
        if (fbUser.email) uidEmailMap[uid] = fbUser.email;
      } catch {/* user not found in Firebase – skip */}
    })
  );

  return rows.map(r => ({
    ...r,
    email: r.firebaseUid ? (uidEmailMap[r.firebaseUid] ?? null) : null,
  }));
}

// ── Auth helper ──────────────────────────────────────────────────────────

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    const admin = await getAdminByFirebaseUid(decoded.uid);
    return admin ?? null;
  } catch {
    return null;
  }
}

// ── GET /api/admin/users ─────────────────────────────────────────────────
// Query params: page (default 1), limit (default 20), search (optional)

export async function GET(req: NextRequest) {
  try {
    const admin = await authenticate(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search')?.trim() || undefined;

    const { rows, total } = await getAdminUsersList(page, limit, search);
    const enriched = await enrichWithEmails(rows);

    return NextResponse.json({
      success: true,
      users: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[Admin Users GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PATCH /api/admin/users ───────────────────────────────────────────────
// Body: { firebaseUid: string, action: 'suspend'|'unsuspend'|'flag'|'unflag', reason?: string }

export async function PATCH(req: NextRequest) {
  try {
    const admin = await authenticate(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { firebaseUid, action, reason } = body as {
      firebaseUid: string;
      action: 'suspend' | 'unsuspend' | 'flag' | 'unflag';
      reason?: string;
    };

    if (!firebaseUid || !action) {
      return NextResponse.json({ error: 'Missing required fields: firebaseUid, action' }, { status: 400 });
    }

    if (!['suspend', 'unsuspend', 'flag', 'unflag'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await updateUserAdminStatus(firebaseUid, action, admin.email, reason);

    return NextResponse.json({
      success: true,
      message: `User ${action}ed successfully`,
      by: admin.email,
    });
  } catch (err) {
    console.error('[Admin Users PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
