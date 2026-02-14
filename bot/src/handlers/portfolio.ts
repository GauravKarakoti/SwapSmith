import * as db from '../services/database';
import { createQuote } from '../services/sideshift-client';
import { inferNetwork } from '../utils/network';

export async function confirmPortfolioHandler(ctx: any) {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    if (!state?.parsedCommand?.portfolio || state.parsedCommand.portfolio.length === 0) {
        return ctx.reply("No portfolio strategy found. Please try again.");
    }

    await ctx.reply("🔄 Executing portfolio strategy...");

    const portfolio = state.parsedCommand.portfolio;
    const fromAsset = state.parsedCommand.fromAsset!;
    let fromChain = state.parsedCommand.fromChain;
    const totalAmount = state.parsedCommand.amount!;

    if (!fromChain) {
        fromChain = inferNetwork(fromAsset);
    }

    let successCount = 0;
    let failCount = 0;
    let summary = `📊 *Portfolio Execution Summary*\n\n`;

    for (const item of portfolio) {
        const amount = (totalAmount * item.percentage) / 100;

        try {
             const quote = await createQuote(
                fromAsset,
                fromChain,
                item.toAsset,
                item.toChain,
                amount,
                '1.1.1.1'
             );

             if (quote.error) throw new Error(quote.error.message);

             successCount++;
             summary += `✅ *${item.percentage}% → ${item.toAsset}*\n`;
             summary += `   Rate: 1 ${quote.depositCoin} ≈ ${quote.rate} ${quote.settleCoin}\n`;
             summary += `   Send: \`${quote.depositAmount} ${quote.depositCoin}\`\n\n`;

        } catch (error) {
             failCount++;
             const errMsg = error instanceof Error ? error.message : 'Unknown error';
             summary += `❌ *${item.percentage}% → ${item.toAsset}*: ${errMsg}\n\n`;
        }
    }

    summary += `Completed: ${successCount} Success, ${failCount} Failed.`;
    await ctx.replyWithMarkdown(summary);
}
