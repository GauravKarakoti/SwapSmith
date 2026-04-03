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
}, (table) => [
  index("idx_conversations_telegram_id").on(table.telegramId),
]);


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
  index("idx_orders_telegram_id").on(table.telegramId),
]);



export const checkouts = pgTable('checkouts', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  checkoutId: text('checkout_id').notNull().unique(),
  settleAsset: text('settle_asset').notNull(),
  settleNetwork: text('settle_network').notNull(),
  settleAmount: numeric('settle_amount', { precision: 30, scale: 18 }).notNull(),
  settleAddress: text('settle_address').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_checkouts_telegram_id").on(table.telegramId),
  index("idx_checkouts_status").on(table.status),
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
  conditionValue: numeric('condition_value', { precision: 30, scale: 18 }),
  conditionAsset: text('condition_asset'),
  status: text('status').notNull().default('pending'),
  settleAddress: text('settle_address'),
  sideshiftOrderId: text('sideshift_order_id'),
  error: text('error'),
  executedAt: timestamp('executed_at'),
  retryCount: integer('retry_count').notNull().default(0),
  retryAfter: timestamp('retry_after'),
}, (table) => [
  index("idx_limit_orders_telegram_id").on(table.telegramId),
  index("idx_limit_orders_status").on(table.status),
  index("idx_limit_orders_is_active").on(table.isActive),
]);

export const trailingStopOrders = pgTable('trailing_stop_orders', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  fromAsset: text('from_asset').notNull(),
  fromNetwork: text('from_network'),
  toAsset: text('to_asset').notNull(),
  toNetwork: text('to_network'),
  fromAmount: text('from_amount').notNull(),
  settleAddress: text('settle_address'),
  trailingPercentage: numeric('trailing_percentage', { precision: 10, scale: 4 }).notNull(),
  peakPrice: text('peak_price'),
  currentPrice: text('current_price'),
  triggerPrice: text('trigger_price'),
  status: text('status').notNull().default('pending'),
  isActive: boolean('is_active').notNull().default(true),
  triggeredAt: timestamp('triggered_at'),
  lastCheckedAt: timestamp('last_checked_at'),
  sideshiftOrderId: text('sideshift_order_id'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_trailing_stop_orders_telegram_id").on(table.telegramId),
  index("idx_trailing_stop_orders_status").on(table.status),
  index("idx_trailing_stop_orders_is_active").on(table.isActive),
]);

// --- SHARED SCHEMAS (used by both bot and frontend) --- (Financial precision updated)

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
  slippageTolerance: numeric('slippage_tolerance', { precision: 10, scale: 4 }),
  notificationsEnabled: text('notifications_enabled'),
  preferences: text('preferences'),
  emailNotifications: text('email_notifications'),
  telegramNotifications: text('telegram_notifications'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_user_settings_user_id").on(table.userId),
]);

export const portfolioTargets = pgTable('portfolio_targets', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  telegramId: bigint('telegram_id', { mode: 'number' }),
  name: text('name').notNull().default('My Portfolio!!'),
  assets: jsonb('assets').notNull(),
  driftThreshold: numeric('drift_threshold', { precision: 10, scale: 4 }).notNull().default('5'),
  autoRebalance: boolean('auto_rebalance').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  lastRebalancedAt: timestamp('last_rebalanced_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(), // Added updatedAt column
}, (table) => [
  index("idx_portfolio_targets_user_id").on(table.userId),
  index("idx_portfolio_targets_is_active").on(table.isActive),
]);

