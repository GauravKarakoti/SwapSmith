import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import {
  getAdminByFirebaseUid,
  getAdminUsersList,
  updateUserAdminStatus,
} from '@/lib/admin-service';
import { logAdminAction, AUDIT_ACTIONS, getIpAddress, getUserAgent } from '../../../../shared/lib/audit-logger';

// ── Auth helper ───────────────────────────────────────────────────────────

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

// ── Email enrichment (best-effort, Firebase Admin SDK) ────────────────────

async function enrichWithEmails(
  rows: { firebaseUid: string | null; email: string | null }[],
): Promise<void> {
  const uids = rows
    .filter((r) => r.firebaseUid && !r.email)
    .map((r) => r.firebaseUid as string);

  if (uids.length === 0) return;

  try {
    // Firebase Admin `getUsers` accepts up to 100 identifiers per call
    const batchSize = 100;
    for (let i = 0; i < uids.length; i += batchSize) {
      const batch = uids.slice(i, i + batchSize);
      const result = await adminAuth.getUsers(batch.map((uid) => ({ uid })));
      for (const record of result.users) {
        const row = rows.find((r) => r.firebaseUid === record.uid);
        if (row && record.email) row.email = record.email;
      }
    }
  } catch {
    // Non-fatal – email may remain null
  }
}

// ── GET /api/admin/users ──────────────────────────────────────────────────

/**
 * Query params:
 *   page   – default 1
 *   limit  – default 20, max 100
 *   search – free-text (walletAddress, firebaseUid, email)
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await authenticate(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search')?.trim() || undefined;

    const { rows, total } = await getAdminUsersList(page, limit, search);

    // Best-effort email enrichment from Firebase Auth
    await enrichWithEmails(rows);

    return NextResponse.json({
      success: true,
      users: rows,
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

// ── PATCH /api/admin/users ────────────────────────────────────────────────

/**
 * Body:
 *   firebaseUid  – target user's Firebase UID
 *   action       – 'suspend' | 'unsuspend' | 'flag' | 'unflag'
 *   reason       – optional string
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await authenticate(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { firebaseUid, action, reason } = body as {
      firebaseUid?: string;
      action?: string;
      reason?: string;
    };

    if (!firebaseUid) {
      return NextResponse.json({ error: 'firebaseUid is required' }, { status: 400 });
    }

    const validActions = ['suspend', 'unsuspend', 'flag', 'unflag'] as const;
    if (!action || !validActions.includes(action as (typeof validActions)[number])) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await updateUserAdminStatus(
      firebaseUid,
      action as (typeof validActions)[number],
      admin.email,
      reason,
    );

    // Log the action
    const actionToAudit: Record<string, string> = {
      suspend: AUDIT_ACTIONS.SUSPEND_USER,
      unsuspend: AUDIT_ACTIONS.UNSUSPEND_USER,
      flag: AUDIT_ACTIONS.FLAG_USER,
      unflag: AUDIT_ACTIONS.UNFLAG_USER,
    };

    await logAdminAction({
      adminId: admin.firebaseUid,
      adminEmail: admin.email,
      action: actionToAudit[action] || action,
      targetResource: 'user',
      targetId: firebaseUid,
      metadata: {
        action,
        reason: reason || null,
      },
      ipAddress: getIpAddress(req.headers),
      userAgent: getUserAgent(req.headers),
    });

    const actionLabels: Record<string, string> = {
      suspend:   'User suspended',
      unsuspend: 'User re-activated',
      flag:      'User flagged as high-risk',
      unflag:    'High-risk flag removed',
    };

    return NextResponse.json({
      success: true,
      message: actionLabels[action] ?? 'Action completed',
    });
  } catch (err) {
    console.error('[Admin Users PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
