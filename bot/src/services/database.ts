import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, serial, text, real, timestamp, bigint, integer } from 'drizzle-orm/pg-core';
import { eq, desc, and, sql } from 'drizzle-orm'; // Added 'and', 'sql'
import dotenv from 'dotenv';
import type { SideShiftOrder, SideShiftCheckoutResponse } from './sideshift-client';
import type { ParsedCommand } from './groq-client';

dotenv.config();
const memoryAddressBook = new Map<number, Map<string, { address: string; chain: string }>>();
const memoryState = new Map<number, any>();
//newly added
const connectionString = process.env.DATABASE_URL || 'postgres://mock:mock@localhost:5432/mock';
const client = neon(connectionString);
const db = drizzle(client);

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

export const limitOrders = pgTable('limit_orders', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  fromAsset: text('from_asset').notNull(),
  toAsset: text('to_asset').notNull(),
  fromNetwork: text('from_network'), // Can be null if inferred later
  toNetwork: text('to_network'),     // Can be null if inferred later
  amount: real('amount').notNull(),
  conditionAsset: text('condition_asset').notNull(), // The asset to watch price for
  conditionType: text('condition_type').notNull(), // 'above' | 'below'
  targetPrice: real('target_price').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'executed', 'cancelled', 'failed'
  sideshiftOrderId: text('sideshift_order_id'),
  settleAddress: text('settle_address'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dcaPlans = pgTable('dca_plans', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  fromAsset: text('from_asset').notNull(),
  toAsset: text('to_asset').notNull(),
  fromNetwork: text('from_network'),
  toNetwork: text('to_network'),
  amount: real('amount').notNull(),
  frequencyDays: integer('frequency_days').notNull(),
  lastRun: timestamp('last_run'),
  nextRun: timestamp('next_run').notNull(),
  status: text('status').notNull().default('active'), // active, paused, cancelled
  settleAddress: text('settle_address'),
  createdAt: timestamp('created_at').defaultNow(),
});

// --- TYPE DEFINITIONS ---
export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Checkout = typeof checkouts.$inferSelect;
export type LimitOrder = typeof limitOrders.$inferSelect;
export type DcaPlan = typeof dcaPlans.$inferSelect;
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

export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Checkout = typeof checkouts.$inferSelect;
export type AddressBookEntry = typeof addressBook.$inferSelect;
export type WatchedOrder = typeof watchedOrders.$inferSelect;
export type DCASchedule = typeof dcaSchedules.$inferSelect;

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
    depositMemo: depositMemo || null,
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

// --- LIMIT ORDER FUNCTIONS ---

export async function createLimitOrder(order: Omit<LimitOrder, 'id' | 'createdAt' | 'status' | 'sideshiftOrderId' | 'errorMessage'>) {
  return await db.insert(limitOrders).values(order).returning();
}

export async function getPendingLimitOrders(): Promise<LimitOrder[]> {
  return await db.select().from(limitOrders).where(eq(limitOrders.status, 'pending'));
}

export async function updateLimitOrderStatus(id: number, status: string, sideshiftOrderId?: string, errorMessage?: string) {
  const updates: any = { status };
  if (sideshiftOrderId) updates.sideshiftOrderId = sideshiftOrderId;
  if (errorMessage) updates.errorMessage = errorMessage;

  await db.update(limitOrders)
    .set(updates)
    .where(eq(limitOrders.id, id));
}

export async function getLimitOrdersByUser(telegramId: number): Promise<LimitOrder[]> {
  return await db.select().from(limitOrders)
    .where(eq(limitOrders.telegramId, telegramId))
    .orderBy(desc(limitOrders.createdAt));
}

// --- DCA FUNCTIONS ---

export async function createDcaPlan(plan: Omit<DcaPlan, 'id' | 'createdAt' | 'lastRun'>) {
  return await db.insert(dcaPlans).values(plan).returning();
}

export async function getDueDcaPlans(): Promise<DcaPlan[]> {
  const now = new Date();
  return await db.select().from(dcaPlans)
    .where(and(
      eq(dcaPlans.status, 'active'),
      lte(dcaPlans.nextRun, now)
    ));
}

export async function updateDcaRun(id: number, nextRun: Date) {
  await db.update(dcaPlans)
    .set({ lastRun: new Date(), nextRun })
    .where(eq(dcaPlans.id, id));
}

export async function getUserDcaPlans(telegramId: number): Promise<DcaPlan[]> {
  return await db.select().from(dcaPlans)
    .where(eq(dcaPlans.telegramId, telegramId))
    .orderBy(desc(dcaPlans.createdAt));
export async function addAddressBookEntry(telegramId: number, nickname: string, address: string, chain: string) {
  try{
    await db.insert(addressBook)
    .values({ telegramId, nickname, address, chain })
    .onConflictDoUpdate({
      target: [addressBook.telegramId, addressBook.nickname],
      set: { address, chain }
    });
  }catch(err){
    if (!memoryAddressBook.has(telegramId)) memoryAddressBook.set(telegramId, new Map());
    memoryAddressBook.get(telegramId)!.set(nickname.toLowerCase(), { address, chain });
  }
}

export async function getAddressBookEntries(telegramId: number): Promise<AddressBookEntry[]> {
  try {
    return await db.select().from(addressBook)
      .where(eq(addressBook.telegramId, telegramId))
      .orderBy(desc(addressBook.createdAt));
  }catch(arr){
    const m = memoryAddressBook.get(telegramId);
    if (!m) return [];
    // return a compatible shape (cast is fine for dev fallback)
    return [...m.entries()].map(([nickname, v]) => ({
      id: 0 as any,
      telegramId,
      nickname,
      address: v.address,
      chain: v.chain,
      createdAt: new Date() as any,
    }));
  }
}

export async function resolveNickname(telegramId: number, nickname: string): Promise<string | null> {
  try{
    const result = await db.select({ address: addressBook.address })
    .from(addressBook)
    .where(
      and(
        eq(addressBook.telegramId, telegramId), 
        eq(addressBook.nickname, nickname)
      )
    ) // Corrected multi-where syntax
    .limit(1);
    return result[0]?.address || null;
  }catch(err){
    return null;
  }
}


// --- WATCHED ORDERS FUNCTIONS ---

export async function addWatchedOrder(telegramId: number, sideshiftOrderId: string, initialStatus: string = 'pending') {
  await db.insert(watchedOrders)
    .values({ 
      telegramId, 
      sideshiftOrderId, 
      lastStatus: initialStatus,
      lastChecked: new Date()
    })
    .onConflictDoUpdate({
      target: watchedOrders.sideshiftOrderId,
      set: { lastChecked: new Date() }
    });
}

export async function removeWatchedOrder(sideshiftOrderId: string) {
  await db.delete(watchedOrders).where(eq(watchedOrders.sideshiftOrderId, sideshiftOrderId));
}

export async function getAllWatchedOrders(): Promise<WatchedOrder[]> {
  return await db.select().from(watchedOrders);
}

export async function getUserWatchedOrders(telegramId: number): Promise<WatchedOrder[]> {
  return await db.select().from(watchedOrders)
    .where(eq(watchedOrders.telegramId, telegramId))
    .orderBy(desc(watchedOrders.createdAt));
}

export async function updateWatchedOrderStatus(sideshiftOrderId: string, newStatus: string) {
  await db.update(watchedOrders)
    .set({ lastStatus: newStatus, lastChecked: new Date() })
    .where(eq(watchedOrders.sideshiftOrderId, sideshiftOrderId));
}


// --- DCA SCHEDULE FUNCTIONS ---

export async function createDCASchedule(
  telegramId: number,
  fromAsset: string,
  fromChain: string,
  toAsset: string,
  toChain: string,
  amount: number,
  frequency: string,
  settleAddress: string,
  dayOfWeek?: string,
  dayOfMonth?: string
) {
  const nextExecution = calculateNextExecution(frequency, dayOfWeek, dayOfMonth);
  
  const result = await db.insert(dcaSchedules).values({
    telegramId,
    fromAsset,
    fromChain,
    toAsset,
    toChain,
    amount,
    frequency,
    dayOfWeek: dayOfWeek || null,
    dayOfMonth: dayOfMonth || null,
    settleAddress,
    nextExecution,
    isActive: 'true'
  }).returning();
  
  return result[0];
}

export async function getUserDCASchedules(telegramId: number): Promise<DCASchedule[]> {
  return await db.select().from(dcaSchedules)
    .where(eq(dcaSchedules.telegramId, telegramId))
    .orderBy(desc(dcaSchedules.createdAt));
}

export async function getActiveDCASchedules(): Promise<DCASchedule[]> {
  return await db.select().from(dcaSchedules)
    .where(eq(dcaSchedules.isActive, 'true'));
}

export async function updateDCAScheduleStatus(id: number, isActive: boolean) {
  await db.update(dcaSchedules)
    .set({ isActive: isActive ? 'true' : 'false' })
    .where(eq(dcaSchedules.id, id));
}

export async function updateDCAScheduleExecution(id: number, frequency: string, dayOfWeek?: string, dayOfMonth?: string) {
  const nextExecution = calculateNextExecution(frequency, dayOfWeek, dayOfMonth);
  
  await db.update(dcaSchedules)
    .set({ 
      lastExecuted: new Date(),
      nextExecution,
      executionCount: sql`${dcaSchedules.executionCount} + 1`
    })
    .where(eq(dcaSchedules.id, id));
}

export async function deleteDCASchedule(id: number) {
  await db.delete(dcaSchedules).where(eq(dcaSchedules.id, id));
}

function calculateNextExecution(frequency: string, dayOfWeek?: string, dayOfMonth?: string): Date {
  const now = new Date();
  const next = new Date(now);
  
  if (frequency === 'daily') {
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0); // 9 AM next day
  } else if (frequency === 'weekly') {
    const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(dayOfWeek?.toLowerCase() || 'monday');
    const currentDay = next.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntilTarget);
    next.setHours(9, 0, 0, 0);
  } else if (frequency === 'monthly') {
    const targetDate = parseInt(dayOfMonth || '1');
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(targetDate, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    next.setHours(9, 0, 0, 0);
  }
  
  return next;
}
