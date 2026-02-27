import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, sql as drizzleSql, and } from 'drizzle-orm';
import {
  adminUsers,
  adminRequests,
  swapHistory,
  users,
  userSettings,
  type AdminUser,
  type AdminRequest,
} from '../../shared/schema';

const rawSql = neon(process.env.DATABASE_URL!);
const db = drizzle(rawSql);

export { adminUsers, adminRequests };

// ── Admin User helpers ─────────────────────────────────────────────────────

export async function getAdminByFirebaseUid(uid: string): Promise<AdminUser | null> {
  const rows = await db.select().from(adminUsers)
    .where(and(eq(adminUsers.firebaseUid, uid), eq(adminUsers.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAdminByEmail(email: string): Promise<AdminUser | null> {
  const rows = await db.select().from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);
  return rows[0] ?? null;
}

export async function createAdminUser(data: {
  firebaseUid: string;
  email: string;
  name: string;
  approvedBy: string;
}): Promise<AdminUser> {
  const rows = await db.insert(adminUsers).values({
    firebaseUid: data.firebaseUid,
    email: data.email,
    name: data.name,
    role: 'admin',
    isActive: true,
    approvedAt: new Date(),
    approvedBy: data.approvedBy,
  }).returning();
  return rows[0];
}

// ── Admin Request helpers ──────────────────────────────────────────────────

export async function getPendingRequestByToken(token: string): Promise<AdminRequest | null> {
  const rows = await db.select().from(adminRequests)
    .where(and(eq(adminRequests.approvalToken, token), eq(adminRequests.status, 'pending')))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRequestByEmail(email: string): Promise<AdminRequest | null> {
  const rows = await db.select().from(adminRequests)
    .where(eq(adminRequests.email, email))
    .limit(1);
  return rows[0] ?? null;
}

export async function createAdminRequest(data: {
  firebaseUid: string;
  email: string;
  name: string;
  reason?: string;
  approvalToken: string;
}): Promise<AdminRequest> {
  const rows = await db.insert(adminRequests).values({
    ...data,
    reason: data.reason ?? 'Admin access requested.',
  }).returning();
  return rows[0];
}

export async function approveAdminRequest(token: string, reviewerEmail: string) {
  await db.update(adminRequests).set({
    status: 'approved',
    reviewedAt: new Date(),
    reviewedBy: reviewerEmail,
    updatedAt: new Date(),
  }).where(eq(adminRequests.approvalToken, token));
}

export async function rejectAdminRequest(token: string, reviewerEmail: string, reason?: string) {
  await db.update(adminRequests).set({
    status: 'rejected',
    reviewedAt: new Date(),
    reviewedBy: reviewerEmail,
    rejectionReason: reason ?? 'Not approved by administrator.',
    updatedAt: new Date(),
  }).where(eq(adminRequests.approvalToken, token));
}

// ── Analytics helpers ──────────────────────────────────────────────────────

export interface PlatformAnalytics {
  totalSwaps: number;
  totalSwapsToday: number;
  totalSwapsWeek: number;
  totalSwapsMonth: number;
  successCount: number;
  failedCount: number;
  totalUsers: number;
  activeUsersToday: number;
  topAssets: { asset: string; network: string; count: number }[];
  topChains: { chain: string; count: number }[];
  recentSwaps: {
    id: number;
    userId: string;
    fromAsset: string;
    toAsset: string;
    fromNetwork: string;
    toNetwork: string;
    fromAmount: number;
    status: string;
    createdAt: Date | null;
  }[];
  swapsByDay: { date: string; count: number }[];
}

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now); startOfMonth.setDate(now.getDate() - 30);

  const todayStr  = startOfToday.toISOString();
  const weekStr   = startOfWeek.toISOString();
  const monthStr  = startOfMonth.toISOString();

  // All counts in one shot via conditional aggregation
  const [[counts], topAssetsRows, topChainsRows, recentSwapsRows, swapsByDayRows, [userCounts]] = await Promise.all([
    db.select({
      total:      drizzleSql<number>`count(*)::int`,
      today:      drizzleSql<number>`count(*) filter (where "created_at" >= ${todayStr}::timestamptz)::int`,
      week:       drizzleSql<number>`count(*) filter (where "created_at" >= ${weekStr}::timestamptz)::int`,
      month:      drizzleSql<number>`count(*) filter (where "created_at" >= ${monthStr}::timestamptz)::int`,
      success:    drizzleSql<number>`count(*) filter (where "status" = 'settled')::int`,
      failed:     drizzleSql<number>`count(*) filter (where "status" = 'failed')::int`,
    }).from(swapHistory),

    db.select({
      asset:   swapHistory.fromAsset,
      network: swapHistory.fromNetwork,
      cnt:     drizzleSql<number>`count(*)::int`,
    }).from(swapHistory)
      .groupBy(swapHistory.fromAsset, swapHistory.fromNetwork)
      .orderBy(drizzleSql`count(*) desc`)
      .limit(10),

    db.select({
      chain: swapHistory.fromNetwork,
      cnt:   drizzleSql<number>`count(*)::int`,
    }).from(swapHistory)
      .groupBy(swapHistory.fromNetwork)
      .orderBy(drizzleSql`count(*) desc`)
      .limit(10),

    db.select({
      id:          swapHistory.id,
      userId:      swapHistory.userId,
      fromAsset:   swapHistory.fromAsset,
      toAsset:     swapHistory.toAsset,
      fromNetwork: swapHistory.fromNetwork,
      toNetwork:   swapHistory.toNetwork,
      fromAmount:  swapHistory.fromAmount,
      status:      swapHistory.status,
      createdAt:   swapHistory.createdAt,
    }).from(swapHistory)
      .orderBy(desc(swapHistory.createdAt))
      .limit(20),

    db.select({
      date: drizzleSql<string>`date("created_at")::text`,
      cnt:  drizzleSql<number>`count(*)::int`,
    }).from(swapHistory)
      .where(drizzleSql`"created_at" >= ${monthStr}::timestamptz`)
      .groupBy(drizzleSql`date("created_at")`)
      .orderBy(drizzleSql`date("created_at")`),

    db.select({
      total:      drizzleSql<number>`count(*)::int`,
      todayActive: drizzleSql<number>`count(*) filter (where "created_at" >= ${todayStr}::timestamptz)::int`,
    }).from(users),
  ]);

  return {
    totalSwaps:      counts?.total ?? 0,
    totalSwapsToday: counts?.today ?? 0,
    totalSwapsWeek:  counts?.week ?? 0,
    totalSwapsMonth: counts?.month ?? 0,
    successCount:    counts?.success ?? 0,
    failedCount:     counts?.failed ?? 0,
    totalUsers:      userCounts?.total ?? 0,
    activeUsersToday: userCounts?.todayActive ?? 0,
    topAssets:  topAssetsRows.map(r  => ({ asset: r.asset, network: r.network, count: r.cnt })),
    topChains:  topChainsRows.map(r  => ({ chain: r.chain, count: r.cnt })),
    recentSwaps: recentSwapsRows,
    swapsByDay: swapsByDayRows.map(r => ({ date: r.date, count: r.cnt })),
  };
}

// ── Admin User Management ─────────────────────────────────────────────────

export interface AdminUserRow {
  id: number;
  firebaseUid: string | null;
  walletAddress: string | null;
  email: string | null;
  plan: string;
  totalPoints: number;
  createdAt: string | null;
  swapCount: number;
  suspended: boolean;
  flagged: boolean;
  suspendedBy: string | null;
  suspendedAt: string | null;
  suspendReason: string | null;
  flaggedBy: string | null;
  flaggedAt: string | null;
  flagReason: string | null;
}

export async function getAdminUsersList(
  page: number,
  limit: number,
  search?: string,
): Promise<{ rows: AdminUserRow[]; total: number }> {
  const offset = (page - 1) * limit;

  let totalResult: { total: number }[];
  let rowsResult: {
    id: number;
    firebase_uid: string | null;
    wallet_address: string | null;
    plan: string;
    total_points: number;
    created_at: string | null;
    swap_count: number;
    preferences: string | null;
  }[];

  if (search) {
    const pattern = `%${search}%`;
    totalResult = (await rawSql`
      SELECT count(*)::int AS total FROM users u
      WHERE u.wallet_address ILIKE ${pattern}
         OR u.firebase_uid   ILIKE ${pattern}
    `) as { total: number }[];
    rowsResult = (await rawSql`
      SELECT
        u.id,
        u.firebase_uid,
        u.wallet_address,
        u.plan,
        u.total_points,
        u.created_at,
        COALESCE(sc.cnt, 0)::int AS swap_count,
        us.preferences
      FROM users u
      LEFT JOIN (
        SELECT user_id, count(*)::int AS cnt FROM swap_history GROUP BY user_id
      ) sc ON sc.user_id = u.firebase_uid
      LEFT JOIN user_settings us ON us.user_id = u.firebase_uid
      WHERE u.wallet_address ILIKE ${pattern}
         OR u.firebase_uid   ILIKE ${pattern}
      ORDER BY u.created_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `) as {
      id: number;
      firebase_uid: string | null;
      wallet_address: string | null;
      plan: string;
      total_points: number;
      created_at: string | null;
      swap_count: number;
      preferences: string | null;
    }[];
  } else {
    totalResult = (await rawSql`SELECT count(*)::int AS total FROM users`) as { total: number }[];
    rowsResult = (await rawSql`
      SELECT
        u.id,
        u.firebase_uid,
        u.wallet_address,
        u.plan,
        u.total_points,
        u.created_at,
        COALESCE(sc.cnt, 0)::int AS swap_count,
        us.preferences
      FROM users u
      LEFT JOIN (
        SELECT user_id, count(*)::int AS cnt FROM swap_history GROUP BY user_id
      ) sc ON sc.user_id = u.firebase_uid
      LEFT JOIN user_settings us ON us.user_id = u.firebase_uid
      ORDER BY u.created_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `) as {
      id: number;
      firebase_uid: string | null;
      wallet_address: string | null;
      plan: string;
      total_points: number;
      created_at: string | null;
      swap_count: number;
      preferences: string | null;
    }[];
  }

  const rows: AdminUserRow[] = rowsResult.map((r) => {
    let prefs: Record<string, unknown> = {};
    try { prefs = r.preferences ? JSON.parse(r.preferences) : {}; } catch {}
    const s = (prefs.adminStatus ?? {}) as {
      suspended?: boolean;
      flagged?: boolean;
      suspendedBy?: string | null;
      suspendedAt?: string | null;
      suspendReason?: string | null;
      flaggedBy?: string | null;
      flaggedAt?: string | null;
      flagReason?: string | null;
    };
    return {
      id:           r.id,
      firebaseUid:  r.firebase_uid,
      walletAddress: r.wallet_address,
      plan:         r.plan ?? 'free',
      totalPoints:  r.total_points ?? 0,
      createdAt:    r.created_at ? new Date(r.created_at).toISOString() : null,
      swapCount:    r.swap_count ?? 0,
      suspended:    s.suspended ?? false,
      flagged:      s.flagged ?? false,
      suspendedBy:  s.suspendedBy ?? null,
      suspendedAt:  s.suspendedAt ?? null,
      suspendReason: s.suspendReason ?? null,
      flaggedBy:    s.flaggedBy ?? null,
      flaggedAt:    s.flaggedAt ?? null,
      flagReason:   s.flagReason ?? null,
      email:        null, // enriched by API layer via Firebase Admin
    };
  });

  return { rows, total: totalResult[0]?.total ?? 0 };
}

/** Get swap history for a specific user (admin context) */
export async function getUserSwapsForAdmin(userId: string, limit = 50) {
  return db
    .select()
    .from(swapHistory)
    .where(eq(swapHistory.userId, userId))
    .orderBy(desc(swapHistory.createdAt))
    .limit(limit);
}

/** Suspend / unsuspend / flag / unflag a user.
 *  Stored in userSettings.preferences under adminStatus key.
 */
export async function updateUserAdminStatus(
  firebaseUid: string,
  action: 'suspend' | 'unsuspend' | 'flag' | 'unflag',
  adminEmail: string,
  reason?: string,
): Promise<void> {
  // Fetch existing preferences
  const existing = await db
    .select({ preferences: userSettings.preferences })
    .from(userSettings)
    .where(eq(userSettings.userId, firebaseUid))
    .limit(1);

  let prefs: Record<string, unknown> = {};
  if (existing[0]?.preferences) {
    try { prefs = JSON.parse(existing[0].preferences); } catch {}
  }

  const adminStatus: {
    suspended?: boolean;
    flagged?: boolean;
    suspendedBy?: string | null;
    suspendedAt?: string | null;
    suspendReason?: string | null;
    flaggedBy?: string | null;
    flaggedAt?: string | null;
    flagReason?: string | null;
  } = (prefs.adminStatus ?? {});
  const now = new Date().toISOString();

  switch (action) {
    case 'suspend':
      adminStatus.suspended    = true;
      adminStatus.suspendedBy  = adminEmail;
      adminStatus.suspendedAt  = now;
      adminStatus.suspendReason = reason ?? null;
      break;
    case 'unsuspend':
      adminStatus.suspended    = false;
      adminStatus.suspendedBy  = null;
      adminStatus.suspendedAt  = null;
      adminStatus.suspendReason = null;
      break;
    case 'flag':
      adminStatus.flagged    = true;
      adminStatus.flaggedBy  = adminEmail;
      adminStatus.flaggedAt  = now;
      adminStatus.flagReason = reason ?? null;
      break;
    case 'unflag':
      adminStatus.flagged    = false;
      adminStatus.flaggedBy  = null;
      adminStatus.flaggedAt  = null;
      adminStatus.flagReason = null;
      break;
  }

  prefs.adminStatus = adminStatus;
  const prefsStr = JSON.stringify(prefs);

  if (existing.length > 0) {
    await db.update(userSettings).set({
      preferences: prefsStr,
      updatedAt: new Date(),
    }).where(eq(userSettings.userId, firebaseUid));
  } else {
    await db.insert(userSettings).values({
      userId:     firebaseUid,
      preferences: prefsStr,
      updatedAt:  new Date(),
    });
  }
}
