/**
 * stats-service.ts
 * Server-side service for logging and querying page visit + Groq token usage stats.
 * Used by:
 *  - /api/track           → logPageVisit()
 *  - /utils/groq-client   → logGroqUsage()
 *  - /api/admin/stats     → get*Stats()
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql as drizzleSql } from 'drizzle-orm';
import { pageVisits, groqUsageLogs } from '../../shared/schema';

const rawSql = neon(process.env.DATABASE_URL!);
const db = drizzle(rawSql);

// ── WRITE helpers ──────────────────────────────────────────────────────────

/**
 * Record a page visit. Silently swallows errors so it never breaks the user flow.
 */
export async function logPageVisit(opts: {
  page: string;
  userId?: string | null;
  sessionId?: string | null;
  userAgent?: string | null;
  referer?: string | null;
}): Promise<void> {
  try {
    await db.insert(pageVisits).values({
      page: opts.page.substring(0, 500),
      userId: opts.userId ?? null,
      sessionId: opts.sessionId ?? null,
      userAgent: opts.userAgent?.substring(0, 500) ?? null,
      referer: opts.referer?.substring(0, 500) ?? null,
    });
  } catch (err) {
    console.error('[stats-service] logPageVisit error:', err);
  }
}

/**
 * Record Groq API token usage. Silently swallows errors.
 */
export async function logGroqUsage(opts: {
  userId?: string | null;
  model: string;
  endpoint?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}): Promise<void> {
  try {
    await db.insert(groqUsageLogs).values({
      userId: opts.userId ?? null,
      model: opts.model,
      endpoint: opts.endpoint ?? 'chat',
      promptTokens: opts.promptTokens,
      completionTokens: opts.completionTokens,
      totalTokens: opts.totalTokens,
    });
  } catch (err) {
    console.error('[stats-service] logGroqUsage error:', err);
  }
}

// ── READ helpers (admin) ────────────────────────────────────────────────────

export interface VisitStats {
  totalVisits: number;
  visitsToday: number;
  visitsThisWeek: number;
  visitsThisMonth: number;
  uniqueUsers: number;
  visitsByPage: { page: string; count: number }[];
  visitsByDay: { date: string; count: number }[];
}

export interface GroqStats {
  totalRequests: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  requestsToday: number;
  tokensToday: number;
  requestsByModel: { model: string; count: number; tokens: number }[];
  tokensByDay: { date: string; tokens: number; requests: number }[];
  topUsers: { userId: string; count: number; tokens: number }[];
}

export async function getVisitStats(dateRange: '24h' | '7d' | '30d' | 'all' = '30d'): Promise<VisitStats> {
  const now = new Date();
  const todayStr  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStr   = new Date(now.getTime() - 7  * 86_400_000).toISOString();
  const monthStr  = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const rangeStr = dateRange === '24h'  ? new Date(now.getTime() - 86_400_000).toISOString()
                 : dateRange === '7d'   ? weekStr
                 : dateRange === '30d'  ? monthStr
                 : '1970-01-01T00:00:00.000Z';

  const [[totals], visitsByPageRows, visitsByDayRows] = await Promise.all([
    db.select({
      total:       drizzleSql<number>`count(*)::int`,
      today:       drizzleSql<number>`count(*) filter (where "visited_at" >= ${todayStr}::timestamptz)::int`,
      week:        drizzleSql<number>`count(*) filter (where "visited_at" >= ${weekStr}::timestamptz)::int`,
      month:       drizzleSql<number>`count(*) filter (where "visited_at" >= ${monthStr}::timestamptz)::int`,
      uniqueUsers: drizzleSql<number>`count(distinct "user_id") filter (where "user_id" is not null)::int`,
    }).from(pageVisits),

    db.select({
      page:  pageVisits.page,
      count: drizzleSql<number>`count(*)::int`,
    }).from(pageVisits)
      .where(drizzleSql`"visited_at" >= ${rangeStr}::timestamptz`)
      .groupBy(pageVisits.page)
      .orderBy(drizzleSql`count(*) desc`)
      .limit(15),

    db.select({
      date:  drizzleSql<string>`date("visited_at")::text`,
      count: drizzleSql<number>`count(*)::int`,
    }).from(pageVisits)
      .where(drizzleSql`"visited_at" >= ${rangeStr}::timestamptz`)
      .groupBy(drizzleSql`date("visited_at")`)
      .orderBy(drizzleSql`date("visited_at")`),
  ]);

  return {
    totalVisits:      totals?.total ?? 0,
    visitsToday:      totals?.today ?? 0,
    visitsThisWeek:   totals?.week ?? 0,
    visitsThisMonth:  totals?.month ?? 0,
    uniqueUsers:      totals?.uniqueUsers ?? 0,
    visitsByPage:     visitsByPageRows.map(r => ({ page: r.page, count: r.count })),
    visitsByDay:      visitsByDayRows.map(r => ({ date: r.date, count: r.count })),
  };
}

