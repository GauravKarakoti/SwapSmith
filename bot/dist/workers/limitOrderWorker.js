"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startLimitOrderWorker = startLimitOrderWorker;
const node_cron_1 = __importDefault(require("node-cron"));
const db = __importStar(require("../services/database"));
const price_client_1 = require("../services/price-client");
const sideshift_client_1 = require("../services/sideshift-client");
function startLimitOrderWorker(bot) {
    console.log('👷 Limit Order Worker started...');
    // Run every minute
    node_cron_1.default.schedule('* * * * *', async () => {
        console.log('👷 Checking limit orders...');
        try {
            const pendingOrders = await db.getPendingLimitOrders();
            if (pendingOrders.length === 0)
                return;
            // 1. Gather all unique condition assets
            const conditionAssets = [...new Set(pendingOrders.map(o => o.conditionAsset))];
            // 2. Fetch prices
            const prices = await (0, price_client_1.getPrices)(conditionAssets);
            // 3. Check conditions
            for (const order of pendingOrders) {
                const currentPrice = prices[order.conditionAsset];
                if (!currentPrice) {
                    // Can happen if coin ID mapping is missing or API fails for specific coin
                    console.warn(`No price for ${order.conditionAsset}, skipping order ${order.id}`);
                    continue;
                }
                let conditionMet = false;
                if (order.conditionType === 'below' && currentPrice < order.targetPrice) {
                    conditionMet = true;
                }
                else if (order.conditionType === 'above' && currentPrice > order.targetPrice) {
                    conditionMet = true;
                }
                if (conditionMet) {
                    console.log(`✅ Order ${order.id} triggered! ${order.conditionAsset} (${currentPrice}) is ${order.conditionType} ${order.targetPrice}`);
                    await executeOrder(bot, order, currentPrice);
                }
            }
        }
        catch (error) {
            console.error('Worker error:', error);
        }
    });
}
async function executeOrder(bot, order, triggerPrice) {
    try {
        if (!order.settleAddress) {
            await db.updateLimitOrderStatus(order.id, 'failed', undefined, "Missing destination address");
            bot.telegram.sendMessage(order.telegramId, `❌ Limit Order ${order.id} failed: Missing destination address.`);
            return;
        }
        // Default networks if missing (Bot should handle this better at creation, but safe defaults here)
        const fromNetwork = order.fromNetwork || 'ethereum'; // Default to ETH mainnet? Dangerous but MVP.
        const toNetwork = order.toNetwork || 'bitcoin'; // Default to Bitcoin?
        // 1. Create Quote
        // Use a user IP placeholder or 1.1.1.1
        const quote = await (0, sideshift_client_1.createQuote)(order.fromAsset, fromNetwork, // We might need to map short names to network IDs if they differ
        order.toAsset, toNetwork, order.amount, '1.1.1.1');
        if (quote.error || !quote.id) {
            throw new Error(quote.error?.message || "Quote creation failed");
        }
        // 2. Create Order
        const sideshiftOrder = await (0, sideshift_client_1.createOrder)(quote.id, order.settleAddress, order.settleAddress);
        // 3. Update DB
        await db.updateLimitOrderStatus(order.id, 'executed', sideshiftOrder.id);
        // 4. Notify User
        const depositAddress = typeof sideshiftOrder.depositAddress === 'string'
            ? sideshiftOrder.depositAddress
            : sideshiftOrder.depositAddress.address;
        const message = `🚀 *Limit Order Triggered!*\n` +
            `Condition: ${order.conditionAsset} ${order.conditionType} $${order.targetPrice}\n` +
            `Current Price: $${triggerPrice}\n\n` +
            `📝 *Order Details:*\n` +
            `Send: ${quote.depositAmount} ${quote.depositCoin} (${quote.depositNetwork})\n` +
            `Receive: ${quote.settleAmount} ${quote.settleCoin} (${quote.settleNetwork})\n` +
            `To Address: \`${depositAddress}\`\n\n` +
            `Please send funds now to execute the swap.`;
        await bot.telegram.sendMessage(order.telegramId, message, { parse_mode: 'Markdown' });
    }
    catch (error) {
        console.error(`Failed to execute order ${order.id}:`, error);
        await db.updateLimitOrderStatus(order.id, 'failed', undefined, error instanceof Error ? error.message : String(error));
        await bot.telegram.sendMessage(order.telegramId, `⚠️ Limit Order ${order.id} triggered but failed to create swap: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}
