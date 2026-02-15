import { pgTable, serial, bigint, text, timestamp, unique, real, integer, numeric, index, foreignKey, uuid, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const mintStatusType = pgEnum("mint_status_type", ['pending', 'processing', 'minted', 'failed'])
export const rewardActionType = pgEnum("reward_action_type", ['course_complete', 'module_complete', 'daily_login', 'swap_complete', 'referral'])


export const addressBook = pgTable("address_book", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
	nickname: text().notNull(),
	address: text().notNull(),
	chain: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const chatHistory = pgTable("chat_history", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	walletAddress: text("wallet_address"),
	role: text().notNull(),
	content: text().notNull(),
	metadata: text(),
	sessionId: text("session_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const checkouts = pgTable("checkouts", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
	checkoutId: text("checkout_id").notNull(),
	settleAsset: text("settle_asset").notNull(),
	settleNetwork: text("settle_network").notNull(),
	settleAmount: real("settle_amount").notNull(),
	settleAddress: text("settle_address").notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("checkouts_checkout_id_unique").on(table.checkoutId),
]);

export const coinPriceCache = pgTable("coin_price_cache", {
	id: serial().primaryKey().notNull(),
	coin: text().notNull(),
	network: text().notNull(),
	name: text().notNull(),
	usdPrice: text("usd_price"),
	btcPrice: text("btc_price"),
	available: text().default('true').notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const conversations = pgTable("conversations", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
	state: text(),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("conversations_telegram_id_unique").on(table.telegramId),
]);

export const orders = pgTable("orders", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
	sideshiftOrderId: text("sideshift_order_id").notNull(),
	quoteId: text("quote_id").notNull(),
	fromAsset: text("from_asset").notNull(),
	fromNetwork: text("from_network").notNull(),
	fromAmount: real("from_amount").notNull(),
	toAsset: text("to_asset").notNull(),
	toNetwork: text("to_network").notNull(),
	settleAmount: text("settle_amount").notNull(),
	depositAddress: text("deposit_address").notNull(),
	depositMemo: text("deposit_memo"),
	status: text().default('pending').notNull(),
	txHash: text("tx_hash"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("orders_sideshift_order_id_unique").on(table.sideshiftOrderId),
]);

export const swapHistory = pgTable("swap_history", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	walletAddress: text("wallet_address"),
	sideshiftOrderId: text("sideshift_order_id").notNull(),
	quoteId: text("quote_id"),
	fromAsset: text("from_asset").notNull(),
	fromNetwork: text("from_network").notNull(),
	fromAmount: real("from_amount").notNull(),
	toAsset: text("to_asset").notNull(),
	toNetwork: text("to_network").notNull(),
	settleAmount: text("settle_amount").notNull(),
	depositAddress: text("deposit_address"),
	status: text().default('pending').notNull(),
	txHash: text("tx_hash"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const watchedOrders = pgTable("watched_orders", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
	sideshiftOrderId: text("sideshift_order_id").notNull(),
	lastStatus: text("last_status").default('pending').notNull(),
	lastChecked: timestamp("last_checked", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("watched_orders_sideshift_order_id_unique").on(table.sideshiftOrderId),
]);

export const userSettings = pgTable("user_settings", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	walletAddress: text("wallet_address"),
	theme: text().default('dark'),
	slippageTolerance: real("slippage_tolerance").default(0.5),
	notificationsEnabled: text("notifications_enabled").default('true'),
	defaultFromAsset: text("default_from_asset"),
	defaultToAsset: text("default_to_asset"),
	emailNotifications: text("email_notifications"),
	telegramNotifications: text("telegram_notifications").default('false'),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	preferences: text(),
}, (table) => [
	unique("user_settings_user_id_unique").on(table.userId),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
	walletAddress: text("wallet_address"),
	sessionTopic: text("session_topic"),
	totalPoints: integer("total_points").default(0).notNull(),
	totalTokensClaimed: numeric("total_tokens_claimed", { precision: 20, scale:  8 }).default('0').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_telegram_id_unique").on(table.telegramId),
	unique("users_wallet_address_unique").on(table.walletAddress),
]);

export const dcaSchedules = pgTable("dca_schedules", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
	fromAsset: text("from_asset").notNull(),
	fromChain: text("from_chain").notNull(),
	toAsset: text("to_asset").notNull(),
	toChain: text("to_chain").notNull(),
	amount: real().notNull(),
	frequency: text().notNull(),
	dayOfWeek: text("day_of_week"),
	dayOfMonth: text("day_of_month"),
	settleAddress: text("settle_address").notNull(),
	isActive: text("is_active").default('true').notNull(),
	lastExecuted: timestamp("last_executed", { mode: 'string' }),
	nextExecution: timestamp("next_execution", { mode: 'string' }).notNull(),
	executionCount: integer("execution_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const discussions = pgTable("discussions", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	username: text().notNull(),
	content: text().notNull(),
	category: text().default('general'),
	likes: text().default('0'),
	replies: text().default('0'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_discussions_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("idx_discussions_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_discussions_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const courseProgress = pgTable("course_progress", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	courseId: text("course_id").notNull(),
	courseTitle: text("course_title").notNull(),
	completedModules: text("completed_modules").array().default(["RAY"]).notNull(),
	totalModules: integer("total_modules").notNull(),
	completionPercentage: integer("completion_percentage").default(0).notNull(),
	bonusAwarded: boolean("bonus_awarded").default(false).notNull(),
	isCompleted: boolean("is_completed").default(false).notNull(),
	completionDate: timestamp("completion_date", { mode: 'string' }),
	lastAccessed: timestamp("last_accessed", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_course_progress_course_id").using("btree", table.courseId.asc().nullsLast().op("text_ops")),
	index("idx_course_progress_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "course_progress_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("course_progress_user_course_unique").on(table.userId, table.courseId),
]);

export const rewardsLog = pgTable("rewards_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	actionType: rewardActionType("action_type").notNull(),
	actionMetadata: jsonb("action_metadata"),
	pointsEarned: integer("points_earned").default(0).notNull(),
	tokensPending: numeric("tokens_pending", { precision: 20, scale:  8 }).default('0').notNull(),
	mintStatus: mintStatusType("mint_status").default('pending').notNull(),
	txHash: text("tx_hash"),
	blockchainNetwork: text("blockchain_network"),
	errorMessage: text("error_message"),
	claimedAt: timestamp("claimed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_rewards_log_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_rewards_log_mint_status").using("btree", table.mintStatus.asc().nullsLast().op("enum_ops")),
	index("idx_rewards_log_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "rewards_log_user_id_users_id_fk"
		}).onDelete("cascade"),
]);
