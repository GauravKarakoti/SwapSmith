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
});


export const addressBook = pgTable('address_book', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  nickname: text('nickname').notNull(),
  address: text('address').notNull(),
  chain: text('chain').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// --- TYPE DEFINITIONS ---
export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Checkout = typeof checkouts.$inferSelect;
export type AddressBookEntry = typeof addressBook.$inferSelect;
export type StakeOrder = typeof stakeOrders.$inferSelect;


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

// --- STAKE ORDERS FUNCTIONS ---

export async function createStakeOrderEntry(
  telegramId: number,
  parsedCommand: ParsedCommand,
  order: SideShiftOrder,
  settleAmount: string | number,
  quoteId: string
) {
  const depositAddr = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress?.address;
  const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress?.memo : null;

  await db.insert(stakeOrders).values({
    telegramId,
    sideshiftOrderId: order.id,
    quoteId,
    fromAsset: parsedCommand.fromAsset!,
    fromNetwork: parsedCommand.fromChain!,
    fromAmount: parsedCommand.amount!,
    swapToAsset: parsedCommand.toAsset!,
    swapToNetwork: parsedCommand.toChain!,
    stakeAsset: parsedCommand.stakeAsset!,
    stakeProtocol: parsedCommand.stakeProtocol!,
    stakeNetwork: parsedCommand.stakeChain!,
    settleAmount: settleAmount.toString(),
    depositAddress: depositAddr!,
    depositMemo: depositMemo || null,
    swapStatus: 'pending',
    stakeStatus: 'pending',
  });
}

export async function getPendingStakeOrders(): Promise<StakeOrder[]> {
  return await db.select().from(stakeOrders)
    .where(eq(stakeOrders.swapStatus, 'settled'))
    .where(eq(stakeOrders.stakeStatus, 'pending'))
    .orderBy(desc(stakeOrders.createdAt));
}

export async function updateStakeOrderSwapStatus(sideshiftOrderId: string, newStatus: string, settleAmount?: string) {
  const updateData: Partial<StakeOrder> = { 
    swapStatus: newStatus,
    updatedAt: new Date()
  };
  if (settleAmount) {
    updateData.settleAmount = settleAmount;
  }
  await db.update(stakeOrders)
    .set(updateData)
    .where(eq(stakeOrders.sideshiftOrderId, sideshiftOrderId));
}

export async function updateStakeOrderStakeStatus(
  sideshiftOrderId: string, 
  newStatus: string, 
  stakeAddress?: string,
  stakeTxHash?: string
) {
  const updateData: Partial<StakeOrder> = { 
    stakeStatus: newStatus,
    updatedAt: new Date()
  };
  if (stakeAddress) updateData.stakeAddress = stakeAddress;
  if (stakeTxHash) updateData.stakeTxHash = stakeTxHash;
  if (newStatus === 'completed') updateData.completedAt = new Date();
  
  await db.update(stakeOrders)
    .set(updateData)
    .where(eq(stakeOrders.sideshiftOrderId, sideshiftOrderId));
}

export async function getUserStakeHistory(telegramId: number): Promise<StakeOrder[]> {
  return await db.select().from(stakeOrders)
    .where(eq(stakeOrders.telegramId, telegramId))
    .orderBy(desc(stakeOrders.createdAt))
    .limit(10);
}

export async function getStakeOrderById(sideshiftOrderId: string): Promise<StakeOrder | undefined> {
  const result = await db.select().from(stakeOrders)
    .where(eq(stakeOrders.sideshiftOrderId, sideshiftOrderId))
    .limit(1);
  return result[0];
}
