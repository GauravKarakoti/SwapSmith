import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid } from '@/lib/admin-service';
import { db } from '@/shared/lib/db';
import { adminAuditLog } from '@/shared/schema';
import { desc, and, eq, gte, sql } from 'drizzle-orm';
import { logAdminAction, AUDIT_ACTIONS, getIpAddress, getUserAgent } from '@/shared/lib/audit-logger';

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

/**
 * GET /api/admin/audit-log
 * Returns audit log entries for admin actions.
 * Query params:
 *   page   – default 1
 *   limit  – default 50, max 100
 *   action – optional filter by action type
 *   adminId – optional filter by admin ID
 *   days   – optional filter by number of days (default 30)
 * 
 * Only accessible by super_admin role.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await authenticate(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super_admin can access audit logs
    if (admin.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden. Only super_admin can access audit logs.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const action = searchParams.get('action') || undefined;
    const adminId = searchParams.get('adminId') || undefined;
    const days = parseInt(searchParams.get('days') || '30');

    // Build where conditions
    const conditions = [];
    
    // Filter by date (last N days)
    if (days > 0) {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);
      conditions.push(gte(adminAuditLog.createdAt, dateThreshold));
    }
    
    // Filter by action
    if (action) {
      conditions.push(eq(adminAuditLog.action, action));
    }
    
    // Filter by admin ID
    if (adminId) {
      conditions.push(eq(adminAuditLog.adminId, adminId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminAuditLog)
      .where(whereClause);
    
    const total = countResult?.count || 0;

    // Get paginated results
    const offset = (page - 1) * limit;
    const logs = await db
      .select()
      .from(adminAuditLog)
      .where(whereClause)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(limit)
      .offset(offset);

    // Log that audit log was accessed
    await logAdminAction({
      adminId: admin.firebaseUid,
      adminEmail: admin.email,
      action: AUDIT_ACTIONS.VIEW_AUDIT_LOG,
      targetResource: 'audit_log',
      metadata: {
        page,
        limit,
        action,
        adminId,
        days,
      },
      ipAddress: getIpAddress(req.headers),
      userAgent: getUserAgent(req.headers),
    });

    return NextResponse.json({
      success: true,
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[Admin Audit Log GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