export const rebalanceHistory = pgTable('rebalance_history', {
  id: serial('id').primaryKey(),
  portfolioTargetId: integer('portfolio_target_id').notNull(),
  userId: text('user_id').notNull(),
  telegramId: bigint('telegram_id', { mode: 'number' }),
  triggerType: text('trigger_type').notNull(),
  totalPortfolioValue: text('total_portfolio_value').notNull(),
  swapsExecuted: jsonb('swaps_executed').notNull(),
  totalFees: text('total_fees').notNull(),
  status: text('status').notNull().default('pending'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(), // Added createdAt column
}, (table) => [
  index("idx_rebalance_history_user_id").on(table.userId),
  index("idx_rebalance_history_target_id").on(table.portfolioTargetId),
  index("idx_rebalance_history_status").on(table.status),
]);

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
  index("idx_price_alerts_triggered_at").on(table.triggeredAt),
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
  fromAmount: numeric('from_amount', { precision: 30, scale: 18 }).notNull(),
  toAsset: text('to_asset').notNull(),
  toNetwork: text('to_network').notNull(),
  settleAmount: text('settle_amount').notNull(),
  depositAddress: text('deposit_address'),
  status: text('status').notNull().default('pending'),
  txHash: text('tx_hash'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at'),
}, (table) => [
  index("idx_swap_history_user_id").on(table.userId),
  index("idx_swap_history_status").on(table.status),
]);

export const chatHistory = pgTable('chat_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  walletAddress: text('wallet_address'),
  role: text('role').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata'),
  sessionId: text('session_id'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_chat_history_user_id").on(table.userId),
  index("idx_chat_history_session_id").on(table.sessionId),
]);

export const discussions = pgTable('discussions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  content: text('content').notNull(),
  category: text('category').default('general'),
  likes: text('likes').default('0'),
  replies: text('replies').default('0'),
  isHidden: boolean('is_hidden').default(false).notNull(),
  moderationReason: text('moderation_reason'),
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
  userIdIdx: index("idx_course_progress_user_id").on(table.userId),
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
}, (table) => [
  index("idx_rewards_log_user_id").on(table.userId),
  index("idx_rewards_log_mint_status").on(table.mintStatus),
]);

// --- GAS FEE OPTIMIZATION SCHEMAS ---

export const gasEstimates = pgTable('gas_estimates', {
  id: serial('id').primaryKey(),
  chain: text('chain').notNull(),
  network: text('network').notNull(),
  gasPrice: text('gas_price').notNull(), // in wei or gwei
  gasPriceUnit: text('gas_price_unit').notNull().default('gwei'),
  priorityFee: text('priority_fee'), // for EIP-1559 chains
  baseFee: text('base_fee'), // for EIP-1559 chains
  estimatedTimeSeconds: integer('estimated_time_seconds'), // estimated confirmation time
  confidence: numeric('confidence', { precision: 5, scale: 2 }), // confidence score 0-100
  source: text('source').notNull(), // 'ethgasstation', 'gelato', 'provider', etc.
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_gas_estimates_chain_network").on(table.chain, table.network),
  index("idx_gas_estimates_expires").on(table.expiresAt),
]);

export const gasTokens = pgTable('gas_tokens', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().unique(),
  name: text('name').notNull(),
  contractAddress: text('contract_address').notNull(),
  chain: text('chain').notNull(),
  network: text('network').notNull(),
  decimals: integer('decimals').notNull().default(18),
  tokenType: text('token_type').notNull(), // 'chi', 'gst', 'custom'
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).notNull().default('0'), // discount % when using this token
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata'), // additional token metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("idx_gas_tokens_symbol").on(table.symbol),
  index("idx_gas_tokens_chain_network").on(table.chain, table.network),
  index("idx_gas_tokens_is_active").on(table.isActive),
]);

export const userGasPreferences = pgTable('user_gas_preferences', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  preferredGasToken: text('preferred_gas_token').references(() => gasTokens.symbol),
  autoOptimize: boolean('auto_optimize').notNull().default(true),
  maxGasPrice: text('max_gas_price'), // max gas price user is willing to pay
  priorityLevel: text('priority_level').notNull().default('medium'), // 'low', 'medium', 'high'
  batchTransactions: boolean('batch_transactions').notNull().default(false),
  notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
  customSettings: jsonb('custom_settings'), // additional user-specific settings
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_user_gas_preferences_user_id").on(table.userId),
]);

