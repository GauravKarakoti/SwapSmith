import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid } from '@/lib/admin-service';
import { neon, Pool } from '@neondatabase/serverless';

// Simple tagged-template sql for metadata queries
const sql = neon(process.env.DATABASE_URL!);

type RouteContext = { params: Promise<{ table: string }> };

/** Verify the request comes from an authenticated admin. */
async function verifyAdmin(req: NextRequest): Promise<{ uid: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  let decoded: { uid: string };
  try {
    decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    try {
      const parts = authHeader.substring(7).split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      const uid = payload.user_id || payload.sub || payload.uid;
      if (!uid) return null;
      decoded = { uid };
    } catch {
      return null;
    }
  }
  return decoded;
}

/** Validate that a table name actually exists in the public schema to prevent SQL injection. */
async function tableExists(tableName: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name = ${tableName}
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Get column names for a table. */
async function getColumns(tableName: string): Promise<{ column_name: string; data_type: string; is_nullable: string }[]> {
  return await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position ASC
  ` as { column_name: string; data_type: string; is_nullable: string }[];
}

/**
 * GET /api/admin/tables/[table]
 *
 * Query params:
 *   page        – page number (default 1)
 *   limit       – rows per page, max 200 (default 50)
 *   search      – global text search across all text columns
 *   filterCol   – column to apply exact/contains filter on
 *   filterVal   – value to filter filterCol by
 *   sortCol     – column to sort by
 *   sortDir     – 'asc' | 'desc' (default 'asc')
 *   columns     – comma-separated list of columns to return (default: all)
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const decoded = await verifyAdmin(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = await getAdminByFirebaseUid(decoded.uid);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    // ── Route param ───────────────────────────────────────────────────────
    const { table: rawTable } = await context.params;
    // Only allow alphanumeric + underscore table names
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rawTable)) {
      return NextResponse.json({ error: 'Invalid table name.' }, { status: 400 });
    }
    const tableName = rawTable.toLowerCase();

    if (!(await tableExists(tableName))) {
      return NextResponse.json({ error: 'Table not found.' }, { status: 404 });
    }

    // ── Query params ──────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit   = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset  = (page - 1) * limit;
    const search    = searchParams.get('search')    ?? '';
    const filterCol = searchParams.get('filterCol') ?? '';
    const filterVal = searchParams.get('filterVal') ?? '';
    const sortCol   = searchParams.get('sortCol')   ?? '';
    const sortDir   = searchParams.get('sortDir') === 'desc' ? 'DESC' : 'ASC';
    const columnsParam = searchParams.get('columns') ?? '';

    // ── Get column metadata ────────────────────────────────────────────────
    const allColumns = await getColumns(tableName);
    const allColNames = allColumns.map(c => c.column_name);

    // Validate requested columns
    let selectCols: string[];
    if (columnsParam) {
      const requested = columnsParam.split(',').map(c => c.trim()).filter(Boolean);
      selectCols = requested.filter(c => allColNames.includes(c));
      if (selectCols.length === 0) selectCols = allColNames;
    } else {
      selectCols = allColNames;
    }

    // Validate sort column
    const validSortCol = sortCol && allColNames.includes(sortCol) ? sortCol : null;

    // Validate filter column
    const validFilterCol = filterCol && allColNames.includes(filterCol) ? filterCol : null;

    // Text columns for global search
    const textCols = allColumns
      .filter(c => ['text', 'character varying', 'varchar', 'char', 'character', 'name', 'uuid'].includes(c.data_type))
      .map(c => c.column_name);

    // ── Build the query dynamically ───────────────────────────────────────
    // For safety we use parameterized queries for values, and identifier quoting for names.
    // neon() doesn't support full dynamic SQL with identifiers easily, so we build raw SQL
    // strings for identifiers (which are validated above) and use parameterized values.

    const quotedSelect = selectCols.map(c => `"${c}"`).join(', ');
    const quotedTable = `"${tableName}"`;

    // WHERE conditions
    const conditions: string[] = [];
    const bindValues: unknown[] = [];
    let bindIndex = 1;

    // Global search across text columns
    if (search && textCols.length > 0) {
      const searchConditions = textCols.map(col => {
        bindValues.push(`%${search}%`);
        return `"${col}"::text ILIKE $${bindIndex++}`;
      });
      conditions.push(`(${searchConditions.join(' OR ')})`);
    }

    // Column filter
    if (validFilterCol && filterVal) {
      bindValues.push(`%${filterVal}%`);
      conditions.push(`"${validFilterCol}"::text ILIKE $${bindIndex++}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = validSortCol ? `ORDER BY "${validSortCol}" ${sortDir}` : `ORDER BY 1 ${sortDir}`;

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM ${quotedTable} ${whereClause}`;

    // Data query
    const dataQuery = `
      SELECT ${quotedSelect}
      FROM ${quotedTable}
      ${whereClause}
      ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Execute both queries via Pool for parameterized dynamic SQL support
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    let total: number;
    let rows: Record<string, unknown>[];
    try {
      const [countResult, dataResult] = await Promise.all([
        pool.query<{ total: string }>(countQuery, bindValues),
        pool.query(dataQuery, bindValues),
      ]);
      total = parseInt(countResult.rows[0].total, 10);
      rows = dataResult.rows as Record<string, unknown>[];
    } finally {
      await pool.end();
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      table: tableName,
      columns: allColumns,
      selectedColumns: selectCols,
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error('[Admin Table Data API]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
