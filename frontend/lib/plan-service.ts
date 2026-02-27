import { eq, and, sql as drizzleSql } from 'drizzle-orm';
import { db, users } from './database';

// Plan limits configuration
export const PLAN_LIMITS = {
  free: {
    dailyChatLimit: 10,
    dailyTerminalLimit: 5,
  },
  pro: {
    dailyChatLimit: 100,
    dailyTerminalLimit: 50,
  },
  enterprise: {
    dailyChatLimit: 1000,
    dailyTerminalLimit: 500,
  },
};

export type PlanType = keyof typeof PLAN_LIMITS;

export interface UserPlanStatus {
  userId: number;
  plan: PlanType;
  dailyChatCount: number;
  dailyChatLimit: number;
  dailyTerminalCount: number;
  dailyTerminalLimit: number;
  chatLimitExceeded: boolean;
  terminalLimitExceeded: boolean;
}

/**
 * Get user's current plan status
 */
export async function getUserPlanStatus(userId: number): Promise<UserPlanStatus | null> {
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = result[0];

  if (!user) return null;

  // Determine plan type (default to free if not set)
  const plan: PlanType = (user as any).plan || 'free';
  const limits = PLAN_LIMITS[plan];

  const dailyChatCount = (user as any).dailyChatCount || 0;
  const dailyTerminalCount = (user as any).dailyTerminalCount || 0;

  return {
    userId,
    plan,
    dailyChatCount,
    dailyChatLimit: limits.dailyChatLimit,
    dailyTerminalCount,
    dailyTerminalLimit: limits.dailyTerminalLimit,
    chatLimitExceeded: dailyChatCount >= limits.dailyChatLimit,
    terminalLimitExceeded: dailyTerminalCount >= limits.dailyTerminalLimit,
  };
}

/**
 * Atomically increment chat usage with TOCTOU protection
 * Uses a single atomic query to check limit AND increment counter
 */
export async function incrementChatUsage(userId: number): Promise<{ count: number; limit: number }> {
  const status = await getUserPlanStatus(userId);
  if (!status) throw new Error('User not found');

  const dailyChatLimit = status.dailyChatLimit;

  // 🔒 ATOMIC OPERATION: Check limit and increment in a single query
  // This prevents TOCTOU race conditions by performing the check atomically in the database
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
  if (result.length === 0) {
    throw new Error('Daily chat limit exceeded');
  }

  return { count: result[0].dailyChatCount, limit: dailyChatLimit };
}

/**
 * Atomically increment terminal usage with TOCTOU protection
 * Uses a single atomic query to check limit AND increment counter
 */
export async function incrementTerminalUsage(userId: number): Promise<{ count: number; limit: number }> {
  const status = await getUserPlanStatus(userId);
  if (!status) throw new Error('User not found');

  const dailyTerminalLimit = status.dailyTerminalLimit;

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