export const batchedTransactions = pgTable('batched_transactions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  batchId: text('batch_id').notNull().unique(),
  transactions: jsonb('transactions').notNull(), // array of transactions to batch
  status: text('status').notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  targetGasPrice: text('target_gas_price'), // execute when gas price drops to this level
  maxExecutionTime: timestamp('max_execution_time'), // deadline for execution
  executedAt: timestamp('executed_at'),
  executionTxHash: text('execution_tx_hash'),
  gasSaved: text('gas_saved'), // amount of gas saved by batching
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("idx_batched_transactions_user_id").on(table.userId),
  index("idx_batched_transactions_status").on(table.status),
  index("idx_batched_transactions_batch_id").on(table.batchId),
]);

export const gasOptimizationHistory = pgTable('gas_optimization_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  swapId: text('swap_id').references(() => swapHistory.sideshiftOrderId),
  originalGasEstimate: text('original_gas_estimate').notNull(),
  optimizedGasEstimate: text('optimized_gas_estimate').notNull(),
  gasTokenUsed: text('gas_token_used').references(() => gasTokens.symbol),
  gasSaved: text('gas_saved').notNull(),
  savingsPercent: numeric('savings_percent', { precision: 10, scale: 4 }).notNull(),
  optimizationType: text('optimization_type').notNull(), // 'token_discount', 'batching', 'timing', 'combined'
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_gas_optimization_history_user_id").on(table.userId),
  index("idx_gas_optimization_history_swap_id").on(table.swapId),
]);

// --- TRADING STRATEGY MARKETPLACE SCHEMAS ---

export const strategyRiskLevel = pgEnum('strategy_risk_level', ['low', 'medium', 'high', 'aggressive']);
export const strategyStatus = pgEnum('strategy_status', ['active', 'paused', 'archived']);
export const subscriptionStatus = pgEnum('subscription_status', ['active', 'paused', 'cancelled']);
export const tradeStatusType = pgEnum('trade_status', ['pending', 'completed', 'failed']);
export const performanceStatusType = pgEnum('performance_status', ['pending', 'completed', 'failed']);

