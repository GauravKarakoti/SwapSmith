import { eq, desc, and, gte, lte, sql, like, or } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import {
  tradingStrategies,
  strategySubscriptions,
  strategyPerformance,
  strategyTrades
} from '../schema';

const sqlConn = neon(process.env['DATABASE_URL']!);
const db = drizzle(sqlConn);

// Re-export db for use in other modules
export { db };

// Type definitions
export type TradingStrategy = typeof tradingStrategies.$inferSelect;
export type NewTradingStrategy = typeof tradingStrategies.$inferInsert;
export type StrategySubscription = typeof strategySubscriptions.$inferSelect;
export type NewStrategySubscription = typeof strategySubscriptions.$inferInsert;
export type StrategyPerformance = typeof strategyPerformance.$inferSelect;
export type NewStrategyPerformance = typeof strategyPerformance.$inferInsert;
export type StrategyTrade = typeof strategyTrades.$inferSelect;
export type NewStrategyTrade = typeof strategyTrades.$inferInsert;

export interface CreateStrategyInput {
  creatorId: number;
  creatorTelegramId?: number;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'aggressive';
  subscriptionFee: string;
  performanceFee: number;
  minInvestment: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface SubscribeToStrategyInput {
  strategyId: number;
  subscriberId: number;
  subscriberTelegramId?: number;
  subscriptionFee?: string;
  allocationPercent?: number;
  autoRebalance?: boolean;
  stopLossPercent?: number;
}

/**
 * Create a new trading strategy
 */
export const createStrategy = async (input: CreateStrategyInput): Promise<TradingStrategy> => {
  const [strategy] = await db.insert(tradingStrategies).values({
    creatorId: input.creatorId,
    creatorTelegramId: input.creatorTelegramId,
    name: input.name,
    description: input.description,
    parameters: input.parameters,
    riskLevel: input.riskLevel,
    subscriptionFee: input.subscriptionFee,
    performanceFee: input.performanceFee,
    minInvestment: input.minInvestment,
    isPublic: input.isPublic ?? true,
    tags: input.tags,
    status: 'active',
  }).returning();

  return strategy;
};

/**
 * Subscribe to a trading strategy
 */
export const subscribeToStrategy = async (input: SubscribeToStrategyInput): Promise<StrategySubscription> => {
  // Check if strategy exists and is active
  const [strategy] = await db
    .select()
    .from(tradingStrategies)
    .where(eq(tradingStrategies.id, input.strategyId))
    .limit(1);

  if (!strategy) {
    throw new Error('Strategy not found');
  }

  if (strategy.status !== 'active') {
    throw new Error('Strategy is not active');
  }

  // Check if already subscribed
  const [existing] = await db
    .select()
    .from(strategySubscriptions)
    .where(
      and(
        eq(strategySubscriptions.strategyId, input.strategyId),
        eq(strategySubscriptions.subscriberId, input.subscriberId),
        eq(strategySubscriptions.status, 'active')
      )
    )
    .limit(1);

  if (existing) {
    throw new Error('Already subscribed to this strategy');
  }

  // Create subscription
  const [subscription] = await db.insert(strategySubscriptions).values({
    strategyId: input.strategyId,
    subscriberId: input.subscriberId,
    subscriberTelegramId: input.subscriberTelegramId,
    subscriptionFee: input.subscriptionFee || strategy.subscriptionFee,
    allocationPercent: input.allocationPercent || 100,
    autoRebalance: input.autoRebalance ?? true,
    stopLossPercent: input.stopLossPercent,
    status: 'active',
  }).returning();

  // Increment subscriber count
  await db
    .update(tradingStrategies)
    .set({
      subscriberCount: sql`${tradingStrategies.subscriberCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(tradingStrategies.id, input.strategyId));

  return subscription;
};

/**
 * Get all strategies with optional filters
 */
export const getStrategies = async (filters?: {
  riskLevel?: string;
  minReturn?: number;
  maxDrawdown?: number;
  search?: string;
  creatorId?: number;
  isPublic?: boolean;
}): Promise<TradingStrategy[]> => {
  let query = db.select().from(tradingStrategies);

  const conditions = [];

  if (filters?.riskLevel) {
    conditions.push(eq(tradingStrategies.riskLevel, filters.riskLevel as any));
  }

  if (filters?.minReturn !== undefined) {
    conditions.push(gte(tradingStrategies.totalReturn, filters.minReturn));
  }

  if (filters?.maxDrawdown !== undefined) {
    conditions.push(lte(tradingStrategies.maxDrawdown, filters.maxDrawdown));
  }

  if (filters?.search) {
    conditions.push(
      or(
        like(tradingStrategies.name, `%${filters.search}%`),
        like(tradingStrategies.description, `%${filters.search}%`)
      )!
    );
  }

  if (filters?.creatorId !== undefined) {
    conditions.push(eq(tradingStrategies.creatorId, filters.creatorId));
  }

  if (filters?.isPublic !== undefined) {
    conditions.push(eq(tradingStrategies.isPublic, filters.isPublic));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)!) as any;
  }

  const strategies = await query.orderBy(desc(tradingStrategies.totalReturn));
  return strategies;
};

/**
 * Get strategy by ID
 */
export const getStrategyById = async (id: number): Promise<TradingStrategy | null> => {
  const [strategy] = await db
    .select()
    .from(tradingStrategies)
    .where(eq(tradingStrategies.id, id))
    .limit(1);

  return strategy || null;
};

/**
 * Update strategy metrics
 */
export const updateStrategyMetrics = async (
  strategyId: number,
  metrics: {
    totalReturn?: number;
    monthlyReturn?: number;
    maxDrawdown?: number;
    volatility?: number;
    sharpeRatio?: number;
  }
): Promise<void> => {
  await db
    .update(tradingStrategies)
    .set({
      ...metrics,
      updatedAt: new Date(),
    })
    .where(eq(tradingStrategies.id, strategyId));
};

/**
 * Get strategies by creator
 */
export const getStrategiesByCreator = async (creatorId: number): Promise<TradingStrategy[]> => {
  return await db
    .select()
    .from(tradingStrategies)
    .where(eq(tradingStrategies.creatorId, creatorId))
    .orderBy(desc(tradingStrategies.createdAt));
};

/**
 * Get subscribed strategies for a user
 */
export const getSubscribedStrategies = async (
  subscriberId: number
): Promise<(TradingStrategy & { subscription: StrategySubscription })[]> => {
  const results = await db
    .select()
    .from(strategySubscriptions)
    .innerJoin(tradingStrategies, eq(strategySubscriptions.strategyId, tradingStrategies.id))
    .where(
      and(
        eq(strategySubscriptions.subscriberId, subscriberId),
        eq(strategySubscriptions.status, 'active')
      )
    )
    .orderBy(desc(strategySubscriptions.joinedAt));

  return results.map((row) => ({
    ...row.trading_strategies,
    subscription: row.strategy_subscriptions,
  }));
};

/**
 * Unsubscribe from a strategy
 */
export const unsubscribeFromStrategy = async (
  strategyId: number,
  subscriberId: number
): Promise<boolean> => {
  const result = await db
    .update(strategySubscriptions)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
    })
    .where(
      and(
        eq(strategySubscriptions.strategyId, strategyId),
        eq(strategySubscriptions.subscriberId, subscriberId),
        eq(strategySubscriptions.status, 'active')
      )
    )
    .returning();

  if (result.length > 0) {
    // Decrement subscriber count
    await db
      .update(tradingStrategies)
      .set({
        subscriberCount: sql`${tradingStrategies.subscriberCount} - 1`,
        updatedAt: new Date(),
      })
      .where(eq(tradingStrategies.id, strategyId));

    return true;
  }

  return false;
};

/**
 * Record a strategy trade
 */
export const recordStrategyTrade = async (input: {
  strategyId: number;
  sideshiftOrderId?: string;
  fromAsset: string;
  fromNetwork: string;
  fromAmount: string;
  toAsset: string;
  toNetwork: string;
  settleAmount?: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}): Promise<StrategyTrade> => {
  const [trade] = await db.insert(strategyTrades).values({
    strategyId: input.strategyId,
    sideshiftOrderId: input.sideshiftOrderId,
    fromAsset: input.fromAsset,
    fromNetwork: input.fromNetwork,
    fromAmount: input.fromAmount,
    toAsset: input.toAsset,
    toNetwork: input.toNetwork,
    settleAmount: input.settleAmount,
    status: input.status,
    error: input.error,
    executedAt: input.status === 'completed' ? new Date() : undefined,
  }).returning();

  // Update total trades count
  await db
    .update(tradingStrategies)
    .set({
      totalTrades: sql`${tradingStrategies.totalTrades} + 1`,
      successfulTrades: input.status === 'completed' 
        ? sql`${tradingStrategies.successfulTrades} + 1`
        : tradingStrategies.successfulTrades,
      updatedAt: new Date(),
    })
    .where(eq(tradingStrategies.id, input.strategyId));

  return trade;
};

/**
 * Record strategy performance
 */
export const recordStrategyPerformance = async (input: {
  strategyId: number;
  pnl: string;
  pnlPercent: number;
  status: 'pending' | 'completed' | 'failed';
}): Promise<StrategyPerformance> => {
  const [performance] = await db.insert(strategyPerformance).values({
    strategyId: input.strategyId,
    pnl: input.pnl,
    pnlPercent: input.pnlPercent,
    status: input.status,
    executedAt: input.status === 'completed' ? new Date() : undefined,
  }).returning();

  return performance;
};

/**
 * Get strategy performance history
 */
export const getStrategyPerformance = async (
  strategyId: number,
  limit = 100
): Promise<StrategyPerformance[]> => {
  return await db
    .select()
    .from(strategyPerformance)
    .where(eq(strategyPerformance.strategyId, strategyId))
    .orderBy(desc(strategyPerformance.createdAt))
    .limit(limit);
};

/**
 * Get strategy trades
 */
export const getStrategyTrades = async (
  strategyId: number,
  limit = 100
): Promise<StrategyTrade[]> => {
  return await db
    .select()
    .from(strategyTrades)
    .where(eq(strategyTrades.strategyId, strategyId))
    .orderBy(desc(strategyTrades.executedAt))
    .limit(limit);
};

/**
 * Get user subscribed strategies (alias for getSubscribedStrategies)
 */
export const getUserSubscribedStrategies = async (userId: number): Promise<TradingStrategy[]> => {
  const subscribed = await getSubscribedStrategies(userId);
  return subscribed.map((s) => {
    const { subscription, ...strategy } = s;
    return strategy;
  });
};

/**
 * Pause a subscription
 */
export const pauseSubscription = async (
  strategyId: number,
  subscriberId: number
): Promise<boolean> => {
  const result = await db
    .update(strategySubscriptions)
    .set({
      status: 'paused',
      pausedAt: new Date(),
    })
    .where(
      and(
        eq(strategySubscriptions.strategyId, strategyId),
        eq(strategySubscriptions.subscriberId, subscriberId),
        eq(strategySubscriptions.status, 'active')
      )
    )
    .returning();

  return result.length > 0;
};

/**
 * Resume a paused subscription
 */
export const resumeSubscription = async (
  strategyId: number,
  subscriberId: number
): Promise<boolean> => {
  const result = await db
    .update(strategySubscriptions)
    .set({
      status: 'active',
      pausedAt: null,
    })
    .where(
      and(
        eq(strategySubscriptions.strategyId, strategyId),
        eq(strategySubscriptions.subscriberId, subscriberId),
        eq(strategySubscriptions.status, 'paused')
      )
    )
    .returning();

  return result.length > 0;
};

/**
 * Update strategy status
 */
export const updateStrategyStatus = async (
  strategyId: number,
  status: 'active' | 'paused' | 'archived'
): Promise<void> => {
  await db
    .update(tradingStrategies)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(tradingStrategies.id, strategyId));
};
