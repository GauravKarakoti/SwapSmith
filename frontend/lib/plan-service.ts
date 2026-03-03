/**
 * Plan Service — DB operations for user plans and usage tracking
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, sql as drizzleSql, and } from 'drizzle-orm';
// 1. ADDED planPurchases to the import
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

export async function purchasePlan(
  userId: number, 
  plan: Plan
): Promise<{ success: boolean; message: string; newPlan?: Plan; expiresAt?: Date }> {
  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userResult[0]) {
    return { success: false, message: 'User not found' };
  }
  const user = userResult[0];

  const config = PLAN_CONFIGS[plan];
  if (!config) {
    return { success: false, message: 'Invalid plan' };
  }

  // Check if the user has enough coins (points)
  if (user.totalPoints < config.coinsCost) {
    return { success: false, message: 'Insufficient coins' };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.durationDays * 24 * 60 * 60 * 1000);

  // We can use a transaction to make sure both the deduction and logging happen atomically
  await db.transaction(async (tx) => {
    // 1. Deduct coins and activate plan
    await tx.update(users)
      .set({
        totalPoints: user.totalPoints - config.coinsCost,
        plan: plan,
        planPurchasedAt: now,
        planExpiresAt: expiresAt,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    // 2. Log the purchase in the planPurchases table
    await tx.insert(planPurchases).values({
      userId,
      plan,
      coinsSpent: config.coinsCost,
      durationDays: config.durationDays,
      activatedAt: now,
      expiresAt: expiresAt,
    });
  });

  return {
    success: true,
    message: `Successfully upgraded to ${config.displayName} plan`,
    newPlan: plan,
    expiresAt,
  };
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
  
  // 2 & 3: Changed PlanType to Plan and PLAN_LIMITS to PLAN_CONFIGS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plan: Plan = (userResult[0] as any).plan || 'free';
  const dailyChatLimit = PLAN_CONFIGS[plan].dailyChatLimit;

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
  
  // 2 & 3: Changed PlanType to Plan and PLAN_LIMITS to PLAN_CONFIGS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plan: Plan = (userResult[0] as any).plan || 'free';
  const dailyTerminalLimit = PLAN_CONFIGS[plan].dailyTerminalLimit;

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
// 3: Changed PlanType to Plan
export async function updateUserPlan(userId: number, plan: Plan): Promise<void> {
  await db.update(users)
    .set({
      plan,
      updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .where(eq(users.id, userId));
}