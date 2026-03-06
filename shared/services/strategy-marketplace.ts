import { eq, desc, and, gte, lte, sql, like, or } from 'drizzle-orm';
import { 
  tradingStrategies, 
  strategySubscriptions, 
  strategyPerformance,
  strategyTrades,
  type TradingStrategy,
  type NewTradingStrategy,
  type StrategySubscription,
  type NewStrategySubscription,
  type StrategyPerformance,
  type NewStrategyPerformance,
  type StrategyTrade,
  type NewStrategyTrade
} from '../schema';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn);

// Re-export db and tables for use in other modules
export { db, tradingStrategies, strategySubscriptions, strategyPerformance, strategyTrades };

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
  isPublic: boolean;
  tags?: string[];
}

export interface SubscribeToStrategyInput {
  strategyId: number;
  subscriberId: number;
  subscriberTelegramId?: number;
  allocationPercent?: number;
  autoRebalance?: boolean;
  stopLossPercent?: number;
}

export interface StrategyFilterOptions {
  riskLevel?: string;
  status?: string;
  minReturn?: number;
  maxDrawdown?: number;
  tags?: string[];
  search?: string;
  sortBy?: 'totalReturn' | 'subscriberCount' | 'monthlyReturn' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Get all public trading strategies with optional filters
 */
export async function getStrategies(options: StrategyFilterOptions = {}): Promise<TradingStrategy[]> {
  const { 
    riskLevel, 
    status = 'active',
    minReturn,
    maxDrawdown,
    search,
    sortBy = 'totalReturn',
    sortOrder = 'desc',
    limit = 20,
    offset = 0 
  } = options;

  const conditions = [
    eq(tradingStrategies.status, status as 'active'),
    eq(tradingStrategies.isPublic, true)
  ];

  if (riskLevel) {
    conditions.push(eq(tradingStrategies.riskLevel, riskLevel as 'low' | 'medium' | 'high' | 'aggressive'));
  }

  if (minReturn !== undefined) {
    conditions.push(gte(tradingStrategies.totalReturn, minReturn));
  }

  if (maxDrawdown !== undefined) {
    conditions.push(lte(tradingStrategies.maxDrawdown, maxDrawdown));
  }

  if (search) {
    const searchConditions = or(
      like(tradingStrategies.name, `%${search}%`),
      like(tradingStrategies.description, `%${search}%`)
    );
    if (searchConditions) {
      conditions.push(searchConditions);
    }
  }

  const orderColumn = sortBy === 'createdAt' 
    ? tradingStrategies.createdAt 
    : sortBy === 'subscriberCount'
    ? tradingStrategies.subscriberCount
    : sortBy === 'monthlyReturn'
    ? tradingStrategies.monthlyReturn
    : tradingStrategies.totalReturn;

  const strategies = await db.select()
    .from(tradingStrategies)
    .where(and(...conditions))
    .orderBy(sortOrder === 'desc' ? desc(orderColumn) : orderColumn)
    .limit(limit)
    .offset(offset);

  return strategies;
}

/**
 * Get a single strategy by ID
 */
export async function getStrategyById(id: number): Promise<TradingStrategy | null> {
  const strategies = await db.select()
    .from(tradingStrategies)
    .where(eq(tradingStrategies.id, id))
    .limit(1);
  
  return strategies[0] || null;
}

/**
 * Get strategies created by a specific user
 */
export async function getStrategiesByCreator(creatorId: number): Promise<TradingStrategy[]> {
  return db.select()
    .from(tradingStrategies)
    .where(eq(tradingStrategies.creatorId, creatorId))
    .orderBy(desc(tradingStrategies.createdAt));
}

/**
 * Create a new trading strategy
 */
export async function createStrategy(input: CreateStrategyInput): Promise<TradingStrategy> {
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
    isPublic: input.isPublic,
    tags: input.tags || [],
  }).returning();

  return strategy;
}

/**
 * Update a trading strategy
 */
export async function updateStrategy(
  id: number, 
  updates: Partial<NewTradingStrategy>
): Promise<TradingStrategy | null> {
  const [strategy] = await db.update(tradingStrategies)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(tradingStrategies.id, id))
    .returning();

  return strategy || null;
}

/**
 * Subscribe to a trading strategy
 */