export async function getGroqStats(dateRange: '24h' | '7d' | '30d' | 'all' = '30d'): Promise<GroqStats> {
  const now = new Date();
  const todayStr  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStr   = new Date(now.getTime() - 7  * 86_400_000).toISOString();
  const monthStr  = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const rangeStr = dateRange === '24h'  ? new Date(now.getTime() - 86_400_000).toISOString()
                 : dateRange === '7d'   ? weekStr
                 : dateRange === '30d'  ? monthStr
                 : '1970-01-01T00:00:00.000Z';

  const [[totals], byModelRows, byDayRows, topUsersRows] = await Promise.all([
    db.select({
      total:                drizzleSql<number>`count(*)::int`,
      totalTokens:          drizzleSql<number>`coalesce(sum("total_tokens"), 0)::int`,
      totalPromptTokens:    drizzleSql<number>`coalesce(sum("prompt_tokens"), 0)::int`,
      totalCompletionTokens:drizzleSql<number>`coalesce(sum("completion_tokens"), 0)::int`,
      requestsToday:        drizzleSql<number>`count(*) filter (where "created_at" >= ${todayStr}::timestamptz)::int`,
      tokensToday:          drizzleSql<number>`coalesce(sum("total_tokens") filter (where "created_at" >= ${todayStr}::timestamptz), 0)::int`,
    }).from(groqUsageLogs),

    db.select({
      model:  groqUsageLogs.model,
      count:  drizzleSql<number>`count(*)::int`,
      tokens: drizzleSql<number>`coalesce(sum("total_tokens"), 0)::int`,
    }).from(groqUsageLogs)
      .where(drizzleSql`"created_at" >= ${rangeStr}::timestamptz`)
      .groupBy(groqUsageLogs.model)
      .orderBy(drizzleSql`sum("total_tokens") desc`)
      .limit(10),

    db.select({
      date:     drizzleSql<string>`date("created_at")::text`,
      tokens:   drizzleSql<number>`coalesce(sum("total_tokens"), 0)::int`,
      requests: drizzleSql<number>`count(*)::int`,
    }).from(groqUsageLogs)
      .where(drizzleSql`"created_at" >= ${rangeStr}::timestamptz`)
      .groupBy(drizzleSql`date("created_at")`)
      .orderBy(drizzleSql`date("created_at")`),

    db.select({
      userId: groqUsageLogs.userId,
      count:  drizzleSql<number>`count(*)::int`,
      tokens: drizzleSql<number>`coalesce(sum("total_tokens"), 0)::int`,
    }).from(groqUsageLogs)
      .where(drizzleSql`"created_at" >= ${rangeStr}::timestamptz AND "user_id" is not null`)
      .groupBy(groqUsageLogs.userId)
      .orderBy(drizzleSql`sum("total_tokens") desc`)
      .limit(10),
  ]);

  return {
    totalRequests:         totals?.total ?? 0,
    totalTokens:           totals?.totalTokens ?? 0,
    totalPromptTokens:     totals?.totalPromptTokens ?? 0,
    totalCompletionTokens: totals?.totalCompletionTokens ?? 0,
    requestsToday:         totals?.requestsToday ?? 0,
    tokensToday:           totals?.tokensToday ?? 0,
    requestsByModel:       byModelRows.map(r => ({ model: r.model, count: r.count, tokens: r.tokens })),
    tokensByDay:           byDayRows.map(r => ({ date: r.date, tokens: r.tokens, requests: r.requests })),
    topUsers:              topUsersRows.map(r => ({ userId: r.userId ?? 'anonymous', count: r.count, tokens: r.tokens })),
  };
}
