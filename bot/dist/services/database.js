"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dcaPlans = exports.limitOrders = exports.checkouts = exports.orders = exports.conversations = exports.users = void 0;
exports.getUser = getUser;
exports.setUserWalletAndSession = setUserWalletAndSession;
exports.getConversationState = getConversationState;
exports.setConversationState = setConversationState;
exports.clearConversationState = clearConversationState;
exports.createOrderEntry = createOrderEntry;
exports.getUserHistory = getUserHistory;
exports.getLatestUserOrder = getLatestUserOrder;
exports.updateOrderStatus = updateOrderStatus;
exports.createCheckoutEntry = createCheckoutEntry;
exports.getUserCheckouts = getUserCheckouts;
exports.createLimitOrder = createLimitOrder;
exports.getPendingLimitOrders = getPendingLimitOrders;
exports.updateLimitOrderStatus = updateLimitOrderStatus;
exports.getLimitOrdersByUser = getLimitOrdersByUser;
exports.createDcaPlan = createDcaPlan;
exports.getDueDcaPlans = getDueDcaPlans;
exports.updateDcaRun = updateDcaRun;
exports.getUserDcaPlans = getUserDcaPlans;
const serverless_1 = require("@neondatabase/serverless");
const neon_http_1 = require("drizzle-orm/neon-http");
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const sql = (0, serverless_1.neon)(process.env.DATABASE_URL);
const db = (0, neon_http_1.drizzle)(sql);
// --- SCHEMAS ---
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    telegramId: (0, pg_core_1.bigint)('telegram_id', { mode: 'number' }).notNull().unique(),
    walletAddress: (0, pg_core_1.text)('wallet_address'),
    sessionTopic: (0, pg_core_1.text)('session_topic'),
});
exports.conversations = (0, pg_core_1.pgTable)('conversations', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    telegramId: (0, pg_core_1.bigint)('telegram_id', { mode: 'number' }).notNull().unique(),
    state: (0, pg_core_1.text)('state'), // JSON string
});
exports.orders = (0, pg_core_1.pgTable)('orders', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    telegramId: (0, pg_core_1.bigint)('telegram_id', { mode: 'number' }).notNull(),
    sideshiftOrderId: (0, pg_core_1.text)('sideshift_order_id').notNull().unique(),
    quoteId: (0, pg_core_1.text)('quote_id').notNull(),
    fromAsset: (0, pg_core_1.text)('from_asset').notNull(),
    fromNetwork: (0, pg_core_1.text)('from_network').notNull(),
    fromAmount: (0, pg_core_1.real)('from_amount').notNull(),
    toAsset: (0, pg_core_1.text)('to_asset').notNull(),
    toNetwork: (0, pg_core_1.text)('to_network').notNull(),
    settleAmount: (0, pg_core_1.text)('settle_amount').notNull(),
    depositAddress: (0, pg_core_1.text)('deposit_address').notNull(),
    depositMemo: (0, pg_core_1.text)('deposit_memo'),
    status: (0, pg_core_1.text)('status').notNull().default('pending'),
    txHash: (0, pg_core_1.text)('tx_hash'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.checkouts = (0, pg_core_1.pgTable)('checkouts', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    telegramId: (0, pg_core_1.bigint)('telegram_id', { mode: 'number' }).notNull(),
    checkoutId: (0, pg_core_1.text)('checkout_id').notNull().unique(),
    settleAsset: (0, pg_core_1.text)('settle_asset').notNull(),
    settleNetwork: (0, pg_core_1.text)('settle_network').notNull(),
    settleAmount: (0, pg_core_1.real)('settle_amount').notNull(),
    settleAddress: (0, pg_core_1.text)('settle_address').notNull(),
    status: (0, pg_core_1.text)('status').notNull().default('pending'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.limitOrders = (0, pg_core_1.pgTable)('limit_orders', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    telegramId: (0, pg_core_1.bigint)('telegram_id', { mode: 'number' }).notNull(),
    fromAsset: (0, pg_core_1.text)('from_asset').notNull(),
    toAsset: (0, pg_core_1.text)('to_asset').notNull(),
    fromNetwork: (0, pg_core_1.text)('from_network'), // Can be null if inferred later
    toNetwork: (0, pg_core_1.text)('to_network'), // Can be null if inferred later
    amount: (0, pg_core_1.real)('amount').notNull(),
    conditionAsset: (0, pg_core_1.text)('condition_asset').notNull(), // The asset to watch price for
    conditionType: (0, pg_core_1.text)('condition_type').notNull(), // 'above' | 'below'
    targetPrice: (0, pg_core_1.real)('target_price').notNull(),
    status: (0, pg_core_1.text)('status').notNull().default('pending'), // 'pending', 'executed', 'cancelled', 'failed'
    sideshiftOrderId: (0, pg_core_1.text)('sideshift_order_id'),
    settleAddress: (0, pg_core_1.text)('settle_address'),
    errorMessage: (0, pg_core_1.text)('error_message'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.dcaPlans = (0, pg_core_1.pgTable)('dca_plans', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    telegramId: (0, pg_core_1.bigint)('telegram_id', { mode: 'number' }).notNull(),
    fromAsset: (0, pg_core_1.text)('from_asset').notNull(),
    toAsset: (0, pg_core_1.text)('to_asset').notNull(),
    fromNetwork: (0, pg_core_1.text)('from_network'),
    toNetwork: (0, pg_core_1.text)('to_network'),
    amount: (0, pg_core_1.real)('amount').notNull(),
    frequencyDays: (0, pg_core_1.integer)('frequency_days').notNull(),
    lastRun: (0, pg_core_1.timestamp)('last_run'),
    nextRun: (0, pg_core_1.timestamp)('next_run').notNull(),
    status: (0, pg_core_1.text)('status').notNull().default('active'), // active, paused, cancelled
    settleAddress: (0, pg_core_1.text)('settle_address'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
// --- FUNCTIONS ---
async function getUser(telegramId) {
    const result = await db.select().from(exports.users).where((0, drizzle_orm_1.eq)(exports.users.telegramId, telegramId));
    return result[0];
}
async function setUserWalletAndSession(telegramId, walletAddress, sessionTopic) {
    await db.insert(exports.users)
        .values({ telegramId, walletAddress, sessionTopic })
        .onConflictDoUpdate({
        target: exports.users.telegramId,
        set: { walletAddress, sessionTopic }
    });
}
async function getConversationState(telegramId) {
    const result = await db.select({ state: exports.conversations.state }).from(exports.conversations).where((0, drizzle_orm_1.eq)(exports.conversations.telegramId, telegramId));
    return result[0]?.state ? JSON.parse(result[0].state) : null;
}
async function setConversationState(telegramId, state) {
    await db.insert(exports.conversations)
        .values({ telegramId, state: JSON.stringify(state) })
        .onConflictDoUpdate({
        target: exports.conversations.telegramId,
        set: { state: JSON.stringify(state) }
    });
}
async function clearConversationState(telegramId) {
    await db.delete(exports.conversations).where((0, drizzle_orm_1.eq)(exports.conversations.telegramId, telegramId));
}
async function createOrderEntry(telegramId, parsedCommand, order, settleAmount, quoteId) {
    const depositAddr = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress?.address;
    const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress?.memo : null;
    await db.insert(exports.orders).values({
        telegramId,
        sideshiftOrderId: order.id,
        quoteId,
        fromAsset: parsedCommand.fromAsset,
        fromNetwork: parsedCommand.fromChain,
        fromAmount: parsedCommand.amount,
        toAsset: parsedCommand.toAsset,
        toNetwork: parsedCommand.toChain,
        settleAmount: settleAmount.toString(),
        depositAddress: depositAddr,
        depositMemo: depositMemo || null,
    });
}
async function getUserHistory(telegramId) {
    return await db.select().from(exports.orders)
        .where((0, drizzle_orm_1.eq)(exports.orders.telegramId, telegramId))
        .orderBy((0, drizzle_orm_1.desc)(exports.orders.createdAt))
        .limit(10);
}
async function getLatestUserOrder(telegramId) {
    const result = await db.select().from(exports.orders)
        .where((0, drizzle_orm_1.eq)(exports.orders.telegramId, telegramId))
        .orderBy((0, drizzle_orm_1.desc)(exports.orders.createdAt))
        .limit(1);
    return result[0];
}
async function updateOrderStatus(sideshiftOrderId, newStatus) {
    await db.update(exports.orders)
        .set({ status: newStatus })
        .where((0, drizzle_orm_1.eq)(exports.orders.sideshiftOrderId, sideshiftOrderId));
}
async function createCheckoutEntry(telegramId, checkout) {
    await db.insert(exports.checkouts).values({
        telegramId,
        checkoutId: checkout.id,
        settleAsset: checkout.settleCoin,
        settleNetwork: checkout.settleNetwork,
        settleAmount: parseFloat(checkout.settleAmount),
        settleAddress: checkout.settleAddress,
    });
}
async function getUserCheckouts(telegramId) {
    return await db.select().from(exports.checkouts)
        .where((0, drizzle_orm_1.eq)(exports.checkouts.telegramId, telegramId))
        .orderBy((0, drizzle_orm_1.desc)(exports.checkouts.createdAt))
        .limit(10);
}
// --- LIMIT ORDER FUNCTIONS ---
async function createLimitOrder(order) {
    return await db.insert(exports.limitOrders).values(order).returning();
}
async function getPendingLimitOrders() {
    return await db.select().from(exports.limitOrders).where((0, drizzle_orm_1.eq)(exports.limitOrders.status, 'pending'));
}
async function updateLimitOrderStatus(id, status, sideshiftOrderId, errorMessage) {
    const updates = { status };
    if (sideshiftOrderId)
        updates.sideshiftOrderId = sideshiftOrderId;
    if (errorMessage)
        updates.errorMessage = errorMessage;
    await db.update(exports.limitOrders)
        .set(updates)
        .where((0, drizzle_orm_1.eq)(exports.limitOrders.id, id));
}
async function getLimitOrdersByUser(telegramId) {
    return await db.select().from(exports.limitOrders)
        .where((0, drizzle_orm_1.eq)(exports.limitOrders.telegramId, telegramId))
        .orderBy((0, drizzle_orm_1.desc)(exports.limitOrders.createdAt));
}
// --- DCA FUNCTIONS ---
async function createDcaPlan(plan) {
    return await db.insert(exports.dcaPlans).values(plan).returning();
}
async function getDueDcaPlans() {
    const now = new Date();
    return await db.select().from(exports.dcaPlans)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(exports.dcaPlans.status, 'active'), (0, drizzle_orm_1.lte)(exports.dcaPlans.nextRun, now)));
}
async function updateDcaRun(id, nextRun) {
    await db.update(exports.dcaPlans)
        .set({ lastRun: new Date(), nextRun })
        .where((0, drizzle_orm_1.eq)(exports.dcaPlans.id, id));
}
async function getUserDcaPlans(telegramId) {
    return await db.select().from(exports.dcaPlans)
        .where((0, drizzle_orm_1.eq)(exports.dcaPlans.telegramId, telegramId))
        .orderBy((0, drizzle_orm_1.desc)(exports.dcaPlans.createdAt));
}
