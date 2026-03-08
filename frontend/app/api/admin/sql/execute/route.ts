import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid } from '@/lib/admin-service';
import { Pool } from '@neondatabase/serverless';
import { validateSQL } from '../route';

const MASTER_ADMIN_EMAIL = process.env.ADMIN_MASTER_EMAIL || '';

// Patterns allowed to run directly (read-only or master override)
const SELECT_ONLY_PATTERNS = /^\s*(SELECT|WITH|EXPLAIN|SHOW)\b/i;

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

export async function POST(req: NextRequest) {
  let admin;
  try { admin = await requireAdmin(req); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  if (!body?.sql) {
    return NextResponse.json({ error: '"sql" field is required' }, { status: 400 });
  }

  const sql: string = body.sql;
  const masterOverride: boolean = body.masterOverride === true;
  const isMasterAdmin = MASTER_ADMIN_EMAIL !== '' && admin.email === MASTER_ADMIN_EMAIL;

  // Validate against always-blocked patterns
  const validation = validateSQL(sql);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  // Strip comments for intent detection
  const stripped = sql.trim()
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

  const isSelectQuery = SELECT_ONLY_PATTERNS.test(stripped);

  // Non-master admins can only run SELECT queries directly
  if (!isSelectQuery && !isMasterAdmin) {
    return NextResponse.json(
      { error: 'Only SELECT queries can run directly. Submit INSERT/UPDATE/CREATE for master admin approval.' },
      { status: 403 },
    );
  }

  // Master override required for non-SELECT queries
  if (!isSelectQuery && isMasterAdmin && !masterOverride) {
    return NextResponse.json(
      { error: 'Set masterOverride: true to run non-SELECT queries directly as master admin.' },
      { status: 400 },
    );
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  try {
    const res = await pool.query(sql);
    const result = {
      rowCount: res.rowCount ?? 0,
      rows: (res.rows ?? []).slice(0, 500),
      fields: (res.fields ?? []).map((f: { name: string; dataTypeID: number }) => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })),
    };
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  } finally {
    await pool.end();
  }
}
