import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid } from '@/lib/admin-service';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * GET /api/admin/tables
 * Returns all Neon Postgres public tables with metadata.
 * Admin-only – requires Bearer token (same pattern as other admin endpoints).
 */
export async function GET(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded: { uid: string };
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch (verifyErr) {
      console.warn('[Admin Tables] verifyIdToken failed, falling back to JWT decode:', verifyErr);
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

    const admin = await getAdminByFirebaseUid(decoded.uid);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    // ── Query table metadata ──────────────────────────────────────────────
    const tables = await sql`
      SELECT
        t.table_name,
        (
          SELECT COUNT(*)::int
          FROM information_schema.columns c
          WHERE c.table_name = t.table_name
            AND c.table_schema = 'public'
        ) AS column_count,
        COALESCE(s.n_live_tup, 0)::bigint AS row_estimate,
        pg_size_pretty(
          pg_total_relation_size(('public.' || quote_ident(t.table_name))::regclass)
        ) AS table_size,
        to_char(s.last_vacuum,      'YYYY-MM-DD HH24:MI') AS last_vacuum,
        to_char(s.last_autovacuum,  'YYYY-MM-DD HH24:MI') AS last_autovacuum,
        to_char(s.last_analyze,     'YYYY-MM-DD HH24:MI') AS last_analyze,
        to_char(s.last_autoanalyze, 'YYYY-MM-DD HH24:MI') AS last_autoanalyze
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s
        ON s.relname = t.table_name AND s.schemaname = 'public'
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name ASC
    `;

    return NextResponse.json({ success: true, tables });
  } catch (err) {
    console.error('[Admin Tables API]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
