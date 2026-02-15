import { pgTable, serial, text, bigint, timestamp, integer, real, unique } from 'drizzle-orm/pg-core';

// --- BOT SCHEMAS ---

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
  targetPrice: text('target_price').notNull(),
  currentPrice: text('current_price'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
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
});