export const tradingStrategies = pgTable('trading_strategies', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  creatorTelegramId: bigint('creator_telegram_id', { mode: 'number' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  parameters: jsonb('parameters').notNull(),
  riskLevel: strategyRiskLevel('risk_level').notNull().default('medium'),
  subscriptionFee: text('subscription_fee').notNull().default('0'),
  performanceFee: numeric('performance_fee', { precision: 10, scale: 4 }).notNull().default('0'),
  minInvestment: text('min_investment').notNull().default('0'),
  isPublic: boolean('is_public').notNull().default(true),
  tags: text('tags').array(),
  status: strategyStatus('status').notNull().default('active'),
  totalReturn: numeric('total_return', { precision: 15, scale: 8 }).notNull().default('0'),
  monthlyReturn: numeric('monthly_return', { precision: 15, scale: 8 }).notNull().default('0'),
  maxDrawdown: numeric('max_drawdown', { precision: 15, scale: 8 }).notNull().default('0'),
  volatility: numeric('volatility', { precision: 15, scale: 8 }).notNull().default('0'),
  sharpeRatio: numeric('sharpe_ratio', { precision: 15, scale: 8 }).notNull().default('0'),
  subscriberCount: integer('subscriber_count').notNull().default(0),
  totalTrades: integer('total_trades').notNull().default(0),
  successfulTrades: integer('successful_trades').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("idx_trading_strategies_creator_id").on(table.creatorId),
  index("idx_trading_strategies_status").on(table.status),
  index("idx_trading_strategies_is_public").on(table.isPublic),
]);

// --- TYPES ---

// Strategy types commented out until tables are implemented
// export type TradingStrategy = typeof tradingStrategies.$inferSelect;
// export type NewTradingStrategy = typeof tradingStrategies.$inferInsert;
// export type StrategySubscription = typeof strategySubscriptions.$inferSelect;
// export type NewStrategySubscription = typeof strategySubscriptions.$inferInsert;
// export type StrategyTrade = typeof strategyTrades.$inferSelect;
// export type NewStrategyTrade = typeof strategyTrades.$inferInsert;
// export type StrategyPerformance = typeof strategyPerformance.$inferSelect;
// export type NewStrategyPerformance = typeof strategyPerformance.$inferInsert;

// --- RELATIONS ---


export const courseProgressRelations = relations(courseProgress, ({ one }) => ({
  user: one(users, {
    fields: [courseProgress.userId],
    references: [users.id]
  }),
}));

export const usersRelations = relations(users, ({many}) => ({
	courseProgresses: many(courseProgress),
	rewardsLogs: many(rewardsLog),
	// Strategy relations commented out until tables are implemented
	// createdStrategies: many(tradingStrategies),
	// subscriptions: many(strategySubscriptions),
}));

export const rewardsLogRelations = relations(rewardsLog, ({ one }) => ({
  user: one(users, {
    fields: [rewardsLog.userId],
    references: [users.id]
  }),
}));

// --- TRADING STRATEGY RELATIONS ---
// All strategy relations commented out until tables are implemented

/*
export const tradingStrategiesRelations = relations(tradingStrategies, ({ one, many }) => ({
  creator: one(users, {
    fields: [tradingStrategies.creatorId],
    references: [users.id],
  }),
  subscriptions: many(strategySubscriptions),
  trades: many(strategyTrades),
  performance: many(strategyPerformance),
}));

export const strategySubscriptionsRelations = relations(strategySubscriptions, ({ one }) => ({
  strategy: one(tradingStrategies, {
    fields: [strategySubscriptions.strategyId],
    references: [tradingStrategies.id],
  }),
  subscriber: one(users, {
    fields: [strategySubscriptions.subscriberId],
    references: [users.id],
  }),
}));

export const strategyTradesRelations = relations(strategyTrades, ({ one }) => ({
  strategy: one(tradingStrategies, {
    fields: [strategyTrades.strategyId],
    references: [tradingStrategies.id],
  }),
}));

export const strategyPerformanceRelations = relations(strategyPerformance, ({ one }) => ({
  strategy: one(tradingStrategies, {
    fields: [strategyPerformance.strategyId],
    references: [tradingStrategies.id],
  }),
}));
*/

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

export const planPurchasesRelations = relations(planPurchases, ({ one }) => ({
  user: one(users, {
    fields: [planPurchases.userId],
    references: [users.id],
  }),
}));

// --- ADMIN SCHEMAS ---

export const adminRoleType = pgEnum('admin_role', ['super_admin', 'admin', 'moderator']);
export const adminRequestStatus = pgEnum('admin_request_status', ['pending', 'approved', 'rejected']);

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: adminRoleType('role').notNull().default('admin'),
  isActive: boolean('is_active').notNull().default(true),
  approvedAt: timestamp('approved_at'),
  approvedBy: text('approved_by'), // email of approver
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_admin_users_email').on(table.email),
  index('idx_admin_users_firebase_uid').on(table.firebaseUid),
]);

