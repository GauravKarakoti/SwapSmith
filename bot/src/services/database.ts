import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, notInArray, and, sql, relations } from 'drizzle-orm';
import { pgTable, serial, text, bigint, timestamp, integer, real, unique, pgEnum, uuid, boolean, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import dotenv from 'dotenv';
import { safeParseJSON } from '../utils/safeParse';
import type { SideShiftOrder, SideShiftCheckoutResponse } from './sideshift-client';
import type { ParsedCommand } from './parseUserCommand';
import logger from './logger';

dotenv.config();

// --- SCHEMA DEFINITIONS (Inlined from shared/schema to fix type incompatibility) ---

// --- ENUMS ---
export const rewardActionType = pgEnum('reward_action_type', [
  'course_complete',
  'module_complete',
  'daily_login',
  'swap_complete',
  'referral'
]);

export const mintStatusType = pgEnum('mint_status_type', [
  'pending',
  'processing',
  'minted',
  'failed'
]);

// --- BOT SCHEMAS ---

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).unique(),
  firebaseUid: text('firebase_uid').unique(),
  walletAddress: text('wallet_address').unique(),
  sessionTopic: text('session_topic'),
  totalPoints: integer('total_points').notNull().default(0),
  totalTokensClaimed: numeric('total_tokens_claimed', { precision: 20, scale: 8 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull().unique(),
  state: text('state'),
  lastUpdated: timestamp('last_updated'),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  sideshiftOrderId: text('sideshift_order_id').notNull().unique(),
  quoteId: text('quote_id'),
  fromAsset: text('from_asset').notNull(),
  fromNetwork: text('from_network').notNull(),
  fromAmount: text('from_amount').notNull(),
  toAsset: text('to_asset').notNull(),
  toNetwork: text('to_network').notNull(),
  settleAmount: text('settle_amount').notNull(),
  depositAddress: text('deposit_address').notNull(),
  depositMemo: text('deposit_memo'),
  status: text('status').notNull().default('pending'),
  tx_hash: text('tx_hash'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_orders_telegram_id").on(table.telegramId),
  index("idx_orders_status").on(table.status),
]);

export const checkouts = pgTable('checkouts', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  checkoutId: text('checkout_id').notNull().unique(),
  settleAsset: text('settle_asset').notNull(),
  settleNetwork: text('settle_network').notNull(),
  settleAmount: real('settle_amount').notNull(),
  settleAddress: text('settle_address').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const addressBook = pgTable('address_book', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  label: text('label').notNull(),
  address: text('address').notNull(),
  chain: text('chain').notNull(),
});

export const watchedOrders = pgTable('watched_orders', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  sideshiftOrderId: text('sideshift_order_id').notNull().unique(),
  lastStatus: text('last_status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dcaSchedules = pgTable('dca_schedules', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  fromAsset: text('from_asset').notNull(),
  fromNetwork: text('from_network').notNull(),
  toAsset: text('to_asset').notNull(),
  toNetwork: text('to_network').notNull(),
  amountPerOrder: text('amount_per_order').notNull(),
  intervalHours: integer('interval_hours').notNull(),
  totalOrders: integer('total_orders').notNull(),
  ordersExecuted: integer('orders_executed').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  nextExecutionAt: timestamp('next_execution_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const limitOrders = pgTable('limit_orders', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  fromAsset: text('from_asset').notNull(),
  fromNetwork: text('from_network').notNull(),
  toAsset: text('to_asset').notNull(),
  toNetwork: text('to_network').notNull(),
  fromAmount: text('from_amount').notNull(),
  
  // Logic fields
  conditionOperator: text('condition_operator'), // 'gt' | 'lt'
  conditionValue: real('condition_value'),
  conditionAsset: text('condition_asset'),
  
  // Legacy/Schema compatibility
  targetPrice: text('target_price'), 
  
  currentPrice: text('current_price'),
  settleAddress: text('settle_address'),
  
  isActive: integer('is_active').notNull().default(1),
  status: text('status').default('pending'),
  sideShiftOrderId: text('sideshift_order_id'),
  error: text('error'),
  
  createdAt: timestamp('created_at').defaultNow(),
  executedAt: timestamp('executed_at'),
  lastCheckedAt: timestamp('last_checked_at'),
});

// --- SHARED SCHEMAS (used by both bot and frontend) ---

export const coinPriceCache = pgTable('coin_price_cache', {
  id: serial('id').primaryKey(),
  coin: text('coin').notNull(),
  network: text('network').notNull(),
  name: text('name').notNull(),
  usdPrice: text('usd_price'),
  btcPrice: text('btc_price'),
  available: text('available').notNull().default('true'),
  expiresAt: timestamp('expires_at').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  unique().on(table.coin, table.network),
]);

export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  walletAddress: text('wallet_address'),
  theme: text('theme'),
  slippageTolerance: real('slippage_tolerance'),
  notificationsEnabled: text('notifications_enabled'),
  preferences: text('preferences'),
  emailNotifications: text('email_notifications'),
  telegramNotifications: text('telegram_notifications'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// --- FRONTEND SCHEMAS ---

export const swapHistory = pgTable('swap_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  walletAddress: text('wallet_address'),
  sideshiftOrderId: text('sideshift_order_id').notNull().unique(),
  quoteId: text('quote_id'),
  fromAsset: text('from_asset').notNull(),
  fromNetwork: text('from_network').notNull(),
  fromAmount: real('from_amount').notNull(),
  toAsset: text('to_asset').notNull(),
  toNetwork: text('to_network').notNull(),
  settleAmount: text('settle_amount').notNull(),
  depositAddress: text('deposit_address'),
  status: text('status').notNull().default('pending'),
  txHash: text('tx_hash'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at'),
});

export const chatHistory = pgTable('chat_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  walletAddress: text('wallet_address'),
  role: text('role').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata'),
  sessionId: text('session_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const discussions = pgTable('discussions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  content: text('content').notNull(),
  category: text('category').default('general'),
  likes: text('likes').default('0'),
  replies: text('replies').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at'),
}, (table) => [
	index("idx_discussions_category").on(table.category),
	index("idx_discussions_created_at").on(table.createdAt),
	index("idx_discussions_user_id").on(table.userId),
]);

// --- REWARDS SCHEMAS ---

export const courseProgress = pgTable('course_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull(),
  courseTitle: text('course_title').notNull(),
  completedModules: text('completed_modules').array().notNull().default(sql`ARRAY[]::text[]`),
  totalModules: integer('total_modules').notNull(),
  isCompleted: boolean('is_completed').notNull().default(false),
  completionDate: timestamp('completion_date'),
  lastAccessed: timestamp('last_accessed').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userCourseUnique: unique('course_progress_user_course_unique').on(table.userId, table.courseId),
}));

export const rewardsLog = pgTable('rewards_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actionType: rewardActionType('action_type').notNull(),
  actionMetadata: jsonb('action_metadata'),
  pointsEarned: integer('points_earned').notNull().default(0),
  tokensPending: numeric('tokens_pending', { precision: 20, scale: 8 }).notNull().default('0'),
  mintStatus: mintStatusType('mint_status').notNull().default('pending'),
  txHash: text('tx_hash'),
  blockchainNetwork: text('blockchain_network'),
  errorMessage: text('error_message'),
  claimedAt: timestamp('claimed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// --- RELATIONS ---

export const courseProgressRelations = relations(courseProgress, ({one}) => ({
	user: one(users, {
		fields: [courseProgress.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	courseProgresses: many(courseProgress),
	rewardsLogs: many(rewardsLog),
}));

export const rewardsLogRelations = relations(rewardsLog, ({one}) => ({
	user: one(users, {
		fields: [rewardsLog.userId],
		references: [users.id]
	}),
}));

const schema = {
  users,
  conversations,
  orders,
  checkouts,
  addressBook,
  watchedOrders,
  coinPriceCache,
  userSettings,
  swapHistory,
  chatHistory,
  dcaSchedules,
  limitOrders,
  courseProgress,
  rewardsLog,
  courseProgressRelations,
  usersRelations,
  rewardsLogRelations
};

// --- END INLINED SCHEMA ---

// In-memory fallback for development or connection issues
const memoryState = new Map<number, any>();

const connectionString = process.env.DATABASE_URL || 'postgres://mock:mock@localhost:5432/mock';
const client = neon(connectionString);
// Initialize drizzle with schema to fix type inference issues
export const db = drizzle(client, { schema });

// Type exports for backward compatibility
export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Checkout = typeof checkouts.$inferSelect;
export type AddressBookEntry = typeof addressBook.$inferSelect;
export type WatchedOrder = typeof watchedOrders.$inferSelect;
export type CoinPriceCache = typeof coinPriceCache.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type SwapHistory = typeof swapHistory.$inferSelect;
export type ChatHistory = typeof chatHistory.$inferSelect;
export type DCASchedule = typeof dcaSchedules.$inferSelect;
export type LimitOrder = typeof limitOrders.$inferSelect;
export type CourseProgress = typeof courseProgress.$inferSelect;
export type RewardsLog = typeof rewardsLog.$inferSelect;

// --- UNIFIED ORDER TYPES ---

export interface DelayedOrder {
  id: number;
  telegramId: number;
  orderType: 'limit_order' | 'dca';
  fromAsset: string;
  fromChain: string;
  toAsset: string;
  toChain: string;
  amount: number;
  settleAddress: string | null;
  // Limit specific
  targetPrice?: number;
  condition?: 'above' | 'below';
  expiryDate?: Date;
  // DCA specific
  frequency?: string;
  maxExecutions?: number;
  executionCount?: number;
  nextExecutionAt?: Date;
}

// --- FUNCTIONS ---

// NEW: Address Book Resolution
export async function resolveNickname(telegramId: number, nickname: string): Promise<string | null> {
  try {
    const result = await db.select({ address: addressBook.address })
      .from(addressBook)
      .where(and(
        eq(addressBook.telegramId, telegramId),
        eq(addressBook.label, nickname.toLowerCase())
      ))
      .limit(1);
      
    return result[0]?.address || null;
  } catch (error) {
    logger.error('Error resolving nickname:', error);
    return null;
  }

}

export async function getUser(telegramId: number): Promise<User | undefined> {
  const result = await db.select().from(users).where(eq(users.telegramId, telegramId));
  return result[0];
}

export async function setUserWalletAndSession(telegramId: number, walletAddress: string, sessionTopic: string) {
  await db.insert(users)
    .values({ telegramId, walletAddress, sessionTopic })
    .onConflictDoUpdate({
      target: users.telegramId,
      set: { walletAddress, sessionTopic }
    });
}

export async function getConversationState(telegramId: number) {
  try {
    const result = await db.select({ state: conversations.state, lastUpdated: conversations.lastUpdated })
        .from(conversations)
        .where(eq(conversations.telegramId, telegramId));
    
    if (!result[0]?.state) return null;

    const state = safeParseJSON(result[0].state);
    const lastUpdated = result[0].lastUpdated;

    // Expire state after 1 hour
    if (lastUpdated && (Date.now() - new Date(lastUpdated).getTime()) > 60 * 60 * 1000) {
      await clearConversationState(telegramId);
      return null;
    }
    return state;
  } catch(err) {
    return memoryState.get(telegramId) || null;
  }
}

export async function setConversationState(telegramId: number, state: any) {
  try {
    await db.insert(conversations)
      .values({ telegramId, state: JSON.stringify(state), lastUpdated: new Date() })
      .onConflictDoUpdate({
        target: conversations.telegramId,
        set: { state: JSON.stringify(state), lastUpdated: new Date() }
      });
  } catch(err) {
    memoryState.set(telegramId, state);
  }
}

export async function clearConversationState(telegramId: number) {
  try {
    await db.delete(conversations).where(eq(conversations.telegramId, telegramId));
  } catch(err) {
    memoryState.delete(telegramId);
  }
}

export async function createOrderEntry(
  telegramId: number,
  parsedCommand: ParsedCommand,
  order: SideShiftOrder,
  settleAmount: string | number,
  quoteId: string
) {
  const depositAddr = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress?.address;
  const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress?.memo : null;

  await db.insert(orders).values({
    telegramId,
    sideshiftOrderId: order.id,
    quoteId,
    fromAsset: parsedCommand.fromAsset!,
    fromNetwork: parsedCommand.fromChain!,
    fromAmount: parsedCommand.amount!.toString(),
    toAsset: parsedCommand.toAsset!,
    toNetwork: parsedCommand.toChain!,
    settleAmount: settleAmount.toString(),
    depositAddress: depositAddr!,
    depositMemo: depositMemo || null,
    status: 'pending'
  });
}

export async function getUserHistory(telegramId: number): Promise<Order[]> {
  return await db.select().from(orders)
    .where(eq(orders.telegramId, telegramId))
    .orderBy(desc(orders.createdAt))
    .limit(10);
}

export async function getLatestUserOrder(telegramId: number): Promise<Order | undefined> {
  const result = await db.select().from(orders)
    .where(eq(orders.telegramId, telegramId))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return result[0];
}

export async function updateOrderStatus(sideshiftOrderId: string, newStatus: string) {
  await db.update(orders)
    .set({ status: newStatus })
    .where(eq(orders.sideshiftOrderId, sideshiftOrderId));
}

export async function createCheckoutEntry(telegramId: number, checkout: SideShiftCheckoutResponse) {
  // Fix: Convert number to float if needed or ensure parsing is safe
  const amount = typeof checkout.settleAmount === 'string' ? parseFloat(checkout.settleAmount) : checkout.settleAmount;
  
  await db.insert(checkouts).values({
    telegramId,
    checkoutId: checkout.id,
    settleAsset: checkout.settleCoin,
    settleNetwork: checkout.settleNetwork,
    settleAmount: amount,
    settleAddress: checkout.settleAddress,
    status: 'pending'
  });
}

export async function getUserCheckouts(telegramId: number): Promise<Checkout[]> {
  return await db.select().from(checkouts)
    .where(eq(checkouts.telegramId, telegramId))
    .orderBy(desc(checkouts.createdAt))
    .limit(10);
}

// --- ORDER MONITOR HELPERS ---

const TERMINAL_STATUSES = ['settled', 'expired', 'refunded', 'failed'];

export async function getPendingOrders(): Promise<Order[]> {
  return await db.select().from(orders)
    .where(notInArray(orders.status, TERMINAL_STATUSES));
}

export async function getOrderBySideshiftId(sideshiftOrderId: string): Promise<Order | undefined> {
  const result = await db.select().from(orders)
    .where(eq(orders.sideshiftOrderId, sideshiftOrderId))
    .limit(1);
  return result[0];
}

// --- NEW FUNCTIONS FOR DCA & WATCHED ORDERS ---

/**
 * Adds an order to the watched orders table.
 */
export async function addWatchedOrder(telegramId: number, sideshiftOrderId: string, initialStatus: string) {
  await db.insert(watchedOrders).values({
    telegramId,
    sideshiftOrderId,
    lastStatus: initialStatus,
  }).onConflictDoNothing();
}

/**
 * Retrieves active DCA schedules.
 */
export async function getActiveDCASchedules(): Promise<DCASchedule[]> {
    try {
        return await db.select().from(dcaSchedules).where(eq(dcaSchedules.isActive, 1));
    } catch (error) {
        logger.error("Failed to get active DCA schedules", error);
        return [];
    }

}

/**
 * Updates a DCA schedule after execution.
 * Calculates the next execution time based on frequency.
 */
export async function updateDCAScheduleExecution(
  id: number,
  frequency: string,
  dayOfWeek?: string,
  dayOfMonth?: string
) {
  const now = new Date();
  let nextExecution = new Date(now);

  // Calculate next execution date
  if (frequency === 'daily') {
    nextExecution.setDate(nextExecution.getDate() + 1);
  } else if (frequency === 'weekly') {
    nextExecution.setDate(nextExecution.getDate() + 7);
  } else if (frequency === 'monthly') {
    nextExecution.setMonth(nextExecution.getMonth() + 1);
  }

  await db.update(dcaSchedules)
    .set({
      nextExecutionAt: nextExecution,
      ordersExecuted: sql`orders_executed + 1`,
    })
    .where(eq(dcaSchedules.id, id));
}

// --- NEW: Limit Order & Delayed Order Management ---

export async function createDCASchedule(
  telegramId: number | null,
  fromAsset: string,
  fromNetwork: string,
  toAsset: string,
  toNetwork: string,
  amount: string,
  frequency: 'daily' | 'weekly' | 'monthly',
  settleAddress: string,
  dayOfWeek?: number,
  dayOfMonth?: number
) {
  const intervalMap = { daily: 24, weekly: 168, monthly: 720 };
  const intervalHours = intervalMap[frequency] || 24;

  let nextExecutionAt = new Date();
  // Simple scheduling: start now. Complex cron logic omitted for brevity.

  const result = await db.insert(dcaSchedules).values({
      telegramId: telegramId || 0, // Fallback for web users
      fromAsset,
      fromNetwork,
      toAsset,
      toNetwork,
      amountPerOrder: amount,
      intervalHours,
      totalOrders: 10, // Default constant
      ordersExecuted: 0,
      isActive: 1,
      nextExecutionAt
  }).returning();
  
  return result[0];
}

export async function createLimitOrder(
  telegramId: number | null,
  fromAsset: string,
  fromNetwork: string,
  toAsset: string,
  toNetwork: string,
  amount: string,
  conditionOperator: 'gt' | 'lt',
  targetPrice: string | number,
  conditionAsset: string,
  settleAddress: string
) {
  const result = await db.insert(limitOrders).values({
      telegramId: telegramId || 0, // Fallback
      fromAsset,
      fromNetwork,
      toAsset,
      toNetwork,
      fromAmount: amount,
      targetPrice: targetPrice.toString(),
      conditionOperator,
      conditionValue: typeof targetPrice === 'string' ? parseFloat(targetPrice) : targetPrice,
      conditionAsset,
      settleAddress,
      isActive: 1,
      status: 'pending',
      createdAt: new Date(),
      lastCheckedAt: new Date()
  }).returning();

  return result[0];
}

export async function createDelayedOrder(data: Partial<DelayedOrder>) {
    if (data.orderType === 'limit_order') {
        await db.insert(limitOrders).values({
            telegramId: data.telegramId!,
            fromAsset: data.fromAsset!,
            fromNetwork: data.fromChain!,
            toAsset: data.toAsset!,
            toNetwork: data.toChain!,
            fromAmount: data.amount!.toString(),
            targetPrice: data.targetPrice!.toString(),
            conditionValue: data.targetPrice,
            conditionOperator: data.condition === 'above' ? 'gt' : 'lt',
            conditionAsset: data.fromAsset!, // assumption
            settleAddress: data.settleAddress,
            currentPrice: null,
            isActive: 1,
            lastCheckedAt: new Date(),
        });
    } else if (data.orderType === 'dca') {
        // Approximate interval hours from frequency string
        let intervalHours = 24;
        if(data.frequency === 'weekly') intervalHours = 168;
        if(data.frequency === 'monthly') intervalHours = 720;
        
        await db.insert(dcaSchedules).values({
            telegramId: data.telegramId!,
            fromAsset: data.fromAsset!,
            fromNetwork: data.fromChain!,
            toAsset: data.toAsset!,
            toNetwork: data.toChain!,
            amountPerOrder: data.amount!.toString(),
            intervalHours: intervalHours,
            totalOrders: data.maxExecutions || 10,
            ordersExecuted: 0,
            isActive: 1,
            nextExecutionAt: data.nextExecutionAt || new Date()
        });
    }
}

export async function getPendingDelayedOrders(): Promise<DelayedOrder[]> {
  const allOrders: DelayedOrder[] = [];

  // Fetch Limit Orders
  const pendingLimits = await db.select().from(limitOrders)
    .where(eq(limitOrders.isActive, 1));

  pendingLimits.forEach(o => {
      allOrders.push({
          id: o.id,
          telegramId: o.telegramId,
          orderType: 'limit_order',
          fromAsset: o.fromAsset,
          fromChain: o.fromNetwork,
          toAsset: o.toAsset,
          toChain: o.toNetwork,
          amount: parseFloat(o.fromAmount),
          settleAddress: o.settleAddress,
          targetPrice: o.conditionValue ? o.conditionValue : parseFloat(o.targetPrice || '0'),
          condition: o.conditionOperator === 'gt' ? 'above' : 'below', 
      });
  });

  // Fetch DCA Orders
  const pendingDCA = await db.select({
      id: dcaSchedules.id,
      telegramId: dcaSchedules.telegramId,
      fromAsset: dcaSchedules.fromAsset,
      fromChain: dcaSchedules.fromNetwork,
      toAsset: dcaSchedules.toAsset,
      toChain: dcaSchedules.toNetwork,
      amountPerOrder: dcaSchedules.amountPerOrder,
      intervalHours: dcaSchedules.intervalHours,
      totalOrders: dcaSchedules.totalOrders,
      ordersExecuted: dcaSchedules.ordersExecuted,
      nextExecutionAt: dcaSchedules.nextExecutionAt,
      walletAddress: users.walletAddress
  })
  .from(dcaSchedules)
  .leftJoin(users, eq(dcaSchedules.telegramId, users.telegramId))
  .where(eq(dcaSchedules.isActive, 1));

  pendingDCA.forEach(o => {
    // Map interval back to string frequency for compatibility
    let frequency = 'daily';
    if (o.intervalHours >= 168) frequency = 'weekly';
    if (o.intervalHours >= 720) frequency = 'monthly';

    allOrders.push({
        id: o.id,
        telegramId: o.telegramId,
        orderType: 'dca',
        fromAsset: o.fromAsset,
        fromChain: o.fromChain,
        toAsset: o.toAsset,
        toChain: o.toChain,
        amount: parseFloat(o.amountPerOrder),
        settleAddress: o.walletAddress,
        frequency,
        maxExecutions: o.totalOrders,
        executionCount: o.ordersExecuted,
        nextExecutionAt: o.nextExecutionAt
    });
  });

  return allOrders;
}

export async function updateDelayedOrderStatus(
  orderId: number, 
  status: 'active' | 'completed' | 'pending' | 'expired',
  executionCount?: number,
  nextExecutionAt?: Date
) {
  // Try updating Limit Orders
  if (status === 'completed' || status === 'expired') {
      await db.update(limitOrders)
        .set({ isActive: 0 })
        .where(eq(limitOrders.id, orderId));
  }

  // Try updating DCA Schedules
  if (status === 'completed') {
    await db.update(dcaSchedules)
        .set({ isActive: 0 })
        .where(eq(dcaSchedules.id, orderId));
  } else if (executionCount !== undefined && nextExecutionAt) {
      // Update execution progress
      await db.update(dcaSchedules)
        .set({ 
            ordersExecuted: executionCount,
            nextExecutionAt: nextExecutionAt
        })
        .where(eq(dcaSchedules.id, orderId));
  }
}

export async function cancelDelayedOrder(id: number, type: 'limit_order' | 'dca') {
    if (type === 'limit_order') {
        await db.update(limitOrders).set({ isActive: 0 }).where(eq(limitOrders.id, id));
    } else {
        await db.update(dcaSchedules).set({ isActive: 0 }).where(eq(dcaSchedules.id, id));
    }
}

export async function updateLimitOrderStatus(
  orderId: number,
  status: string,
  sideshiftOrderId?: string,
  error?: string
) {
  const updateData: any = { status };
  
  if (sideshiftOrderId) updateData.sideShiftOrderId = sideshiftOrderId;
  if (error) updateData.error = error;
  if (status === 'executed') {
      updateData.executedAt = new Date();
      updateData.isActive = 0;
  }
  if (status === 'failed' || status === 'cancelled') {
      updateData.isActive = 0;
  }

  await db.update(limitOrders)
    .set(updateData)
    .where(eq(limitOrders.id, orderId));
}


// --- STAKE ORDERS SCHEMA ---

export const stakeOrders = pgTable('stake_orders', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  sideshiftOrderId: text('sideshift_order_id').notNull().unique(),
  quoteId: text('quote_id').notNull(),
  fromAsset: text('from_asset').notNull(),
  fromNetwork: text('from_network').notNull(),
  fromAmount: real('from_amount').notNull(),
  swapToAsset: text('swap_to_asset').notNull(),
  swapToNetwork: text('swap_to_network').notNull(),
  stakeAsset: text('stake_asset').notNull(),
  stakeProtocol: text('stake_protocol').notNull(),
  stakeNetwork: text('stake_network').notNull(),
  settleAmount: text('settle_amount'),
  depositAddress: text('deposit_address').notNull(),
  depositMemo: text('deposit_memo'),
  stakeAddress: text('stake_address'),
  stakeTxHash: text('stake_tx_hash'),
  swapStatus: text('swap_status').notNull().default('pending'),
  stakeStatus: text('stake_status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index("idx_stake_orders_telegram_id").on(table.telegramId),
  index("idx_stake_orders_swap_status").on(table.swapStatus),
  index("idx_stake_orders_stake_status").on(table.stakeStatus),
]);

export type StakeOrder = typeof stakeOrders.$inferSelect;

// --- STAKE ORDER FUNCTIONS ---

/**
 * Create a new stake order entry
 */
export async function createStakeOrder(data: {
  telegramId: number;
  sideshiftOrderId: string;
  quoteId: string;
  fromAsset: string;
  fromNetwork: string;
  fromAmount: number;
  swapToAsset: string;
  swapToNetwork: string;
  stakeAsset: string;
  stakeProtocol: string;
  stakeNetwork: string;
  depositAddress: string;
  depositMemo?: string;
  stakeAddress?: string;
}): Promise<StakeOrder> {
  const result = await db.insert(stakeOrders).values({
    telegramId: data.telegramId,
    sideshiftOrderId: data.sideshiftOrderId,
    quoteId: data.quoteId,
    fromAsset: data.fromAsset,
    fromNetwork: data.fromNetwork,
    fromAmount: data.fromAmount,
    swapToAsset: data.swapToAsset,
    swapToNetwork: data.swapToNetwork,
    stakeAsset: data.stakeAsset,
    stakeProtocol: data.stakeProtocol,
    stakeNetwork: data.stakeNetwork,
    depositAddress: data.depositAddress,
    depositMemo: data.depositMemo || null,
    stakeAddress: data.stakeAddress || null,
    swapStatus: 'pending',
    stakeStatus: 'pending',
  }).returning();

  return result[0];
}

/**
 * Get stake order by SideShift order ID
 */
export async function getStakeOrderBySideshiftId(sideshiftOrderId: string): Promise<StakeOrder | undefined> {
  const result = await db.select().from(stakeOrders)
    .where(eq(stakeOrders.sideshiftOrderId, sideshiftOrderId))
    .limit(1);
  return result[0];
}

/**
 * Get all pending stake orders (swap completed, stake pending)
 */
export async function getPendingStakeOrders(): Promise<StakeOrder[]> {
  return await db.select().from(stakeOrders)
    .where(and(
      eq(stakeOrders.swapStatus, 'settled'),
      eq(stakeOrders.stakeStatus, 'pending')
    ));
}

/**
 * Get all stake orders for a user
 */
export async function getUserStakeOrders(telegramId: number): Promise<StakeOrder[]> {
  return await db.select().from(stakeOrders)
    .where(eq(stakeOrders.telegramId, telegramId))
    .orderBy(desc(stakeOrders.createdAt))
    .limit(20);
}

/**
 * Update swap status for a stake order
 */
export async function updateStakeOrderSwapStatus(
  sideshiftOrderId: string,
  swapStatus: string,
  settleAmount?: string
): Promise<void> {
  const updateData: any = {
    swapStatus,
    updatedAt: new Date()
  };

  if (settleAmount) {
    updateData.settleAmount = settleAmount;
  }

  await db.update(stakeOrders)
    .set(updateData)
    .where(eq(stakeOrders.sideshiftOrderId, sideshiftOrderId));
}

/**
 * Update stake status for a stake order
 */
export async function updateStakeOrderStakeStatus(
  sideshiftOrderId: string,
  stakeStatus: string,
  stakeTxHash?: string
): Promise<void> {
  const updateData: any = {
    stakeStatus,
    updatedAt: new Date()
  };

  if (stakeTxHash) {
    updateData.stakeTxHash = stakeTxHash;
  }

  if (stakeStatus === 'confirmed') {
    updateData.completedAt = new Date();
  }

  await db.update(stakeOrders)
    .set(updateData)
    .where(eq(stakeOrders.sideshiftOrderId, sideshiftOrderId));
}

/**
 * Get stake order by ID
 */
export async function getStakeOrderById(id: number): Promise<StakeOrder | undefined> {
  const result = await db.select().from(stakeOrders)
    .where(eq(stakeOrders.id, id))
    .limit(1);
  return result[0];
}

