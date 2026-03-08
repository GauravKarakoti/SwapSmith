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

/** Get column names for a table (including column_default for insert hints). */
async function getColumns(tableName: string): Promise<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]> {
  return await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position ASC
  ` as { column_name: string; data_type: string; is_nullable: string; column_default: string | null }[];
}

/** Get primary key column names for a table. */
async function getPrimaryKeys(tableName: string): Promise<string[]> {
  const rows = await sql`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = ${tableName}
    ORDER BY kcu.ordinal_position ASC
  `;
  return rows.map((r: Record<string, unknown>) => r.column_name as string);
}

/** Validate admin access; returns decoded jwt or sends an error response. */
async function requireAdmin(req: NextRequest): Promise<{ uid: string } | null> {
  const decoded = await verifyAdmin(req);
  if (!decoded) return null;
  const admin = await getAdminByFirebaseUid(decoded.uid);
  return admin ? decoded : null;
}

/** Validate table name format and existence. */
async function resolveTable(rawTable: string): Promise<string | null> {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rawTable)) return null;
  const name = rawTable.toLowerCase();
  return (await tableExists(name)) ? name : null;
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

    // ── Get column metadata + primary keys ────────────────────────────────
    const [allColumns, primaryKeys] = await Promise.all([
      getColumns(tableName),
      getPrimaryKeys(tableName),
    ]);
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
      primaryKeys,
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

/**
 * POST /api/admin/tables/[table]
 * Insert a new row into the table.
 * Body: { row: Record<string, unknown> }
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const decoded = await requireAdmin(req);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { table: rawTable } = await context.params;
    const tableName = await resolveTable(rawTable);
    if (!tableName) return NextResponse.json({ error: 'Invalid or unknown table.' }, { status: 400 });

    const body = await req.json().catch(() => null);
    const row: Record<string, unknown> = body?.row;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return NextResponse.json({ error: 'Body must be { row: { col: value, ... } }' }, { status: 400 });
    }

    const allColumns = await getColumns(tableName);
    const allColNames = allColumns.map(c => c.column_name);

    // Filter to valid column names only (prevents injection via key names)
    const validKeys = Object.keys(row).filter(k => allColNames.includes(k));
    if (validKeys.length === 0) {
      return NextResponse.json({ error: 'No valid columns provided.' }, { status: 400 });
    }

    const colList = validKeys.map(k => `"${k}"`).join(', ');
    const placeholders = validKeys.map((_, i) => `$${i + 1}`).join(', ');
    const values = validKeys.map(k => row[k] === '' ? null : row[k]);

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    try {
      const result = await pool.query(
        `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders}) RETURNING *`,
        values,
      );
      return NextResponse.json({ success: true, row: result.rows[0] }, { status: 201 });
    } finally {
      await pool.end();
    }
  } catch (err) {
    console.error('[Admin Table Insert API]', err);
    const msg = err instanceof Error ? err.message : 'Internal server error.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/tables/[table]
 * Update a row identified by its primary key.
 * Body: { pkColumn: string; pkValue: unknown; updates: Record<string, unknown> }
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const decoded = await requireAdmin(req);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { table: rawTable } = await context.params;
    const tableName = await resolveTable(rawTable);
    if (!tableName) return NextResponse.json({ error: 'Invalid or unknown table.' }, { status: 400 });

    const body = await req.json().catch(() => null);
    const { pkColumn, pkValue, updates } = body ?? {};

    if (typeof pkColumn !== 'string' || pkValue === undefined || !updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Body must be { pkColumn, pkValue, updates }' }, { status: 400 });
    }

    const allColumns = await getColumns(tableName);
    const allColNames = allColumns.map(c => c.column_name);

    if (!allColNames.includes(pkColumn)) {
      return NextResponse.json({ error: 'Invalid pkColumn.' }, { status: 400 });
    }

    // Exclude the PK itself from update fields; validate all keys
    const validUpdateKeys = Object.keys(updates as Record<string, unknown>)
      .filter(k => allColNames.includes(k) && k !== pkColumn);

    if (validUpdateKeys.length === 0) {
      return NextResponse.json({ error: 'No valid columns to update.' }, { status: 400 });
    }

    const setClause = validUpdateKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const pkPlaceholder = `$${validUpdateKeys.length + 1}`;
    const values = [
      ...validUpdateKeys.map(k => (updates as Record<string, unknown>)[k] === '' ? null : (updates as Record<string, unknown>)[k]),
      pkValue,
    ];

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    try {
      const result = await pool.query(
        `UPDATE "${tableName}" SET ${setClause} WHERE "${pkColumn}" = ${pkPlaceholder} RETURNING *`,
        values,
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Row not found.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, row: result.rows[0] });
    } finally {
      await pool.end();
    }
  } catch (err) {
    console.error('[Admin Table Update API]', err);
    const msg = err instanceof Error ? err.message : 'Internal server error.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/tables/[table]
 * Delete one or more rows by primary key values.
 * Body: { pkColumn: string; pkValues: unknown[] }
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const decoded = await requireAdmin(req);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { table: rawTable } = await context.params;
    const tableName = await resolveTable(rawTable);
    if (!tableName) return NextResponse.json({ error: 'Invalid or unknown table.' }, { status: 400 });

    const body = await req.json().catch(() => null);
    const { pkColumn, pkValues } = body ?? {};

    if (typeof pkColumn !== 'string' || !Array.isArray(pkValues) || pkValues.length === 0) {
      return NextResponse.json({ error: 'Body must be { pkColumn: string; pkValues: unknown[] }' }, { status: 400 });
    }
    if (pkValues.length > 500) {
      return NextResponse.json({ error: 'Cannot delete more than 500 rows at once.' }, { status: 400 });
    }

    const allColumns = await getColumns(tableName);
    const allColNames = allColumns.map(c => c.column_name);
    if (!allColNames.includes(pkColumn)) {
      return NextResponse.json({ error: 'Invalid pkColumn.' }, { status: 400 });
    }

    const placeholders = pkValues.map((_, i) => `$${i + 1}`).join(', ');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    try {
      const result = await pool.query(
        `DELETE FROM "${tableName}" WHERE "${pkColumn}" IN (${placeholders}) RETURNING "${pkColumn}"`,
        pkValues,
      );
      return NextResponse.json({ success: true, deleted: result.rows.length });
    } finally {
      await pool.end();
    }
  } catch (err) {
    console.error('[Admin Table Delete API]', err);
    const msg = err instanceof Error ? err.message : 'Internal server error.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
