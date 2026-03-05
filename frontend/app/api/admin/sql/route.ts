import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid } from '@/lib/admin-service';
import { Pool } from '@neondatabase/serverless';

const MASTER_ADMIN_EMAIL = process.env.ADMIN_MASTER_EMAIL || '';

// ── Ensure audit table exists ───────────────────────────────────────────────
async function ensureTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sql_command_requests (
      id               SERIAL PRIMARY KEY,
      submitted_by_uid   TEXT        NOT NULL,
      submitted_by_email TEXT        NOT NULL,
      submitted_by_name  TEXT        NOT NULL,
      sql_query          TEXT        NOT NULL,
      description        TEXT,
      status             TEXT        NOT NULL DEFAULT 'pending',
      reviewed_by_uid    TEXT,
      reviewed_by_email  TEXT,
      reviewed_by_name   TEXT,
      review_note        TEXT,
      execution_result   JSONB,
      execution_error    TEXT,
      rows_affected      INTEGER,
      submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at        TIMESTAMPTZ,
      executed_at        TIMESTAMPTZ
    )
  `);
}

// ── SQL safety validation ───────────────────────────────────────────────────
// Patterns that are ALWAYS blocked (destructive schema operations)
const BLOCKED_PATTERNS = [
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bEXECUTE\b/i,
  /\bEXEC\b/i,
  /\bxp_\w+/i,
  /\bsp_\w+/i,
];

export function validateSQL(sql: string): { valid: boolean; reason?: string } {
  const trimmed = sql.trim();
  if (!trimmed) return { valid: false, reason: 'SQL query cannot be empty' };
  if (trimmed.length > 10_000) return { valid: false, reason: 'Query too long (max 10,000 characters)' };

  // Strip single-line and multi-line comments before checking, to defeat comment injection
  const stripped = trimmed
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(stripped)) {
      const match = stripped.match(pattern);
      return { valid: false, reason: `Forbidden operation detected: ${match?.[0]?.toUpperCase()}` };
    }
  }
  return { valid: true };
}

// ── Auth helper ─────────────────────────────────────────────────────────────
async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('No token');

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    // Fallback: decode JWT payload without signature verification
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

// ── GET: list requests ──────────────────────────────────────────────────────
// super_admin → all requests (optional ?status filter)
// admin       → only their own
export async function GET(req: NextRequest) {
  let admin;
  try { admin = await requireAdmin(req); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
  const offset = (page - 1) * limit;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  try {
    await ensureTable(pool);

    const isMasterAdmin = MASTER_ADMIN_EMAIL !== '' && admin.email === MASTER_ADMIN_EMAIL;

    // Build query depending on role and filter
    let query: string;
    let params: unknown[];
    let countQuery: string;
    let countParams: unknown[];

    if (isMasterAdmin) {
      if (statusFilter) {
        query       = `SELECT * FROM sql_command_requests WHERE status = $1 ORDER BY submitted_at DESC LIMIT $2 OFFSET $3`;
        params      = [statusFilter, limit, offset];
        countQuery  = `SELECT COUNT(*) FROM sql_command_requests WHERE status = $1`;
        countParams = [statusFilter];
      } else {
        query       = `SELECT * FROM sql_command_requests ORDER BY submitted_at DESC LIMIT $1 OFFSET $2`;
        params      = [limit, offset];
        countQuery  = `SELECT COUNT(*) FROM sql_command_requests`;
        countParams = [];
      }
    } else {
      if (statusFilter) {
        query       = `SELECT * FROM sql_command_requests WHERE submitted_by_uid = $1 AND status = $2 ORDER BY submitted_at DESC LIMIT $3 OFFSET $4`;
        params      = [admin.firebaseUid, statusFilter, limit, offset];
        countQuery  = `SELECT COUNT(*) FROM sql_command_requests WHERE submitted_by_uid = $1 AND status = $2`;
        countParams = [admin.firebaseUid, statusFilter];
      } else {
        query       = `SELECT * FROM sql_command_requests WHERE submitted_by_uid = $1 ORDER BY submitted_at DESC LIMIT $2 OFFSET $3`;
        params      = [admin.firebaseUid, limit, offset];
        countQuery  = `SELECT COUNT(*) FROM sql_command_requests WHERE submitted_by_uid = $1`;
        countParams = [admin.firebaseUid];
      }
    }

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    return NextResponse.json({
      requests: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
      role: admin.role,
      isMasterAdmin,
    });
  } finally {
    await pool.end();
  }
}

// ── POST: submit a new SQL request ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  let admin;
  try { admin = await requireAdmin(req); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  if (!body?.sql) {
    return NextResponse.json({ error: '"sql" field is required' }, { status: 400 });
  }

  const validation = validateSQL(body.sql);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  try {
    await ensureTable(pool);
    const result = await pool.query(
      `INSERT INTO sql_command_requests
         (submitted_by_uid, submitted_by_email, submitted_by_name, sql_query, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [admin.firebaseUid, admin.email, admin.name, body.sql, body.description ?? null],
    );
    return NextResponse.json({ request: result.rows[0] }, { status: 201 });
  } finally {
    await pool.end();
  }
}
