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
exports.startDcaWorker = startDcaWorker;
const node_cron_1 = __importDefault(require("node-cron"));
const db = __importStar(require("../services/database"));
const network_1 = require("../utils/network");
const price_client_1 = require("../services/price-client");
const sideshift_client_1 = require("../services/sideshift-client");
function startDcaWorker(bot) {
    console.log('👷 DCA Worker started...');
    node_cron_1.default.schedule('* * * * *', async () => {
        console.log('👷 Checking DCA plans...');
        try {
            const duePlans = await db.getDueDcaPlans();
            if (duePlans.length === 0)
                return;
            const assets = [...new Set(duePlans.map(p => p.toAsset))];
            const marketData = await (0, price_client_1.getPricesWithChange)(assets);
            for (const plan of duePlans) {
                // Smart DCA Logic
                const assetData = marketData[plan.toAsset.toUpperCase()];
                let multiplier = 1.0;
                if (assetData) {
                    // If price dropped > 5%, buy 1.5x (Buy the dip)
                    if (assetData.change24h < -5)
                        multiplier = 1.5;
                    // If price pumped > 5%, buy 0.5x (Don't FOMO)
                    else if (assetData.change24h > 5)
                        multiplier = 0.5;
                }
                const adjustedAmount = parseFloat((plan.amount * multiplier).toFixed(6));
                console.log(`Processing DCA Plan ${plan.id}: Base ${plan.amount}, Multiplier ${multiplier}, Adjusted ${adjustedAmount}`);
                try {
                    const fromNetwork = plan.fromNetwork || (0, network_1.inferNetwork)(plan.fromAsset);
                    const toNetwork = plan.toNetwork || (0, network_1.inferNetwork)(plan.toAsset);
                    // 1. Create Quote
                    const quote = await (0, sideshift_client_1.createQuote)(plan.fromAsset, fromNetwork, plan.toAsset, toNetwork, adjustedAmount, '1.1.1.1');
                    if (quote.error || !quote.id)
                        throw new Error(quote.error?.message || "Quote failed");
                    // 2. Create Order
                    // If settleAddress is missing, we can't execute. Ideally we check this before.
                    if (!plan.settleAddress) {
                        // Log error or notify user to set address
                        console.error(`DCA Plan ${plan.id} missing settle address.`);
                        continue;
                    }
                    const order = await (0, sideshift_client_1.createOrder)(quote.id, plan.settleAddress, plan.settleAddress);
                    // 3. Notify User
                    const depositAddress = typeof order.depositAddress === 'string'
                        ? order.depositAddress
                        : order.depositAddress.address;
                    const msg = `📅 *Smart DCA Execution*\n\n` +
                        `Market Condition: ${assetData?.change24h ? assetData.change24h.toFixed(2) : '0'}% (24h)\n` +
                        `Multiplier: ${multiplier}x\n\n` +
                        `Creating swap for *${adjustedAmount} ${plan.fromAsset}* → *${plan.toAsset}*\n` +
                        `Please send funds to: \`${depositAddress}\`\n\n` +
                        `Next run: ${new Date(Date.now() + plan.frequencyDays * 24 * 60 * 60 * 1000).toLocaleString()}`;
                    await bot.telegram.sendMessage(plan.telegramId, msg, { parse_mode: 'Markdown' });
                    // 4. Update Next Run
                    const nextRun = new Date();
                    nextRun.setDate(nextRun.getDate() + plan.frequencyDays);
                    await db.updateDcaRun(plan.id, nextRun);
                }
                catch (error) {
                    console.error(`DCA Plan ${plan.id} failed:`, error);
                    await bot.telegram.sendMessage(plan.telegramId, `⚠️ DCA execution failed: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        catch (error) {
            console.error('DCA Worker Error:', error);
        }
    });
}
