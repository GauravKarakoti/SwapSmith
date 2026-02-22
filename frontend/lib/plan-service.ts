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
  const status = await getUserPlanStatus(userId);
  if (!status) throw new Error('User not found');

  if (status.chatLimitExceeded) {
    const err = new Error('Usage limit exceeded');
    (err as Error & { code: string; plan: Plan }).code = 'LIMIT_EXCEEDED';
    (err as Error & { code: string; plan: Plan }).plan = status.plan;
    throw err;
  }

  await db
    .update(users)
    .set({ dailyChatCount: drizzleSql`${users.dailyChatCount} + 1`, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { count: status.dailyChatCount + 1, limit: status.dailyChatLimit };
}

/**
 * Increment the terminal counter for a user.
 * Throws if the limit has been exceeded.
 */
export async function incrementTerminalUsage(userId: number): Promise<{ count: number; limit: number }> {
  const status = await getUserPlanStatus(userId);
  if (!status) throw new Error('User not found');

  if (status.terminalLimitExceeded) {
    const err = new Error('Usage limit exceeded');
    (err as Error & { code: string; plan: Plan }).code = 'LIMIT_EXCEEDED';
    (err as Error & { code: string; plan: Plan }).plan = status.plan;
    throw err;
  }

  await db
    .update(users)
    .set({ dailyTerminalCount: drizzleSql`${users.dailyTerminalCount} + 1`, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { count: status.dailyTerminalCount + 1, limit: status.dailyTerminalLimit };
}

/**
 * Purchase a plan using SwapSmith coins (totalPoints).
 * Validates the user has enough coins, deducts them, sets the plan.
 */
export async function purchasePlan(
  userId: number,
  targetPlan: 'premium' | 'pro'
): Promise<{ success: boolean; message: string; newPlan?: Plan; expiresAt?: Date }> {
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!result[0]) return { success: false, message: 'User not found' };

  const user = result[0];
  const config = PLAN_CONFIGS[targetPlan];
  const now = new Date();

  if (user.totalPoints < config.coinsCost) {
    return {
      success: false,
      message: `Insufficient SwapSmith coins. You need ${config.coinsCost} coins but have ${user.totalPoints}.`,
    };
  }

  // If user already has a higher plan active, extend it; otherwise set new expiry
  const currentPlan = (user.plan ?? 'free') as Plan;
  let expiresAt: Date;

  if (
    currentPlan === targetPlan &&
    user.planExpiresAt &&
    new Date(user.planExpiresAt) > now
  ) {
    // Extend existing plan
    expiresAt = new Date(new Date(user.planExpiresAt).getTime() + config.durationDays * 86400000);
  } else {
    expiresAt = new Date(now.getTime() + config.durationDays * 86400000);
  }

  // Deduct coins & set plan
  await db
    .update(users)
    .set({
      totalPoints: user.totalPoints - config.coinsCost,
      plan: targetPlan,
      planPurchasedAt: now,
      planExpiresAt: expiresAt,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  // Record purchase
  await db.insert(planPurchases).values({
    userId,
    plan: targetPlan,
    coinsSpent: config.coinsCost,
    durationDays: config.durationDays,
    activatedAt: now,
    expiresAt,
  });

  return {
    success: true,
    message: `Successfully activated ${config.displayName} plan for ${config.durationDays} days!`,
    newPlan: targetPlan,
    expiresAt,
  };
}
