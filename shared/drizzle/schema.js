"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewardsLog = exports.courseProgress = exports.discussions = exports.dcaSchedules = exports.users = exports.userSettings = exports.watchedOrders = exports.swapHistory = exports.orders = exports.conversations = exports.coinPriceCache = exports.checkouts = exports.chatHistory = exports.addressBook = exports.rewardActionType = exports.mintStatusType = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.mintStatusType = (0, pg_core_1.pgEnum)("mint_status_type", ['pending', 'processing', 'minted', 'failed']);
exports.rewardActionType = (0, pg_core_1.pgEnum)("reward_action_type", ['course_complete', 'module_complete', 'daily_login', 'swap_complete', 'referral']);
exports.addressBook = (0, pg_core_1.pgTable)("address_book", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    telegramId: (0, pg_core_1.bigint)("telegram_id", { mode: "number" }).notNull(),
    nickname: (0, pg_core_1.text)().notNull(),
    address: (0, pg_core_1.text)().notNull(),
    chain: (0, pg_core_1.text)().notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
});
exports.chatHistory = (0, pg_core_1.pgTable)("chat_history", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    userId: (0, pg_core_1.text)("user_id").notNull(),
    walletAddress: (0, pg_core_1.text)("wallet_address"),
    role: (0, pg_core_1.text)().notNull(),
    content: (0, pg_core_1.text)().notNull(),
    metadata: (0, pg_core_1.text)(),
    sessionId: (0, pg_core_1.text)("session_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
});
exports.checkouts = (0, pg_core_1.pgTable)("checkouts", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    telegramId: (0, pg_core_1.bigint)("telegram_id", { mode: "number" }).notNull(),
    checkoutId: (0, pg_core_1.text)("checkout_id").notNull(),
    settleAsset: (0, pg_core_1.text)("settle_asset").notNull(),
    settleNetwork: (0, pg_core_1.text)("settle_network").notNull(),
    settleAmount: (0, pg_core_1.real)("settle_amount").notNull(),
    settleAddress: (0, pg_core_1.text)("settle_address").notNull(),
    status: (0, pg_core_1.text)().default('pending').notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
    (0, pg_core_1.unique)("checkouts_checkout_id_unique").on(table.checkoutId),
]);
exports.coinPriceCache = (0, pg_core_1.pgTable)("coin_price_cache", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    coin: (0, pg_core_1.text)().notNull(),
    network: (0, pg_core_1.text)().notNull(),
    name: (0, pg_core_1.text)().notNull(),
    usdPrice: (0, pg_core_1.text)("usd_price"),
    btcPrice: (0, pg_core_1.text)("btc_price"),
    available: (0, pg_core_1.text)().default('true').notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { mode: 'string' }).notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).defaultNow().notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
});
exports.conversations = (0, pg_core_1.pgTable)("conversations", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    telegramId: (0, pg_core_1.bigint)("telegram_id", { mode: "number" }).notNull(),
    state: (0, pg_core_1.text)(),
    lastUpdated: (0, pg_core_1.timestamp)("last_updated", { mode: 'string' }).defaultNow(),
}, (table) => [
    (0, pg_core_1.unique)("conversations_telegram_id_unique").on(table.telegramId),
]);
exports.orders = (0, pg_core_1.pgTable)("orders", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    telegramId: (0, pg_core_1.bigint)("telegram_id", { mode: "number" }).notNull(),
    sideshiftOrderId: (0, pg_core_1.text)("sideshift_order_id").notNull(),
    quoteId: (0, pg_core_1.text)("quote_id").notNull(),
    fromAsset: (0, pg_core_1.text)("from_asset").notNull(),
    fromNetwork: (0, pg_core_1.text)("from_network").notNull(),
    fromAmount: (0, pg_core_1.real)("from_amount").notNull(),
    toAsset: (0, pg_core_1.text)("to_asset").notNull(),
    toNetwork: (0, pg_core_1.text)("to_network").notNull(),
    settleAmount: (0, pg_core_1.text)("settle_amount").notNull(),
    depositAddress: (0, pg_core_1.text)("deposit_address").notNull(),
    depositMemo: (0, pg_core_1.text)("deposit_memo"),
    status: (0, pg_core_1.text)().default('pending').notNull(),
    txHash: (0, pg_core_1.text)("tx_hash"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
    (0, pg_core_1.unique)("orders_sideshift_order_id_unique").on(table.sideshiftOrderId),
]);
exports.swapHistory = (0, pg_core_1.pgTable)("swap_history", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    userId: (0, pg_core_1.text)("user_id").notNull(),
    walletAddress: (0, pg_core_1.text)("wallet_address"),
    sideshiftOrderId: (0, pg_core_1.text)("sideshift_order_id").notNull(),
    quoteId: (0, pg_core_1.text)("quote_id"),
    fromAsset: (0, pg_core_1.text)("from_asset").notNull(),
    fromNetwork: (0, pg_core_1.text)("from_network").notNull(),
    fromAmount: (0, pg_core_1.real)("from_amount").notNull(),
    toAsset: (0, pg_core_1.text)("to_asset").notNull(),
    toNetwork: (0, pg_core_1.text)("to_network").notNull(),
    settleAmount: (0, pg_core_1.text)("settle_amount").notNull(),
    depositAddress: (0, pg_core_1.text)("deposit_address"),
    status: (0, pg_core_1.text)().default('pending').notNull(),
    txHash: (0, pg_core_1.text)("tx_hash"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).defaultNow(),
});
exports.watchedOrders = (0, pg_core_1.pgTable)("watched_orders", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    telegramId: (0, pg_core_1.bigint)("telegram_id", { mode: "number" }).notNull(),
    sideshiftOrderId: (0, pg_core_1.text)("sideshift_order_id").notNull(),
    lastStatus: (0, pg_core_1.text)("last_status").default('pending').notNull(),
    lastChecked: (0, pg_core_1.timestamp)("last_checked", { mode: 'string' }).defaultNow(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
    (0, pg_core_1.unique)("watched_orders_sideshift_order_id_unique").on(table.sideshiftOrderId),
]);
exports.userSettings = (0, pg_core_1.pgTable)("user_settings", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    userId: (0, pg_core_1.text)("user_id").notNull(),
    walletAddress: (0, pg_core_1.text)("wallet_address"),
    theme: (0, pg_core_1.text)().default('dark'),
    slippageTolerance: (0, pg_core_1.real)("slippage_tolerance").default(0.5),
    notificationsEnabled: (0, pg_core_1.text)("notifications_enabled").default('true'),
    defaultFromAsset: (0, pg_core_1.text)("default_from_asset"),
    defaultToAsset: (0, pg_core_1.text)("default_to_asset"),
    emailNotifications: (0, pg_core_1.text)("email_notifications"),
    telegramNotifications: (0, pg_core_1.text)("telegram_notifications").default('false'),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).defaultNow().notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
    preferences: (0, pg_core_1.text)(),
}, (table) => [
    (0, pg_core_1.unique)("user_settings_user_id_unique").on(table.userId),
]);
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    telegramId: (0, pg_core_1.bigint)("telegram_id", { mode: "number" }).notNull(),
    walletAddress: (0, pg_core_1.text)("wallet_address"),
    sessionTopic: (0, pg_core_1.text)("session_topic"),
    totalPoints: (0, pg_core_1.integer)("total_points").default(0).notNull(),
    totalTokensClaimed: (0, pg_core_1.numeric)("total_tokens_claimed", { precision: 20, scale: 8 }).default('0').notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
    (0, pg_core_1.unique)("users_telegram_id_unique").on(table.telegramId),
    (0, pg_core_1.unique)("users_wallet_address_unique").on(table.walletAddress),
]);
exports.dcaSchedules = (0, pg_core_1.pgTable)("dca_schedules", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    telegramId: (0, pg_core_1.bigint)("telegram_id", { mode: "number" }).notNull(),
    fromAsset: (0, pg_core_1.text)("from_asset").notNull(),
    fromChain: (0, pg_core_1.text)("from_chain").notNull(),
    toAsset: (0, pg_core_1.text)("to_asset").notNull(),
    toChain: (0, pg_core_1.text)("to_chain").notNull(),
    amount: (0, pg_core_1.real)().notNull(),
    frequency: (0, pg_core_1.text)().notNull(),
    dayOfWeek: (0, pg_core_1.text)("day_of_week"),
    dayOfMonth: (0, pg_core_1.text)("day_of_month"),
    settleAddress: (0, pg_core_1.text)("settle_address").notNull(),
    isActive: (0, pg_core_1.text)("is_active").default('true').notNull(),
    lastExecuted: (0, pg_core_1.timestamp)("last_executed", { mode: 'string' }),
    nextExecution: (0, pg_core_1.timestamp)("next_execution", { mode: 'string' }).notNull(),
    executionCount: (0, pg_core_1.integer)("execution_count").default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
});
exports.discussions = (0, pg_core_1.pgTable)("discussions", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    userId: (0, pg_core_1.text)("user_id").notNull(),
    username: (0, pg_core_1.text)().notNull(),
    content: (0, pg_core_1.text)().notNull(),
    category: (0, pg_core_1.text)().default('general'),
    likes: (0, pg_core_1.text)().default('0'),
    replies: (0, pg_core_1.text)().default('0'),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
    (0, pg_core_1.index)("idx_discussions_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
    (0, pg_core_1.index)("idx_discussions_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamp_ops")),
    (0, pg_core_1.index)("idx_discussions_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);
exports.courseProgress = (0, pg_core_1.pgTable)("course_progress", {
    id: (0, pg_core_1.uuid)().defaultRandom().primaryKey().notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    courseId: (0, pg_core_1.text)("course_id").notNull(),
    courseTitle: (0, pg_core_1.text)("course_title").notNull(),
    completedModules: (0, pg_core_1.text)("completed_modules").array().default(["RAY"]).notNull(),
    totalModules: (0, pg_core_1.integer)("total_modules").notNull(),
    completionPercentage: (0, pg_core_1.integer)("completion_percentage").default(0).notNull(),
    bonusAwarded: (0, pg_core_1.boolean)("bonus_awarded").default(false).notNull(),
    isCompleted: (0, pg_core_1.boolean)("is_completed").default(false).notNull(),
    completionDate: (0, pg_core_1.timestamp)("completion_date", { mode: 'string' }),
    lastAccessed: (0, pg_core_1.timestamp)("last_accessed", { mode: 'string' }).defaultNow().notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("idx_course_progress_course_id").using("btree", table.courseId.asc().nullsLast().op("text_ops")),
    (0, pg_core_1.index)("idx_course_progress_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
    (0, pg_core_1.foreignKey)({
        columns: [table.userId],
        foreignColumns: [exports.users.id],
        name: "course_progress_user_id_users_id_fk"
    }).onDelete("cascade"),
    (0, pg_core_1.unique)("course_progress_user_course_unique").on(table.userId, table.courseId),
]);
exports.rewardsLog = (0, pg_core_1.pgTable)("rewards_log", {
    id: (0, pg_core_1.uuid)().defaultRandom().primaryKey().notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    actionType: (0, exports.rewardActionType)("action_type").notNull(),
    actionMetadata: (0, pg_core_1.jsonb)("action_metadata"),
    pointsEarned: (0, pg_core_1.integer)("points_earned").default(0).notNull(),
    tokensPending: (0, pg_core_1.numeric)("tokens_pending", { precision: 20, scale: 8 }).default('0').notNull(),
    mintStatus: (0, exports.mintStatusType)("mint_status").default('pending').notNull(),
    txHash: (0, pg_core_1.text)("tx_hash"),
    blockchainNetwork: (0, pg_core_1.text)("blockchain_network"),
    errorMessage: (0, pg_core_1.text)("error_message"),
    claimedAt: (0, pg_core_1.timestamp)("claimed_at", { mode: 'string' }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("idx_rewards_log_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamp_ops")),
    (0, pg_core_1.index)("idx_rewards_log_mint_status").using("btree", table.mintStatus.asc().nullsLast().op("enum_ops")),
    (0, pg_core_1.index)("idx_rewards_log_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
    (0, pg_core_1.foreignKey)({
        columns: [table.userId],
        foreignColumns: [exports.users.id],
        name: "rewards_log_user_id_users_id_fk"
    }).onDelete("cascade"),
]);
