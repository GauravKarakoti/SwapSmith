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
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmPortfolioHandler = confirmPortfolioHandler;
const db = __importStar(require("../services/database"));
const sideshift_client_1 = require("../services/sideshift-client");
const network_1 = require("../utils/network");
async function confirmPortfolioHandler(ctx) {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.parsedCommand?.portfolio || state.parsedCommand.portfolio.length === 0) {
        return ctx.reply("No portfolio strategy found. Please try again.");
    }
    await ctx.reply("🔄 Executing portfolio strategy...");
    const portfolio = state.parsedCommand.portfolio;
    const fromAsset = state.parsedCommand.fromAsset;
    let fromChain = state.parsedCommand.fromChain;
    const totalAmount = state.parsedCommand.amount;
    if (!fromChain) {
        fromChain = (0, network_1.inferNetwork)(fromAsset);
    }
    let successCount = 0;
    let failCount = 0;
    let summary = `📊 *Portfolio Execution Summary*\n\n`;
    for (const item of portfolio) {
        const amount = (totalAmount * item.percentage) / 100;
        try {
            const quote = await (0, sideshift_client_1.createQuote)(fromAsset, fromChain, item.toAsset, item.toChain, amount, '1.1.1.1');
            if (quote.error)
                throw new Error(quote.error.message);
            successCount++;
            summary += `✅ *${item.percentage}% → ${item.toAsset}*\n`;
            summary += `   Rate: 1 ${quote.depositCoin} ≈ ${quote.rate} ${quote.settleCoin}\n`;
            summary += `   Send: \`${quote.depositAmount} ${quote.depositCoin}\`\n\n`;
        }
        catch (error) {
            failCount++;
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            summary += `❌ *${item.percentage}% → ${item.toAsset}*: ${errMsg}\n\n`;
        }
    }
    summary += `Completed: ${successCount} Success, ${failCount} Failed.`;
    await ctx.replyWithMarkdown(summary);
}
