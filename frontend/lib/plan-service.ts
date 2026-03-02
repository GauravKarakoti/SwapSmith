/**
 * Plan Service — DB operations for user plans and usage tracking
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, sql as drizzleSql } from 'drizzle-orm';
import { users, planPurchases } from '../../shared/schema';
import type { Plan } from '../../shared/config/plans';
import { PLAN_CONFIGS, isLimitExceeded } from '../../shared/config/plans';

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn);

export interface UsageStatus {
  plan: Plan;
  planExpiresAt: Date | null;
  dailyChatCount: number;
  dailyTerminalCount: number;
  dailyChatLimit: number;
  dailyTerminalLimit: number;
  chatLimitExceeded: boolean;
  terminalLimitExceeded: boolean;
  totalPoints: number;
}

/**
 * Get the user's current plan and usage stats.
 * Also resets daily counters if the last reset was on a different UTC day.
 */
export async function getUserPlanStatus(userId: number): Promise<UsageStatus | null> {
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!result[0]) return null;

  const user = result[0];

  // Auto-reset daily counters if it's a new UTC day
  const now = new Date();
  const resetAt = user.usageResetAt ? new Date(user.usageResetAt) : new Date(0);
  const isNewDay =
    now.getUTCFullYear() !== resetAt.getUTCFullYear() ||
    now.getUTCMonth() !== resetAt.getUTCMonth() ||
    now.getUTCDate() !== resetAt.getUTCDate();

  let chatCount = user.dailyChatCount;
  let terminalCount = user.dailyTerminalCount;

  if (isNewDay) {
    await db
      .update(users)
      .set({ dailyChatCount: 0, dailyTerminalCount: 0, usageResetAt: now, updatedAt: now })
      .where(eq(users.id, userId));
    chatCount = 0;
    terminalCount = 0;
  }

  // Check if plan has expired — downgrade to free
  let plan = (user.plan ?? 'free') as Plan;
  if (plan !== 'free' && user.planExpiresAt && new Date(user.planExpiresAt) < now) {
    await db.update(users).set({ plan: 'free', updatedAt: now }).where(eq(users.id, userId));
    plan = 'free';
  }

  const config = PLAN_CONFIGS[plan];

  return {
    plan,
    planExpiresAt: user.planExpiresAt ? new Date(user.planExpiresAt) : null,
    dailyChatCount: chatCount,
    dailyTerminalCount: terminalCount,
    dailyChatLimit: config.dailyChatLimit,
    dailyTerminalLimit: config.dailyTerminalLimit,
    chatLimitExceeded: isLimitExceeded(plan, 'chat', chatCount),
    terminalLimitExceeded: isLimitExceeded(plan, 'terminal', terminalCount),
    totalPoints: user.totalPoints,
  };
}

/**
 * Increment the chat counter for a user and return new count.
 * Throws if the limit has been exceeded.
 */
export async function incrementChatUsage(userId: number): Promise<{ count: number; limit: number }> {
  // First, get the user's plan to determine their limit
  // This is a fast single-row lookup, not a check-then-update
  const userResult = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!userResult[0]) {
    throw new Error('User not found');
  }
  
  const plan: PlanType = (userResult[0] as any).plan || 'free';
  const dailyChatLimit = PLAN_LIMITS[plan].dailyChatLimit;

  // 🔒 ATOMIC OPERATION: Check limit and increment in a single query
  // This prevents TOCTOU race conditions by performing the check atomically in the database
  // The WHERE clause ensures the update only succeeds if count < limit
  const result = await db.update(users)
    .set({
      dailyChatCount: drizzleSql`${users.dailyChatCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(users.id, userId),
      drizzleSql`${users.dailyChatCount} < ${dailyChatLimit}` // Atomic check: only increment if under limit
    ))
    .returning({ dailyChatCount: users.dailyChatCount });

  // If no rows were updated, it means the limit was already reached
  // This is the database telling us the limit is exceeded
  if (result.length === 0) {
    throw new Error('Daily chat limit exceeded');
  }

  return { count: result[0].dailyChatCount, limit: dailyChatLimit };
}

/**
 * Atomically increment terminal usage with TOCTOU protection.
 * Uses a single atomic query to check limit AND increment counter.
 */
export async function incrementTerminalUsage(userId: number): Promise<{ count: number; limit: number }> {
  // First, get the user's plan to determine their limit
  const userResult = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!userResult[0]) {
    throw new Error('User not found');
  }
  
  const plan: PlanType = (userResult[0] as any).plan || 'free';
  const dailyTerminalLimit = PLAN_LIMITS[plan].dailyTerminalLimit;

  // 🔒 ATOMIC OPERATION: Check limit and increment in a single query
  // This prevents TOCTOU race conditions by performing the check atomically in the database
  const result = await db.update(users)
    .set({
      dailyTerminalCount: drizzleSql`${users.dailyTerminalCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(users.id, userId),
      drizzleSql`${users.dailyTerminalCount} < ${dailyTerminalLimit}` // Atomic check: only increment if under limit
    ))
    .returning({ dailyTerminalCount: users.dailyTerminalCount });

  // If no rows were updated, it means the limit was already reached
  if (result.length === 0) {
    throw new Error('Daily terminal limit exceeded');
  }

  return { count: result[0].dailyTerminalCount, limit: dailyTerminalLimit };
}

/**
 * Reset daily counters (should be called by a scheduled job at midnight)
 */
export async function resetDailyCounters(): Promise<void> {
  await db.update(users)
    .set({
      dailyChatCount: 0,
      dailyTerminalCount: 0,
      updatedAt: new Date(),
    });
}

/**
 * Update user's plan type
 */
export async function updateUserPlan(userId: number, plan: PlanType): Promise<void> {
  await db.update(users)
    .set({
      plan,
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, userId));
}
