import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, serial, text, real, timestamp, bigint } from 'drizzle-orm/pg-core';
import { eq, desc } from 'drizzle-orm';
import dotenv from 'dotenv';
import type { SideShiftOrder, SideShiftCheckoutResponse } from './sideshift-client';
import type { ParsedCommand } from './groq-client';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

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
  state: text('state'), // JSON string
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

// --- DELAYED ORDERS TABLE (Limit Orders & DCA) ---
export const delayedOrders = pgTable('delayed_orders', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  orderType: text('order_type').notNull(), // 'limit_order' or 'dca'
  intentData: text('intent_data').notNull(), // JSON string of ParsedCommand
  
  // Common fields
  fromAsset: text('from_asset'),
  fromChain: text('from_chain'),
  toAsset: text('to_asset').notNull(),
  toChain: text('to_chain'),
  amount: real('amount').notNull(),
  settleAddress: text('settle_address').notNull(),
  
  // Limit Order specific
  targetPrice: real('target_price'),
  condition: text('condition'), // 'above' or 'below'
  expiryDate: timestamp('expiry_date'),
  
  // DCA specific
  frequency: text('frequency'), // 'daily', 'weekly', 'monthly'
  totalAmount: real('total_amount'),
  numPurchases: serial('num_purchases'),
  startDate: timestamp('start_date'),
  
  // Execution tracking
  status: text('status').notNull().default('pending'), // 'pending', 'active', 'completed', 'cancelled', 'expired'
  executionCount: serial('execution_count').default(0),
  maxExecutions: serial('max_executions').default(1),
  nextExecutionAt: timestamp('next_execution_at'),
  lastExecutedAt: timestamp('last_executed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// --- PRICE ALERTS TABLE ---
export const priceAlerts = pgTable('price_alerts', {
  id: serial('id').primaryKey(),
  asset: text('asset').notNull(),
  chain: text('chain'),
  targetPrice: real('target_price').notNull(),
  condition: text('condition').notNull(), // 'above' or 'below'
  currentPrice: real('current_price'),
  triggered: text('triggered').default('false'),
  delayedOrderId: serial('delayed_order_id'),
  createdAt: timestamp('created_at').defaultNow(),
  triggeredAt: timestamp('triggered_at'),
});

// --- TYPE DEFINITIONS ---
export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Checkout = typeof checkouts.$inferSelect;
export type AddressBookEntry = typeof addressBook.$inferSelect;
export type DelayedOrder = typeof delayedOrders.$inferSelect;
export type PriceAlert = typeof priceAlerts.$inferSelect;


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
  const result = await db.select({ state: conversations.state }).from(conversations).where(eq(conversations.telegramId, telegramId));
  return result[0]?.state ? JSON.parse(result[0].state) : null;
}

export async function setConversationState(telegramId: number, state: any) {
  await db.insert(conversations)
    .values({ telegramId, state: JSON.stringify(state) })
    .onConflictDoUpdate({
      target: conversations.telegramId,
      set: { state: JSON.stringify(state) }
    });
}

export async function clearConversationState(telegramId: number) {
  await db.delete(conversations).where(eq(conversations.telegramId, telegramId));
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

// --- ADDRESS BOOK FUNCTIONS ---

export async function addAddressBookEntry(telegramId: number, nickname: string, address: string, chain: string) {
  await db.insert(addressBook)
    .values({ telegramId, nickname, address, chain })
    .onConflictDoUpdate({
      target: [addressBook.telegramId, addressBook.nickname],
      set: { address, chain }
    });
}

export async function getAddressBookEntries(telegramId: number): Promise<AddressBookEntry[]> {
  return await db.select().from(addressBook)
    .where(eq(addressBook.telegramId, telegramId))
    .orderBy(desc(addressBook.createdAt));
}

export async function resolveNickname(telegramId: number, nickname: string): Promise<string | null> {
  const result = await db.select({ address: addressBook.address })
    .from(addressBook)
    .where(eq(addressBook.telegramId, telegramId))
    .where(eq(addressBook.nickname, nickname))
    .limit(1);
  return result[0]?.address || null;
}

// --- DELAYED ORDERS FUNCTIONS ---

export async function createDelayedOrder(
  telegramId: number,
  orderType: 'limit_order' | 'dca',
  intentData: any,
  settleAddress: string
): Promise<DelayedOrder> {
  const data = {
    telegramId,
    orderType,
    intentData: JSON.stringify(intentData),
    fromAsset: intentData.fromAsset,
    fromChain: intentData.fromChain,
    toAsset: intentData.toAsset,
    toChain: intentData.toChain,
    amount: intentData.amount,
    settleAddress,
    targetPrice: intentData.targetPrice,
    condition: intentData.condition,
    expiryDate: intentData.expiryDate ? new Date(intentData.expiryDate) : null,
    frequency: intentData.frequency,
    totalAmount: intentData.totalAmount,
    numPurchases: intentData.numPurchases,
    startDate: intentData.startDate ? new Date(intentData.startDate) : null,
    status: 'pending',
    executionCount: 0,
    maxExecutions: orderType === 'dca' ? intentData.numPurchases || 1 : 1,
    nextExecutionAt: orderType === 'dca' ? (intentData.startDate ? new Date(intentData.startDate) : new Date()) : null,
  };

  const result = await db.insert(delayedOrders).values(data).returning();
  return result[0];
}

export async function getPendingDelayedOrders(): Promise<DelayedOrder[]> {
  return await db.select().from(delayedOrders)
    .where(eq(delayedOrders.status, 'pending'))
    .orWhere(eq(delayedOrders.status, 'active'));
}

export async function getUserDelayedOrders(telegramId: number): Promise<DelayedOrder[]> {
  return await db.select().from(delayedOrders)
    .where(eq(delayedOrders.telegramId, telegramId))
    .orderBy(desc(delayedOrders.createdAt));
}

export async function updateDelayedOrderStatus(
  orderId: number,
  status: string,
  executionCount?: number,
  nextExecutionAt?: Date
) {
  const updateData: any = { status, updatedAt: new Date() };
  if (executionCount !== undefined) updateData.executionCount = executionCount;
  if (nextExecutionAt !== undefined) updateData.nextExecutionAt = nextExecutionAt;
  if (status === 'completed' || status === 'cancelled' || status === 'expired') {
    updateData.lastExecutedAt = new Date();
  }

  await db.update(delayedOrders)
    .set(updateData)
    .where(eq(delayedOrders.id, orderId));
}

export async function cancelDelayedOrder(orderId: number, telegramId: number): Promise<boolean> {
  const result = await db.select().from(delayedOrders)
    .where(eq(delayedOrders.id, orderId))
    .where(eq(delayedOrders.telegramId, telegramId))
    .limit(1);

  if (!result[0]) return false;

  await db.update(delayedOrders)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(delayedOrders.id, orderId));

  return true;
}

export async function getDelayedOrderById(orderId: number): Promise<DelayedOrder | undefined> {
  const result = await db.select().from(delayedOrders)
    .where(eq(delayedOrders.id, orderId))
    .limit(1);
  return result[0];
}

// --- PRICE ALERTS FUNCTIONS ---

export async function createPriceAlert(
  asset: string,
  targetPrice: number,
  condition: 'above' | 'below',
  delayedOrderId?: number,
  chain?: string
): Promise<PriceAlert> {
  const result = await db.insert(priceAlerts).values({
    asset,
    chain,
    targetPrice,
    condition,
    delayedOrderId,
    triggered: 'false',
  }).returning();
  return result[0];
}

export async function getActivePriceAlerts(): Promise<PriceAlert[]> {
  return await db.select().from(priceAlerts)
    .where(eq(priceAlerts.triggered, 'false'));
}

export async function updatePriceAlertCurrentPrice(alertId: number, currentPrice: number) {
  await db.update(priceAlerts)
    .set({ currentPrice })
    .where(eq(priceAlerts.id, alertId));
}

export async function markPriceAlertTriggered(alertId: number) {
  await db.update(priceAlerts)
    .set({ triggered: 'true', triggeredAt: new Date() })
    .where(eq(priceAlerts.id, alertId));
}

export async function getPriceAlertsForOrder(delayedOrderId: number): Promise<PriceAlert[]> {
  return await db.select().from(priceAlerts)
    .where(eq(priceAlerts.delayedOrderId, delayedOrderId));
}