export const adminRequests = pgTable('admin_requests', {
  id: serial('id').primaryKey(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  reason: text('reason').notNull(),
  status: adminRequestStatus('status').notNull().default('pending'),
  approvalToken: text('approval_token').notNull().unique(),
  rejectionReason: text('rejection_reason'),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: text('reviewed_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_admin_requests_email').on(table.email),
  index('idx_admin_requests_status').on(table.status),
  index('idx_admin_requests_token').on(table.approvalToken),
  index('idx_admin_requests_created_at').on(table.createdAt),
]);

export type AdminUser = typeof adminUsers.$inferSelect;
export type AdminRequest = typeof adminRequests.$inferSelect;

// --- TESTNET COIN GIFT LOGS ---

export const coinGiftActionType = pgEnum('coin_gift_action_type', ['gift', 'deduct', 'reset']);

export const coinGiftLogs = pgTable('coin_gift_logs', {
  id: serial('id').primaryKey(),
  adminId: text('admin_id').notNull(),
  adminEmail: text('admin_email').notNull(),
  targetUserId: integer('target_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  walletAddress: text('wallet_address'),
  action: coinGiftActionType('action').notNull(),
  amount: text('amount').notNull(),
  balanceBefore: text('balance_before').notNull(),
  balanceAfter: text('balance_after').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_coin_gift_logs_target_user").on(table.targetUserId),
  index("idx_coin_gift_logs_created_at").on(table.createdAt),
]);

export const coinGiftLogsRelations = relations(coinGiftLogs, ({ one }) => ({
  user: one(users, { fields: [coinGiftLogs.targetUserId], references: [users.id] }),
}));

export type CoinGiftLog = typeof coinGiftLogs.$inferSelect;

// --- ADMIN AUDIT LOG ---

export const adminAuditLog = pgTable('admin_audit_log', {
  id: serial('id').primaryKey(),
  adminId: text('admin_id').notNull(),          // admin firebaseUid
  adminEmail: text('admin_email').notNull(),
  action: text('action').notNull(),              // e.g., 'approve_admin_request', 'suspend_user', 'update_config'
  targetResource: text('target_resource'),       // e.g., 'user', 'admin_request', 'swap', 'config'
  targetId: text('target_id'),                   // ID of the affected resource
  metadata: jsonb('metadata'),                   // JSONB field for action-specific context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_admin_audit_log_admin').on(table.adminId),
  index('idx_admin_audit_log_action').on(table.action),
  index('idx_admin_audit_log_created_at').on(table.createdAt),
  index('idx_admin_audit_log_target').on(table.targetResource, table.targetId),
]);

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export const strategySubscriptions = pgTable('strategy_subscriptions', {
  id: serial('id').primaryKey(),
  strategyId: integer('strategy_id').notNull().references(() => tradingStrategies.id, { onDelete: 'cascade' }),
  subscriberId: integer('subscriber_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriberTelegramId: bigint('subscriber_telegram_id', { mode: 'number' }),
  // Subscription details
  subscriptionFee: numeric('subscription_fee', { precision: 20, scale: 8 }).notNull().default('0'),
  // Copy trading settings
  allocationPercent: real('allocation_percent').notNull().default(100), // % of strategy trades to copy
  autoRebalance: boolean('auto_rebalance').notNull().default(true),
  stopLossPercent: real('stop_loss_percent'), // Optional stop loss
  // Status
  status: subscriptionStatus('status').notNull().default('active'),
  // Performance tracking
  totalPnL: numeric('total_pnl', { precision: 20, scale: 8 }).notNull().default('0'), // Total profit/loss
  joinedAt: timestamp('joined_at').defaultNow(),
  lastSyncedAt: timestamp('last_synced_at'),
  pausedAt: timestamp('paused_at'),
  cancelledAt: timestamp('cancelled_at'),
}, (table) => [
  index("idx_strategy_subscriptions_strategy_id").on(table.strategyId),
  index("idx_strategy_subscriptions_subscriber_id").on(table.subscriberId),
  index("idx_strategy_subscriptions_status").on(table.status),
  {
    unique: unique('strategy_subscriber_unique').on(table.strategyId, table.subscriberId),
  },
]);

export const strategyPerformance = pgTable('strategy_performance', {
  id: serial('id').primaryKey(),
  strategyId: integer('strategy_id').notNull().references(() => tradingStrategies.id, { onDelete: 'cascade' }),
  // Trade details
  tradeId: text('trade_id'), // Reference to the executed trade
  fromAsset: text('from_asset'),
  toAsset: text('to_asset'),
  fromAmount: numeric('from_amount', { precision: 20, scale: 8 }),
  toAmount: numeric('to_amount', { precision: 20, scale: 8 }),
  // Performance metrics for this trade
  pnl: numeric('pnl', { precision: 20, scale: 8 }).notNull().default('0'), // Profit/loss in USD
  pnlPercent: real('pnl_percent').notNull().default(0),
  fees: numeric('fees', { precision: 20, scale: 8 }).notNull().default('0'),
  // Status
  status: text('status').notNull().default('pending'), // 'pending', 'completed', 'failed'
  // Timestamp
  executedAt: timestamp('executed_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_strategy_performance_strategy_id").on(table.strategyId),
  index("idx_strategy_performance_executed_at").on(table.executedAt),
]);

export const strategyTrades = pgTable('strategy_trades', {
  id: serial('id').primaryKey(),
  strategyId: integer('strategy_id').notNull().references(() => tradingStrategies.id, { onDelete: 'cascade' }),
  // Trade signal
  signal: text('signal').notNull(), // 'buy', 'sell', 'rebalance'
  fromAsset: text('from_asset').notNull(),
  toAsset: text('to_asset').notNull(),
  fromNetwork: text('from_network').notNull(),
  toNetwork: text('to_network').notNull(),
  amount: numeric('amount', { precision: 20, scale: 8 }).notNull(),
  // Execution
  executedAt: timestamp('executed_at'),
  sideshiftOrderId: text('sideshift_order_id'),
  status: text('status').notNull().default('pending'),
  // Result
  settleAmount: numeric('settle_amount', { precision: 20, scale: 8 }),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("idx_strategy_trades_strategy_id").on(table.strategyId),
  index("idx_strategy_trades_executed_at").on(table.executedAt),
  index("idx_strategy_trades_status").on(table.status),
]);

// --- RELATIONS ---

export const tradingStrategiesRelations = relations(tradingStrategies, ({many}) => ({
  subscriptions: many(strategySubscriptions),
  performance: many(strategyPerformance),
  trades: many(strategyTrades),
}));

export const strategySubscriptionsRelations = relations(strategySubscriptions, ({one}) => ({
  strategy: one(tradingStrategies, {
    fields: [strategySubscriptions.strategyId],
    references: [tradingStrategies.id],
  }),
  subscriber: one(users, {
    fields: [strategySubscriptions.subscriberId],
    references: [users.id],
  }),
}));

export const strategyPerformanceRelations = relations(strategyPerformance, ({one}) => ({
  strategy: one(tradingStrategies, {
    fields: [strategyPerformance.strategyId],
    references: [tradingStrategies.id],
  }),
}));

export const strategyTradesRelations = relations(strategyTrades, ({one}) => ({
  strategy: one(tradingStrategies, {
    fields: [strategyTrades.strategyId],
    references: [tradingStrategies.id],
  }),
}));

// --- TYPES ---

export type TradingStrategy = typeof tradingStrategies.$inferSelect;
export type NewTradingStrategy = typeof tradingStrategies.$inferInsert;
export type StrategySubscription = typeof strategySubscriptions.$inferSelect;
export type NewStrategySubscription = typeof strategySubscriptions.$inferInsert;
export type StrategyPerformance = typeof strategyPerformance.$inferSelect;
export type NewStrategyPerformance = typeof strategyPerformance.$inferInsert;
export type StrategyTrade = typeof strategyTrades.$inferSelect;
export type NewStrategyTrade = typeof strategyTrades.$inferInsert;

export const pageVisits = pgTable('page_visits', {
  id: serial('id').primaryKey(),
  page: text('page').notNull(),
  userId: text('user_id'),
  sessionId: text('session_id'),
  userAgent: text('user_agent'),
  referer: text('referer'),
  visitedAt: timestamp('visited_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_page_visits_user_id").on(table.userId),
  index("idx_page_visits_visited_at").on(table.visitedAt),
]);

export const groqUsageLogs = pgTable('groq_usage_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id'),
  model: text('model').notNull(),
  endpoint: text('endpoint').notNull().default('chat'),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_groq_usage_user_id").on(table.userId),
  index("idx_groq_usage_created_at").on(table.createdAt),
]);