
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, sql as drizzleSql, and, or, ilike } from 'drizzle-orm';
import {
  adminUsers,
  adminRequests,
  swapHistory,
  users,
  userSettings,
  type AdminUser,
  type AdminRequest,
} from '../../shared/schema';

// Database instance - lazily initialized to avoid build-time errors
let dbInstance: ReturnType<typeof drizzle> | undefined;
let sqlInstance: ReturnType<typeof neon> | undefined;

function getDb() {
  if (!dbInstance) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL is not set');
    }
    sqlInstance = neon(dbUrl);
    dbInstance = drizzle(sqlInstance);
  }
  return dbInstance;
}

function getRawSql() {
  if (!sqlInstance) {
    getDb(); // This will initialize both
  }
  return sqlInstance!;
}

export { adminUsers, adminRequests };

// ── Admin User helpers ─────────────────────────────────────────────────────

export async function getAdminByFirebaseUid(uid: string): Promise<AdminUser | null> {
  const rows = await getDb().select().from(adminUsers)
    .where(and(eq(adminUsers.firebaseUid, uid), eq(adminUsers.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAdminByEmail(email: string): Promise<AdminUser | null> {
  const rows = await getDb().select().from(adminUsers)
    .where(eq(adminUsers.email, email))

export async function createAdminUser(data: {
  firebaseUid: string;
  email: string;
  name: string;
  approvedBy: string;
}): Promise<AdminUser> {
  const rows = await getDb().insert(adminUsers).values({
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
  const rows = await getDb().select().from(adminRequests)
    .where(and(eq(adminRequests.approvalToken, token), eq(adminRequests.status, 'pending')))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRequestByEmail(email: string): Promise<AdminRequest | null> {
  const rows = await getDb().select().from(adminRequests)
    .where(eq(adminRequests.email, email))
    .limit(1);
  return rows[0] ?? null;
}

export async function createAdminRequest(data: {
  firebaseUid: string;
  email: string;
    ...data,
    reason: data.reason ?? 'Admin access requested.',
  }).returning();
  return rows[0];
}

export async function approveAdminRequest(token: string, reviewerEmail: string) {
  await getDb().update(adminRequests).set({
    status: 'approved',
    reviewedAt: new Date(),
    reviewedBy: reviewerEmail,
    updatedAt: new Date(),
  }).where(eq(adminRequests.approvalToken, token));
}

export async function rejectAdminRequest(token: string, reviewerEmail: string, reason?: string) {
  await getDb().update(adminRequests).set({
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

  const database = getDb();

  // All counts in one shot via conditional aggregation
  const [[counts], topAssetsRows, topChainsRows, recentSwapsRows, swapsByDayRows, [userCounts]] = await Promise.all([
    database.select({
      total:      drizzleSql<number>`count(*)::int`,
      today:      drizzleSql<number>`count(*) filter (where "created_at" >= ${todayStr}::timestamptz)::int`,
      week:       drizzleSql<number>`count(*) filter (where "created_at" >= ${weekStr}::timestamptz)::int`,
      month:      drizzleSql<number>`count(*) filter (where "created_at" >= ${monthStr}::timestamptz)::int`,
      success:    drizzleSql<number>`count(*) filter (where "status" = 'settled')::int`,
      failed:     drizzleSql<number>`count(*) filter (where "status" = 'failed')::int`,
    }).from(swapHistory),

    database.select({
      asset:   swapHistory.fromAsset,
      network: swapHistory.fromNetwork,
      cnt:     drizzleSql<number>`count(*)::int`,
    }).from(swapHistory)
      .groupBy(swapHistory.fromAsset, swapHistory.fromNetwork)
      .orderBy(drizzleSql`count(*) desc`)
      .limit(10),

    database.select({
      chain: swapHistory.fromNetwork,
      cnt:   drizzleSql<number>`count(*)::int`,
    }).from(swapHistory)
      .groupBy(swapHistory.fromNetwork)
      .orderBy(drizzleSql`count(*) desc`)
      .limit(10),

    database.select({
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

    database.select({
      date: drizzleSql<string>`date("created_at")::text`,
      cnt:  drizzleSql<number>`count(*)::int`,
    }).from(swapHistory)
      .where(drizzleSql`"created_at" >= ${monthStr}::timestamptz`)
      .groupBy(drizzleSql`date("created_at")`)
      .orderBy(drizzleSql`date("created_at")`),

    database.select({
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

// ── Admin Swap Monitoring ──────────────────────────────────────────────────

export interface AdminSwapRow {
  id: number;
  userId: string;
  walletAddress: string | null;
  sideshiftOrderId: string;
  quoteId: string | null;
  fromAsset: string;
  fromNetwork: string;
  fromAmount: number;
  toAsset: string;
  toNetwork: string;
  settleAmount: string;
  depositAddress: string | null;
  status: string;
  txHash: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function getAdminSwaps(
  page: number,
  limit: number,
  status?: string,
  search?: string,
): Promise<{ rows: AdminSwapRow[]; total: number }> {
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [];
  if (status && status !== 'all') {
    conditions.push(eq(swapHistory.status, status));
  }
  if (search) {
    const pat = `%${search}%`;
    conditions.push(or(
      ilike(swapHistory.sideshiftOrderId, pat),
      ilike(swapHistory.userId, pat),
      ilike(swapHistory.fromAsset, pat),
      ilike(swapHistory.toAsset, pat),
    )!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRows, rowsResult] = await Promise.all([
    db.select({ total: drizzleSql<number>`count(*)::int` })
      .from(swapHistory)
      .where(where),
    db.select({
      id:               swapHistory.id,
      userId:           swapHistory.userId,
      walletAddress:    swapHistory.walletAddress,
      sideshiftOrderId: swapHistory.sideshiftOrderId,
      quoteId:          swapHistory.quoteId,
      fromAsset:        swapHistory.fromAsset,
      fromNetwork:      swapHistory.fromNetwork,
      fromAmount:       swapHistory.fromAmount,
      toAsset:          swapHistory.toAsset,
      toNetwork:        swapHistory.toNetwork,
      settleAmount:     swapHistory.settleAmount,
      depositAddress:   swapHistory.depositAddress,
      status:           swapHistory.status,
      txHash:           swapHistory.txHash,
      createdAt:        swapHistory.createdAt,
      updatedAt:        swapHistory.updatedAt,
    })
      .from(swapHistory)
      .where(where)
      .orderBy(desc(swapHistory.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const rows: AdminSwapRow[] = rowsResult.map(r => ({
    id:               r.id,
    userId:           r.userId,
    walletAddress:    r.walletAddress,
    sideshiftOrderId: r.sideshiftOrderId,
    quoteId:          r.quoteId,
    fromAsset:        r.fromAsset,
    fromNetwork:      r.fromNetwork,
    fromAmount:       r.fromAmount,
    toAsset:          r.toAsset,
    toNetwork:        r.toNetwork,
    settleAmount:     r.settleAmount,
    depositAddress:   r.depositAddress,
    status:           r.status,
    txHash:           r.txHash,
    createdAt:        r.createdAt ? r.createdAt.toISOString() : null,
    updatedAt:        r.updatedAt ? r.updatedAt.toISOString() : null,
  }));

  return { rows, total: countRows[0]?.total ?? 0 };
}

export async function getAdminSwapById(sideshiftOrderId: string): Promise<AdminSwapRow | null> {
  const rows = await db.select({
    id:               swapHistory.id,
    userId:           swapHistory.userId,
    walletAddress:    swapHistory.walletAddress,
    sideshiftOrderId: swapHistory.sideshiftOrderId,
    quoteId:          swapHistory.quoteId,
    fromAsset:        swapHistory.fromAsset,
    fromNetwork:      swapHistory.fromNetwork,
    fromAmount:       swapHistory.fromAmount,
    toAsset:          swapHistory.toAsset,
    toNetwork:        swapHistory.toNetwork,
    settleAmount:     swapHistory.settleAmount,
    depositAddress:   swapHistory.depositAddress,
    status:           swapHistory.status,
    txHash:           swapHistory.txHash,
    createdAt:        swapHistory.createdAt,
    updatedAt:        swapHistory.updatedAt,
  })
    .from(swapHistory)
    .where(eq(swapHistory.sideshiftOrderId, sideshiftOrderId))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  return {
    id:               r.id,
    userId:           r.userId,
    walletAddress:    r.walletAddress,
    sideshiftOrderId: r.sideshiftOrderId,
    quoteId:          r.quoteId,
    fromAsset:        r.fromAsset,
    fromNetwork:      r.fromNetwork,
    fromAmount:       r.fromAmount,
    toAsset:          r.toAsset,
    toNetwork:        r.toNetwork,
    settleAmount:     r.settleAmount,
    depositAddress:   r.depositAddress,
    status:           r.status,
    txHash:           r.txHash,
    createdAt:        r.createdAt ? r.createdAt.toISOString() : null,
    updatedAt:        r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

export interface SwapMetrics {
  totalAllTime: number;
  last24h: number;
  last1h: number;
  last5min: number;
  statusBreakdown: { status: string; count: number }[];
  perHour: { hour: string; count: number }[];
  errorRate: number;
  spikeDetected: boolean;
  averagePer5Min: number;
}

export async function getSwapMetrics(): Promise<SwapMetrics> {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const h1  = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
  const m5  = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  const [totals, statusRows, hourRows] = await Promise.all([
    rawSql`
      SELECT
        count(*)::int AS total,
        count(*) filter (where created_at >= ${h24}::timestamptz)::int AS last_24h,
        count(*) filter (where created_at >= ${h1}::timestamptz)::int AS last_1h,
        count(*) filter (where created_at >= ${m5}::timestamptz)::int AS last_5min,
        count(*) filter (where status = 'failed' AND created_at >= ${h24}::timestamptz)::int AS failed_24h
      FROM swap_history
    `,
    rawSql`
      SELECT status, count(*)::int AS cnt
      FROM swap_history
      GROUP BY status
      ORDER BY cnt DESC
    `,
    rawSql`
      SELECT date_trunc('hour', created_at)::text AS hour, count(*)::int AS cnt
      FROM swap_history
      WHERE created_at >= ${h24}::timestamptz
      GROUP BY date_trunc('hour', created_at)
      ORDER BY hour ASC
    `,
  ]);

  type TotalsRow = { total: number; last_24h: number; last_1h: number; last_5min: number; failed_24h: number };
  type StatusRow = { status: string; cnt: number };
  type HourRow   = { hour: string; cnt: number };

  const t = (totals as TotalsRow[])[0] ?? { total: 0, last_24h: 0, last_1h: 0, last_5min: 0, failed_24h: 0 };
  const statusBreakdown = (statusRows as StatusRow[]).map(r => ({ status: r.status, count: r.cnt }));
  const perHour = (hourRows as HourRow[]).map(r => ({ hour: r.hour, count: r.cnt }));

  const avgPer5Min = t.last_1h > 0 ? t.last_1h / 12 : 0;
  const spikeDetected = t.last_5min > Math.max(avgPer5Min * 3, 10);
  const errorRate = t.last_24h > 0 ? Math.round((t.failed_24h / t.last_24h) * 100) : 0;

  return {
    totalAllTime: t.total,
    last24h: t.last_24h,
    last1h: t.last_1h,
    last5min: t.last_5min,
    statusBreakdown,
    perHour,
    errorRate,
    spikeDetected,
    averagePer5Min: Math.round(avgPer5Min * 10) / 10,
  };
}

// ── Platform Config (emergency stop + API key) ─────────────────────────────
// Stored in user_settings with userId = '__platform__'

export interface PlatformSwapConfig {
  swapExecutionEnabled: boolean;
  sideshiftApiKey: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export async function getPlatformSwapConfig(): Promise<PlatformSwapConfig> {
  const rows = await db.select({ preferences: userSettings.preferences })
    .from(userSettings)
    .where(eq(userSettings.userId, '__platform__'))
    .limit(1);

  if (!rows[0]?.preferences) {
    return { swapExecutionEnabled: true, sideshiftApiKey: '', updatedAt: null, updatedBy: null };
  }
  try {
    const p = JSON.parse(rows[0].preferences);
    return {
      swapExecutionEnabled: p.swapExecutionEnabled ?? true,
      sideshiftApiKey: p.sideshiftApiKey ?? '',
      updatedAt: p.updatedAt ?? null,
      updatedBy: p.updatedBy ?? null,
    };
  } catch {
    return { swapExecutionEnabled: true, sideshiftApiKey: '', updatedAt: null, updatedBy: null };
  }
}

export async function updatePlatformSwapConfig(
  patch: Partial<PlatformSwapConfig>,
  adminEmail: string,
): Promise<PlatformSwapConfig> {
  const existing = await getPlatformSwapConfig();
  const updated: PlatformSwapConfig = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  };

  const prefsStr = JSON.stringify(updated);
  const exists = await db.select({ id: userSettings.id })
    .from(userSettings)
    .where(eq(userSettings.userId, '__platform__'))
    .limit(1);

  if (exists.length > 0) {
    await db.update(userSettings)
      .set({ preferences: prefsStr, updatedAt: new Date() })
      .where(eq(userSettings.userId, '__platform__'));
  } else {
    await db.insert(userSettings).values({
      userId: '__platform__',
      preferences: prefsStr,
      updatedAt: new Date(),
    });
  }
  return updated;
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