export async function subscribeToStrategy(
  input: SubscribeToStrategyInput
): Promise<StrategySubscription> {
  // Get strategy details for the subscription fee
  const strategy = await getStrategyById(input.strategyId);
  if (!strategy) {
    throw new Error('Strategy not found');
  }

  const [subscription] = await db.insert(strategySubscriptions).values({
    strategyId: input.strategyId,
    subscriberId: input.subscriberId,
    subscriberTelegramId: input.subscriberTelegramId,
    subscriptionFee: strategy.subscriptionFee,
    allocationPercent: input.allocationPercent || 100,
    autoRebalance: input.autoRebalance ?? true,
    stopLossPercent: input.stopLossPercent,
    status: 'active',
  }).onConflictDoUpdate({
    target: [strategySubscriptions.strategyId, strategySubscriptions.subscriberId],
    set: {
      status: 'active',
      allocationPercent: input.allocationPercent || 100,
      autoRebalance: input.autoRebalance ?? true,
      stopLossPercent: input.stopLossPercent,
      pausedAt: null,
      cancelledAt: null,
    }
  }).returning();

  // Update subscriber count
  await db.update(tradingStrategies)
    .set({ subscriberCount: sql`${tradingStrategies.subscriberCount} + 1` })
    .where(eq(tradingStrategies.id, input.strategyId));

  return subscription;
}

/**
 * Unsubscribe from a trading strategy
 */
export async function unsubscribeFromStrategy(
  strategyId: number,
  subscriberId: number
): Promise<boolean> {
  const result = await db.update(strategySubscriptions)
    .set({ 
      status: 'cancelled',
      cancelledAt: new Date(),
    })
    .where(
      and(
        eq(strategySubscriptions.strategyId, strategyId),
        eq(strategySubscriptions.subscriberId, subscriberId)
      )
    )
    .returning();

  if (result[0]) {
    // Update subscriber count
    await db.update(tradingStrategies)
      .set({ subscriberCount: sql`GREATEST(${tradingStrategies.subscriberCount} - 1, 0)` })
      .where(eq(tradingStrategies.id, strategyId));
    
    return true;
  }

  return false;
}

/**
 * Pause a subscription
 */
export async function pauseSubscription(
  strategyId: number,
  subscriberId: number
): Promise<boolean> {
  const result = await db.update(strategySubscriptions)
    .set({ 
      status: 'paused',
      pausedAt: new Date(),
    })
    .where(
      and(
        eq(strategySubscriptions.strategyId, strategyId),
        eq(strategySubscriptions.subscriberId, subscriberId),
        eq(strategySubscriptions.status, 'active' as 'active')
      )
    )
    .returning();

  return !!result[0];
}

/**
 * Resume a subscription
 */
export async function resumeSubscription(
  strategyId: number,
  subscriberId: number
): Promise<boolean> {
  const result = await db.update(strategySubscriptions)
    .set({ 
      status: 'active',
      pausedAt: null,
    })
    .where(
      and(
        eq(strategySubscriptions.strategyId, strategyId),
        eq(strategySubscriptions.subscriberId, subscriberId),
        eq(strategySubscriptions.status, 'paused' as 'paused')
      )
    )
    .returning();

  return !!result[0];
}

/**
 * Get user's subscriptions
 */
export async function getUserSubscriptions(userId: number): Promise<StrategySubscription[]> {
  return db.select()
    .from(strategySubscriptions)
    .where(eq(strategySubscriptions.subscriberId, userId))
    .orderBy(desc(strategySubscriptions.joinedAt));
}

/**
 * Get subscribers of a strategy
 */
export async function getStrategySubscribers(strategyId: number): Promise<StrategySubscription[]> {
  return db.select()
    .from(strategySubscriptions)
    .where(
      and(
        eq(strategySubscriptions.strategyId, strategyId),
        eq(strategySubscriptions.status, 'active' as 'active')
      )
    );
}

/**
 * Record a strategy trade
 */
