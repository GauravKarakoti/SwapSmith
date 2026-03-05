import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid } from '@/lib/admin-service';
import { Pool } from '@neondatabase/serverless';
import { validateSQL } from '../route';

const MASTER_ADMIN_EMAIL = process.env.ADMIN_MASTER_EMAIL || '';

// ── Auth helper (same pattern as other admin routes) ────────────────────────
async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('No token');

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    const parts = token.split('.');
    if (parts.length < 2) throw new Error('Invalid token');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    uid = payload.user_id ?? payload.sub;
  }

  if (!uid) throw new Error('No UID');
  const admin = await getAdminByFirebaseUid(uid);
  if (!admin) throw new Error('Not an admin');
  return admin;
}

// ── GET: fetch one request ──────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let admin;
  try { admin = await requireAdmin(req); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id: rawId } = await params;
  const id = parseInt(rawId);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM sql_command_requests WHERE id = $1`, [id],
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const request = rows[0];
    // Master admin can view all; others can only view their own
    const isMasterAdmin = MASTER_ADMIN_EMAIL !== '' && admin.email === MASTER_ADMIN_EMAIL;
    if (!isMasterAdmin && request.submitted_by_uid !== admin.firebaseUid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ request });
  } finally {
    await pool.end();
  }
}

// ── PATCH: approve (execute) or reject. Super-admin only. ───────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let admin;
  try { admin = await requireAdmin(req); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  if (admin.email !== MASTER_ADMIN_EMAIL) {
    return NextResponse.json(
      { error: 'Only the master admin can approve or reject SQL requests' },
      { status: 403 },
    );
  }

  const { id: rawId } = await params;
  const id = parseInt(rawId);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body?.action || !['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM sql_command_requests WHERE id = $1`, [id],
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const sqlRequest = rows[0];

    if (sqlRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot ${body.action} a request with status: ${sqlRequest.status}` },
        { status: 400 },
      );
    }

    const note: string | null = body.note ?? null;

    // ── Reject ──────────────────────────────────────────────────────────────
    if (body.action === 'reject') {
      await pool.query(
        `UPDATE sql_command_requests
         SET status = 'rejected',
             reviewed_by_uid   = $1,
             reviewed_by_email = $2,
             reviewed_by_name  = $3,
             review_note       = $4,
             reviewed_at       = NOW()
         WHERE id = $5`,
        [admin.firebaseUid, admin.email, admin.name, note, id],
      );
      return NextResponse.json({ message: 'Request rejected' });
    }

    // ── Approve: re-validate before execution ────────────────────────────────
    const validation = validateSQL(sqlRequest.sql_query);
    if (!validation.valid) {
      await pool.query(
        `UPDATE sql_command_requests
         SET status = 'failed', execution_error = $1, executed_at = NOW()
         WHERE id = $2`,
        [validation.reason, id],
      );
      return NextResponse.json(
        { error: `SQL validation failed on execution: ${validation.reason}` },
        { status: 400 },
      );
    }

    // ── Execute ──────────────────────────────────────────────────────────────
    let execResult: Record<string, unknown> = {};
    let execError: string | null = null;
    let rowsAffected = 0;
    let finalStatus = 'executed';

    const execPool = new Pool({ connectionString: process.env.DATABASE_URL! });
    try {
      const res = await execPool.query(sqlRequest.sql_query);
      rowsAffected = res.rowCount ?? 0;
      execResult = {
        rowCount: res.rowCount,
        // Cap returned rows at 500 to avoid huge JSON blobs
        rows: (res.rows ?? []).slice(0, 500),
        fields: (res.fields ?? []).map((f: { name: string; dataTypeID: number }) => ({
          name: f.name,
          dataTypeID: f.dataTypeID,
        })),
      };
    } catch (err) {
      execError  = (err as Error).message;
      finalStatus = 'failed';
    } finally {
      await execPool.end();
    }

    await pool.query(
      `UPDATE sql_command_requests
       SET status            = $1,
           reviewed_by_uid   = $2,
           reviewed_by_email = $3,
           reviewed_by_name  = $4,
           review_note       = $5,
           execution_result  = $6,
           execution_error   = $7,
           rows_affected     = $8,
           reviewed_at       = NOW(),
           executed_at       = NOW()
       WHERE id = $9`,
      [
        finalStatus,
        admin.firebaseUid, admin.email, admin.name,
        note,
        JSON.stringify(execResult),
        execError,
        rowsAffected,
        id,
      ],
    );

    return NextResponse.json({
      status: finalStatus,
      rowsAffected,
      result: execResult,
      error: execError,
    });
  } finally {
    await pool.end();
  }
}

// ── DELETE: cancel a pending request ────────────────────────────────────────
// Admin can cancel their own; super-admin can cancel any.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let admin;
  try { admin = await requireAdmin(req); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id: rawId } = await params;
  const id = parseInt(rawId);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM sql_command_requests WHERE id = $1`, [id],
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const sqlRequest = rows[0];
    const isMasterAdmin = MASTER_ADMIN_EMAIL !== '' && admin.email === MASTER_ADMIN_EMAIL;
    if (!isMasterAdmin && sqlRequest.submitted_by_uid !== admin.firebaseUid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (sqlRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 400 });
    }

    await pool.query(`DELETE FROM sql_command_requests WHERE id = $1`, [id]);
    return NextResponse.json({ message: 'Request cancelled' });
  } finally {
    await pool.end();
  }
}
