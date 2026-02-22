import { pgTable, serial, text, bigint, timestamp, integer, real, unique, pgEnum, uuid, boolean, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// --- ENUMS ---
export const planType = pgEnum('plan_type', ['free', 'premium', 'pro']);

export const rewardActionType = pgEnum('reward_action_type', [
  'course_complete',
  'module_complete',
  'daily_login',
  'swap_complete',
  'referral',
  'wallet_connected',
  'terminal_used',
  'notification_enabled'
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
  // Plan & subscription fields
  plan: planType('plan').notNull().default('free'),
  planPurchasedAt: timestamp('plan_purchased_at'),
  planExpiresAt: timestamp('plan_expires_at'),
  // Daily usage counters
  dailyChatCount: integer('daily_chat_count').notNull().default(0),
  dailyTerminalCount: integer('daily_terminal_count').notNull().default(0),
  usageResetAt: timestamp('usage_reset_at').defaultNow(),
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
  index('orders_status_idx').on(table.status),
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
}, (table) => [
  index("idx_checkouts_telegram_id").on(table.telegramId),
]);

export const addressBook = pgTable('address_book', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  label: text('label').notNull(),
  address: text('address').notNull(),
  chain: text('chain').notNull(),
}, (table) => [
  index("idx_address_book_telegram_id").on(table.telegramId),
]);

export const watchedOrders = pgTable('watched_orders', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  sideshiftOrderId: text('sideshift_order_id').notNull().unique(),
  lastStatus: text('last_status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_watched_orders_telegram_id").on(table.telegramId),
]);

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
}, (table) => [
  index("idx_dca_schedules_telegram_id").on(table.telegramId),
]);

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
  conditionOperator: text('condition_operator'), // 'gt' or 'lt'
  conditionValue: real('condition_value'),
  conditionAsset: text('condition_asset'),
  status: text('status').notNull().default('pending'),
  sideshiftOrderId: text('sideshift_order_id'),
  error: text('error'),
  executedAt: timestamp('executed_at'),
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

// --- WATCHLIST SCHEMA ---

export const watchlist = pgTable('watchlist', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  coin: text('coin').notNull(),
  network: text('network').notNull(),
  name: text('name').notNull(),
  addedAt: timestamp('added_at').defaultNow(),
}, (table) => [
  index("idx_watchlist_user_id").on(table.userId),
  index("idx_watchlist_user_coin_network").on(table.userId, table.coin, table.network),
]);

// --- PRICE ALERTS SCHEMA ---

export const priceAlerts = pgTable('price_alerts', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  telegramId: bigint('telegram_id', { mode: 'number' }),
  coin: text('coin').notNull(),
  network: text('network').notNull(),
  name: text('name').notNull(),
  targetPrice: numeric('target_price', { precision: 20, scale: 8 }).notNull(),
  condition: text('condition').notNull(), // 'gt' (greater than) or 'lt' (less than)
  isActive: boolean('is_active').notNull().default(true),
  triggeredAt: timestamp('triggered_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_price_alerts_user_id").on(table.userId),
  index("idx_price_alerts_telegram_id").on(table.telegramId),
  index("idx_price_alerts_is_active").on(table.isActive),
  index("idx_price_alerts_coin_network").on(table.coin, table.network),
]);

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

// --- PLAN PURCHASES TABLE ---

export const planPurchases = pgTable('plan_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  plan: planType('plan').notNull(),
  coinsSpent: integer('coins_spent').notNull(),
  durationDays: integer('duration_days').notNull(),
  activatedAt: timestamp('activated_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index("idx_plan_purchases_user_id").on(table.userId),
]);

export const planPurchasesRelations = relations(planPurchases, ({one}) => ({
  user: one(users, {
    fields: [planPurchases.userId],
    references: [users.id],
  }),
}));

