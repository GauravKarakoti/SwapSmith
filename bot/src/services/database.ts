import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, serial, text, real, timestamp, bigint, unique } from 'drizzle-orm/pg-core';
import { eq, desc, and } from 'drizzle-orm'; // Added 'and'
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

// --- CACHING TABLES ---

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
}, (table) => ({
  coinNetworkUnique: unique().on(table.coin, table.network),
}));

export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(), // Firebase UID or wallet address
  walletAddress: text('wallet_address'),
  theme: text('theme').default('dark'),
  slippageTolerance: real('slippage_tolerance').default(0.5),
  notificationsEnabled: text('notifications_enabled').default('true'),
  defaultFromAsset: text('default_from_asset'),
  defaultToAsset: text('default_to_asset'),
  preferences: text('preferences'), // Additional JSON preferences  
  emailNotifications: text('email_notifications'),
  telegramNotifications: text('telegram_notifications').default('false'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const swapHistory = pgTable('swap_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(), // Firebase UID or wallet address
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
  userId: text('user_id').notNull(), // Firebase UID or wallet address
  walletAddress: text('wallet_address'),
  role: text('role').notNull(), // 'user' or 'assistant'
  content: text('content').notNull(),
  metadata: text('metadata'), // JSON string for additional data
  sessionId: text('session_id'),
  createdAt: timestamp('created_at').defaultNow(),
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
  const result = await db.select({ state: conversations.state, lastUpdated: conversations.lastUpdated }).from(conversations).where(eq(conversations.telegramId, telegramId));
  if (!result[0]?.state) return null;

  const state = JSON.parse(result[0].state);
  const lastUpdated = result[0].lastUpdated;

  if (lastUpdated && (Date.now() - new Date(lastUpdated).getTime()) > 60 * 60 * 1000) {
    await clearConversationState(telegramId);
    return null;
  }
  return state;
}

export async function setConversationState(telegramId: number, state: any) {
  await db.insert(conversations)
    .values({ telegramId, state: JSON.stringify(state), lastUpdated: new Date() })
    .onConflictDoUpdate({
      target: conversations.telegramId,
      set: { state: JSON.stringify(state), lastUpdated: new Date() }
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
    .where(
      and(
        eq(addressBook.telegramId, telegramId), 
        eq(addressBook.nickname, nickname)
      )
    ) // Corrected multi-where syntax
    .limit(1);
  return result[0]?.address || null;
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

// --- COIN PRICE CACHE FUNCTIONS ---

export async function getCachedPrice(coin: string, network: string): Promise<CoinPriceCache | undefined> {
  const result = await db.select().from(coinPriceCache)
    .where(and(
      eq(coinPriceCache.coin, coin),
      eq(coinPriceCache.network, network)
    ))
    .limit(1);
  
  const cached = result[0];
  if (!cached) return undefined;
  
  // Check if cache is still valid
  if (new Date(cached.expiresAt) < new Date()) {
    return undefined; // Expired
  }
  
  return cached;
}

export async function setCachedPrice(
  coin: string,
  network: string,
  name: string,
  usdPrice: string | undefined,
  btcPrice: string | undefined,
  available: boolean,
  ttlMinutes: number = 5
) {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  
  await db.insert(coinPriceCache)
    .values({
      coin,
      network,
      name,
      usdPrice: usdPrice || null,
      btcPrice: btcPrice || null,
      available: available ? 'true' : 'false',
      expiresAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [coinPriceCache.coin, coinPriceCache.network],
      set: {
        name,
        usdPrice: usdPrice || null,
        btcPrice: btcPrice || null,
        available: available ? 'true' : 'false',
        expiresAt,
        updatedAt: new Date(),
      }
    });
}

export async function getAllCachedPrices(): Promise<CoinPriceCache[]> {
  const now = new Date();
  return await db.select().from(coinPriceCache)
    .where(and(
      eq(coinPriceCache.available, 'true')
    ));
}

export async function clearExpiredPriceCache() {
  const now = new Date();
  await db.delete(coinPriceCache)
    .where(eq(coinPriceCache.expiresAt, now));
}

export async function clearAllCachedPrices() {
  await db.delete(coinPriceCache);
  console.log('[Database] Cleared all cached prices');
}

// --- USER SETTINGS FUNCTIONS ---

export async function getUserSettings(userId: string): Promise<UserSettings | undefined> {
  const result = await db.select().from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return result[0];
}

export async function createOrUpdateUserSettings(
  userId: string,
  settings: {
    walletAddress?: string;
    theme?: string;
    slippageTolerance?: number;
    notificationsEnabled?: boolean;
    defaultFromAsset?: string;
    defaultToAsset?: string;
    emailNotifications?: boolean;
    telegramNotifications?: boolean;
  }
) {
  await db.insert(userSettings)
    .values({
      userId,
      walletAddress: settings.walletAddress,
      theme: settings.theme,
      slippageTolerance: settings.slippageTolerance,
      notificationsEnabled: settings.notificationsEnabled ? 'true' : 'false',
      defaultFromAsset: settings.defaultFromAsset,
      defaultToAsset: settings.defaultToAsset,
      emailNotifications: settings.emailNotifications ? 'true' : 'false',
      telegramNotifications: settings.telegramNotifications ? 'true' : 'false',
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        walletAddress: settings.walletAddress,
        theme: settings.theme,
        slippageTolerance: settings.slippageTolerance,
        notificationsEnabled: settings.notificationsEnabled ? 'true' : 'false',
        defaultFromAsset: settings.defaultFromAsset,
        defaultToAsset: settings.defaultToAsset,
        emailNotifications: settings.emailNotifications ? 'true' : 'false',
        telegramNotifications: settings.telegramNotifications ? 'true' : 'false',
        updatedAt: new Date(),
      }
    });
}

// --- SWAP HISTORY FUNCTIONS ---

export async function createSwapHistoryEntry(
  userId: string,
  walletAddress: string | undefined,
  swapData: {
    sideshiftOrderId: string;
    quoteId?: string;
    fromAsset: string;
    fromNetwork: string;
    fromAmount: number;
    toAsset: string;
    toNetwork: string;
    settleAmount: string;
    depositAddress?: string;
    status?: string;
    txHash?: string;
  }
) {
  await db.insert(swapHistory).values({
    userId,
    walletAddress,
    ...swapData,
    status: swapData.status || 'pending',
    updatedAt: new Date(),
  });
}

export async function getSwapHistory(userId: string, limit: number = 50): Promise<SwapHistory[]> {
  return await db.select().from(swapHistory)
    .where(eq(swapHistory.userId, userId))
    .orderBy(desc(swapHistory.createdAt))
    .limit(limit);
}

export async function getSwapHistoryByWallet(walletAddress: string, limit: number = 50): Promise<SwapHistory[]> {
  return await db.select().from(swapHistory)
    .where(eq(swapHistory.walletAddress, walletAddress))
    .orderBy(desc(swapHistory.createdAt))
    .limit(limit);
}

export async function updateSwapHistoryStatus(sideshiftOrderId: string, status: string, txHash?: string) {
  await db.update(swapHistory)
    .set({ status, txHash, updatedAt: new Date() })
    .where(eq(swapHistory.sideshiftOrderId, sideshiftOrderId));
}

// --- CHAT HISTORY FUNCTIONS ---

export async function addChatMessage(
  userId: string,
  walletAddress: string | undefined,
  role: 'user' | 'assistant',
  content: string,
  sessionId?: string,
  metadata?: Record<string, any>
) {
  await db.insert(chatHistory).values({
    userId,
    walletAddress,
    role,
    content,
    sessionId,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

export async function getChatHistory(userId: string, sessionId?: string, limit: number = 50): Promise<ChatHistory[]> {
  if (sessionId) {
    return await db.select().from(chatHistory)
      .where(and(
        eq(chatHistory.userId, userId),
        eq(chatHistory.sessionId, sessionId)
      ))
      .orderBy(desc(chatHistory.createdAt))
      .limit(limit);
  }
  
  return await db.select().from(chatHistory)
    .where(eq(chatHistory.userId, userId))
    .orderBy(desc(chatHistory.createdAt))
    .limit(limit);
}

export async function clearChatHistory(userId: string, sessionId?: string) {
  if (sessionId) {
    await db.delete(chatHistory)
      .where(and(
        eq(chatHistory.userId, userId),
        eq(chatHistory.sessionId, sessionId)
      ));
  } else {
    await db.delete(chatHistory)
      .where(eq(chatHistory.userId, userId));
  }
}