export async function recordStrategyTrade(
  input: Omit<NewStrategyTrade, 'id' | 'createdAt'>
): Promise<StrategyTrade> {
  const [trade] = await db.insert(strategyTrades).values(input).returning();

  // Update strategy stats
  await db.update(tradingStrategies)
    .set({ 
      totalTrades: sql`${tradingStrategies.totalTrades} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(tradingStrategies.id, input.strategyId));

  return trade;
}

/**
 * Update trade result
 */
export async function updateTradeResult(
  tradeId: number,
  result: {
    status: 'completed' | 'failed';
    settleAmount?: string;
    sideshiftOrderId?: string;
    error?: string;
  }
): Promise<StrategyTrade | null> {
  const [trade] = await db.update(strategyTrades)
    .set({
      status: result.status,
      settleAmount: result.settleAmount,
      sideshiftOrderId: result.sideshiftOrderId,
      error: result.error,
      executedAt: result.status === 'completed' ? new Date() : undefined,
    })
    .where(eq(strategyTrades.id, tradeId))
    .returning();

  // Update strategy successful trades count
  if (result.status === 'completed' && trade) {
    await db.update(tradingStrategies)
      .set({ 
        successfulTrades: sql`${tradingStrategies.successfulTrades} + 1`,
      })
      .where(eq(tradingStrategies.id, trade.strategyId));
  }

  return trade || null;
}

/**
 * Record performance for a strategy
 */
export async function recordStrategyPerformance(
  input: Omit<NewStrategyPerformance, 'id' | 'createdAt'>
): Promise<StrategyPerformance> {
  const [performance] = await db.insert(strategyPerformance).values(input).returning();

  // Update strategy performance metrics
  const stats = await db.select({
    totalReturn: strategyPerformance.pnlPercent,
  }).from(strategyPerformance)
    .where(eq(strategyPerformance.strategyId, input.strategyId));

  // Calculate average return
  const avgReturn = stats.length > 0 
    ? stats.reduce((acc: number, s) => acc + Number(s.totalReturn), 0) / stats.length 
    : 0;

  await db.update(tradingStrategies)
    .set({ 
      totalReturn: avgReturn,
      monthlyReturn: avgReturn / 12, // Simplified monthly calculation
      updatedAt: new Date(),
    })
    .where(eq(tradingStrategies.id, input.strategyId));

  return performance;
}

/**
 * Get strategy performance history
 */
export async function getStrategyPerformance(
  strategyId: number,
  limit: number = 30
): Promise<StrategyPerformance[]> {
  return db.select()
    .from(strategyPerformance)
    .where(eq(strategyPerformance.strategyId, strategyId))
    .orderBy(desc(strategyPerformance.executedAt))
    .limit(limit);
}

/**
 * Get strategy trades
 */
export async function getStrategyTrades(
  strategyId: number,
  limit: number = 50
): Promise<StrategyTrade[]> {
  return db.select()
    .from(strategyTrades)
    .where(eq(strategyTrades.strategyId, strategyId))
    .orderBy(desc(strategyTrades.createdAt))
    .limit(limit);
}

/**
 * Get user's subscribed strategies with strategy details
 */
export async function getUserSubscribedStrategies(userId: number) {
  const subscriptions = await db.select()
    .from(strategySubscriptions)
    .where(eq(strategySubscriptions.subscriberId, userId));

  const strategyIds = subscriptions.map(s => s.strategyId);
  
  if (strategyIds.length === 0) {
    return [];
  }

  const strategies = await db.select()
    .from(tradingStrategies)
    .where(
      sql`${tradingStrategies.id} IN ${strategyIds}`
    );

  return subscriptions.map(sub => ({
    subscription: sub,
    strategy: strategies.find((s: TradingStrategy) => s.id === sub.strategyId),
  }));
}

/**
 * Calculate and update strategy metrics
 */
export async function updateStrategyMetrics(strategyId: number): Promise<void> {
  const performance = await db.select()
    .from(strategyPerformance)
    .where(
      and(
        eq(strategyPerformance.strategyId, strategyId),
        eq(strategyPerformance.status, 'completed' as 'completed')
      )
    );

  if (performance.length === 0) {
    return;
  }

  // Calculate metrics
  const totalPnL = performance.reduce((acc: number, p) => acc + Number(p.pnl), 0);
  const pnlPercents = performance.map(p => p.pnlPercent);
  
  const avgReturn = pnlPercents.reduce((acc: number, p: number) => acc + p, 0) / pnlPercents.length;
  
  // Calculate max drawdown
  let maxDrawdown = 0;
  let peak = -Infinity;
  let currentValue = 0;
  for (const pnl of pnlPercents) {
    currentValue += pnl;
    if (currentValue > peak) peak = currentValue;
    const drawdown = (peak - currentValue);
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Calculate volatility (standard deviation)
  const variance = pnlPercents.reduce((acc: number, p: number) => acc + Math.pow(p - avgReturn, 2), 0) / pnlPercents.length;
  const volatility = Math.sqrt(variance);

  // Calculate Sharpe ratio (simplified)
  const sharpeRatio = volatility > 0 ? (avgReturn / volatility) * Math.sqrt(252) : 0;

  await db.update(tradingStrategies)
    .set({
      totalReturn: totalPnL,
      monthlyReturn: avgReturn,
      sharpeRatio,
      maxDrawdown,
      volatility,
      updatedAt: new Date(),
    })
    .where(eq(tradingStrategies.id, strategyId));
}
