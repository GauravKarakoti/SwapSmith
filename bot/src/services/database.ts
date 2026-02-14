import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, serial, text, real, timestamp, bigint, integer } from 'drizzle-orm/pg-core';
import { eq, desc, notInArray } from 'drizzle-orm';
import dotenv from 'dotenv';
import type { SideShiftOrder, SideShiftCheckoutResponse } from './sideshift-client';
import type { ParsedCommand } from './groq-client';

dotenv.config();
const memoryAddressBook = new Map<number, Map<string, { address: string; chain: string }>>();
const memoryState = new Map<number, any>();
//newly added
const connectionString = process.env.DATABASE_URL || 'postgres://mock:mock@localhost:5432/mock';
const client = neon(connectionString);
export const db = drizzle(client);

// --- SCHEMAS ---
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull().unique(),
  walletAddress: text('wallet_address'),
  sessionTopic: text('session_topic'),
});

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull().unique(),
  state: text('state'),
  lastUpdated: timestamp('last_updated').defaultNow(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  sideshiftOrderId: text('sideshift_order_id').notNull().unique(),
  quoteId: text('quote_id').notNull(),
  fromAsset: text('from_asset').notNull(),
  fromNetwork: text('from_network').notNull(),
  fromAmount: real('from_amount').notNull(),
  toAsset: text('to_asset').notNull(),
  toNetwork: text('to_network').notNull(),
  settleAmount: text('settle_amount').notNull(),
  depositAddress: text('deposit_address').notNull(),
  depositMemo: text('deposit_memo'),
  status: text('status').notNull().default('pending'),
  txHash: text('tx_hash'),
  createdAt: timestamp('created_at').defaultNow(),
});

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
  nickname: text('nickname').notNull(),
  address: text('address').notNull(),
  chain: text('chain').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const watchedOrders = pgTable('watched_orders', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  sideshiftOrderId: text('sideshift_order_id').notNull().unique(),
  lastStatus: text('last_status').notNull().default('pending'),
  lastChecked: timestamp('last_checked').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Caching tables
export const coinPriceCache = pgTable('coin_price_cache', {
  id: serial('id').primaryKey(),
  coin: text('coin').notNull(),
  network: text('network').notNull(),
  name: text('name').notNull(),
  usdPrice: text('usd_price'),
  btcPrice: text('btc_price'),
  available: text('available').notNull().default('true'),
  expiresAt: timestamp('expires_at').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  walletAddress: text('wallet_address'),
  theme: text('theme').default('dark'),
  slippageTolerance: real('slippage_tolerance').default(0.5),
  notificationsEnabled: text('notifications_enabled').default('true'),
  defaultFromAsset: text('default_from_asset'),
  defaultToAsset: text('default_to_asset'),
  preferences: text('preferences'),
  emailNotifications: text('email_notifications'),
  telegramNotifications: text('telegram_notifications').default('false'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const swapHistory = pgTable('swap_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  walletAddress: text('wallet_address'),
  sideshiftOrderId: text('sideshift_order_id').notNull(),
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
  updatedAt: timestamp('updated_at').defaultNow(),
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

// DCA (Dollar Cost Averaging) Schedules
export const dcaSchedules = pgTable('dca_schedules', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  fromAsset: text('from_asset').notNull(),
  fromChain: text('from_chain').notNull(),
  toAsset: text('to_asset').notNull(),
  toChain: text('to_chain').notNull(),
  amount: real('amount').notNull(),
  frequency: text('frequency').notNull(), // 'daily', 'weekly', 'monthly'
  dayOfWeek: text('day_of_week'), // For weekly: 'monday', 'tuesday', etc.
  dayOfMonth: text('day_of_month'), // For monthly: '1', '15', etc.
  settleAddress: text('settle_address').notNull(),
  isActive: text('is_active').notNull().default('true'),
  lastExecuted: timestamp('last_executed'),
  nextExecution: timestamp('next_execution').notNull(),
  executionCount: integer('execution_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const limitOrders = pgTable('limit_orders', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  fromAsset: text('from_asset').notNull(),
  fromChain: text('from_chain').notNull(),
  toAsset: text('to_asset').notNull(),
  toChain: text('to_chain').notNull(),
  amount: real('amount').notNull(),
  conditionOperator: text('condition_operator').notNull(), // 'gt' or 'lt'
  conditionValue: real('condition_value').notNull(),
  conditionAsset: text('condition_asset').notNull(),
  settleAddress: text('settle_address'),
  status: text('status').notNull().default('pending'), // pending, executing, executed, cancelled, failed
  sideShiftOrderId: text('sideshift_order_id'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  executedAt: timestamp('executed_at'),
});

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

// --- FUNCTIONS ---

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
  try{
    const result = await db.select({ state: conversations.state, lastUpdated: conversations.lastUpdated }).from(conversations).where(eq(conversations.telegramId, telegramId));
    if (!result[0]?.state) return null;

    const state = JSON.parse(result[0].state);
    const lastUpdated = result[0].lastUpdated;

    if (lastUpdated && (Date.now() - new Date(lastUpdated).getTime()) > 60 * 60 * 1000) {
    await clearConversationState(telegramId);
    return null;
    }
    return state;
  }catch(err){
    return memoryState.get(telegramId) || null;
  }
}

export async function setConversationState(telegramId: number, state: any) {
  try{
    await db.insert(conversations)
    .values({ telegramId, state: JSON.stringify(state), lastUpdated: new Date() })
    .onConflictDoUpdate({
      target: conversations.telegramId,
      set: { state: JSON.stringify(state), lastUpdated: new Date() }
    });
  }catch(err){
    memoryState.set(telegramId, state);
  }
}

export async function clearConversationState(telegramId: number) {
  try{
    await db.delete(conversations).where(eq(conversations.telegramId, telegramId));
  }catch(err){
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
    fromAmount: parsedCommand.amount!,
    toAsset: parsedCommand.toAsset!,
    toNetwork: parsedCommand.toChain!,
    settleAmount: settleAmount.toString(),
    depositAddress: depositAddr!,
    depositMemo: depositMemo || null
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
  await db.insert(checkouts).values({
    telegramId,
    checkoutId: checkout.id,
    settleAsset: checkout.settleCoin,
    settleNetwork: checkout.settleNetwork,
    settleAmount: parseFloat(checkout.settleAmount),
    settleAddress: checkout.settleAddress,
  });
}

export async function getUserCheckouts(telegramId: number): Promise<Checkout[]> {
  return await db.select().from(checkouts)
    .where(eq(checkouts.telegramId, telegramId))
    .orderBy(desc(checkouts.createdAt))
    .limit(10);
}

// --- ORDER MONITOR HELPERS ---

/** Terminal statuses that no longer need monitoring */
const TERMINAL_STATUSES = ['settled', 'expired', 'refunded', 'failed'];

/** Returns all orders that are NOT in a terminal state (for background polling). */
export async function getPendingOrders(): Promise<Order[]> {
  return await db.select().from(orders)
    .where(notInArray(orders.status, TERMINAL_STATUSES));
}

/** Looks up a single order by its SideShift order ID. */
export async function getOrderBySideshiftId(sideshiftOrderId: string): Promise<Order | undefined> {
  const result = await db.select().from(orders)
    .where(eq(orders.sideshiftOrderId, sideshiftOrderId))
    .limit(1);
  return result[0];
}
