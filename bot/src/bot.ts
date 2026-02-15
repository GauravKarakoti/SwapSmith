import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { exec } from 'child_process';
import { ethers } from 'ethers';

// Services
import { transcribeAudio } from './services/groq-client';
import { createQuote, createOrder, createCheckout, getOrderStatus } from './services/sideshift-client';
import { getTopStablecoinYields, getTopYieldPools } from './services/yield-client';
import { executePortfolioStrategy } from './services/portfolio-service'; // Assumed export
import * as db from './services/database';
import { OrderMonitor } from './services/order-monitor';
import { tokenResolver } from './services/token-resolver';
import { chainIdMap } from './config/chains';
import { ADDRESS_PATTERNS } from './config/address-patterns';
import { parseUserCommand } from './services/parseUserCommand';

dotenv.config();

// Configuration
const bot = new Telegraf(process.env.BOT_TOKEN!);
const MINI_APP_URL = process.env.MINI_APP_URL!;
const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

// Default EVM pattern for unknown chains
const DEFAULT_EVM_PATTERN = /^0x[a-fA-F0-9]{40}$/;

// ------------------ UTILITIES ------------------

/**
 * Validates a wallet address against the expected format for a given chain.
 */
function isValidAddress(address: string, chain?: string): boolean {
    if (!address || typeof address !== 'string') return false;
    const trimmedAddress = address.trim();

    if (!chain) {
        if (DEFAULT_EVM_PATTERN.test(trimmedAddress)) return true;
        for (const pattern of Object.values(ADDRESS_PATTERNS)) {
            if (pattern.test(trimmedAddress)) return true;
        }
        return false;
    }

    const normalizedChain = chain.toLowerCase().replace(/[^a-z]/g, '');
    const pattern = ADDRESS_PATTERNS[normalizedChain as keyof typeof ADDRESS_PATTERNS];

    if (pattern) return pattern.test(trimmedAddress);
    return DEFAULT_EVM_PATTERN.test(trimmedAddress);
}

// ------------------ INIT SERVICES ------------------

const orderMonitor = new OrderMonitor({
    getOrderStatus,
    updateOrderStatus: db.updateOrderStatus,
    getPendingOrders: db.getPendingOrders,
    onStatusChange: async (telegramId, orderId, oldStatus, newStatus, details) => {
        const statusEmoji: Record<string, string> = {
            waiting: '⏳', pending: '⏳', processing: '⚙️',
            settling: '📤', settled: '✅', refunded: '↩️',
            expired: '⏰', failed: '❌',
        };
        const emoji = statusEmoji[newStatus] || '🔔';
        const msg =
            `${emoji} *Order Status Update*\n\n` +
            `*Order:* \`${orderId}\`\n` +
            `*Status:* ${oldStatus} → *${newStatus.toUpperCase()}*\n` +
            (details.depositAmount ? `*Sent:* ${details.depositAmount} ${details.depositCoin}\n` : '') +
            (details.settleAmount ? `*Received:* ${details.settleAmount} ${details.settleCoin}\n` : '') +
            (details.settleHash ? `*Tx:* \`${details.settleHash.substring(0, 16)}...\`\n` : '');
        try {
            await bot.telegram.sendMessage(telegramId, msg, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error(`[OrderMonitor] Failed to notify user ${telegramId}:`, err);
        }
    },
});

// ------------------ COMMANDS ------------------

bot.start((ctx) => {
    ctx.reply(
        "🤖 *Welcome to SwapSmith!*\n\n" +
        "I am your Voice-Activated Crypto Trading Assistant.\n" +
        "I use SideShift.ai for swaps and a Mini App for secure signing.\n\n" +
        "📜 *Commands:*\n" +
        "/website - Open Web App\n" +
        "/yield - See top yield opportunities\n" +
        "/history - See past orders\n" +
        "/checkouts - See payment links\n" +
        "/status [id] - Check order status\n" +
        "/clear - Reset conversation\n\n" +
        "💡 *Tip:* Check out our web interface for a graphical experience!",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.url('🌐 Visit Website', "https://swap-smith.vercel.app/")
            ])
        }
    );
});

bot.command('website', (ctx) => {
    ctx.reply(
        "🌐 *SwapSmith Web Interface*\n\nClick the button below to access the full graphical interface.",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.url('🚀 Open Website', "https://swap-smith.vercel.app/")
            ])
        }
    );
});

bot.command('clear', async (ctx) => {
    await db.clearConversationState(ctx.from.id);
    ctx.reply('🧹 Conversation reset.');
});

bot.command('yield', async (ctx) => {
    try {
        await ctx.reply('📈 Fetching top yield opportunities...');
        
        // Show stablecoin yields first
        const stableYields = await getTopStablecoinYields();
        await ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${stableYields}`);

        // Show specific pools with interaction buttons
        const pools = await getTopYieldPools();
        if (pools && pools.length > 0) {
            const topPools = pools.slice(0, 3);
            for (const [index, pool] of topPools.entries()) {
                await ctx.reply(
                    `*Pool:* ${pool.project}\n` +
                    `*Asset:* ${pool.symbol}\n` +
                    `*APY:* ${pool.apy}%`,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            Markup.button.callback("💸 Deposit", `deposit_${pool.project}_${pool.symbol}`)
                        ]),
                    }
                );
            }
        }
    } catch (error) {
        console.error("Yield command error:", error);
        ctx.reply("❌ Failed to fetch yield data.");
    }
});

// ------------------ MESSAGE HANDLERS ------------------

async function handleTextMessage(ctx: any, text: string, inputType: 'text' | 'voice' = 'text') {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    // 1. Check for pending address input
    if (state?.parsedCommand && (state.parsedCommand.intent === 'swap' || state.parsedCommand.intent === 'checkout') && !state.parsedCommand.settleAddress) {
        const potentialAddress = text.trim();
        const targetChain = state.parsedCommand.toChain || state.parsedCommand.settleNetwork;

        if (isValidAddress(potentialAddress, targetChain)) {
            const updatedCommand = { ...state.parsedCommand, settleAddress: potentialAddress };
            await db.setConversationState(userId, { parsedCommand: updatedCommand });

            await ctx.reply(`Address received: \`${potentialAddress}\``, { parse_mode: 'Markdown' });

            const confirmAction = updatedCommand.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap';
            return ctx.reply("Ready to proceed?", Markup.inlineKeyboard([
                Markup.button.callback('✅ Yes', confirmAction),
                Markup.button.callback('❌ No', 'cancel_swap')
            ]));
        } else {
            const chainHint = targetChain ? ` for ${targetChain}` : '';
            return ctx.reply(`That doesn't look like a valid wallet address${chainHint}. Please provide a valid address or /clear to cancel.`);
        }
    }

    const history = state?.messages || [];

    await ctx.sendChatAction('typing');
    const parsed = await parseUserCommand(text, history, inputType);

    if (!parsed.success && parsed.intent !== 'yield_scout') {
        console.log('ValidationError', { input: text, error: parsed.validationErrors.join(", ") });
        let errorMessage = `⚠️ ${parsed.validationErrors.join(", ") || "I didn't understand."}`;
        if (parsed.confidence < 50) {
            errorMessage += "\n\n💡 *Suggestion:* Try rephrasing. Ex: 'swap to BTC' or 'split 1 ETH into 50% BTC and 50% USDC'";
        }
        return ctx.replyWithMarkdown(errorMessage);
    }

    if (parsed.intent === 'yield_scout') {
        const yields = await getTopStablecoinYields();
        return ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
    }

    if (parsed.intent === 'yield_deposit') {
        const pools = await getTopYieldPools();
        const matchingPool = pools.find(p => p.symbol === parsed.fromAsset?.toUpperCase());

        if (!matchingPool) {
            return ctx.reply(`Sorry, no suitable yield pool found for ${parsed.fromAsset}. Try /yield to see options.`);
        }

        const depositCommand = {
            intent: 'swap',
            fromAsset: parsed.fromAsset,
            fromChain: parsed.fromChain,
            toAsset: matchingPool.symbol,
            toChain: matchingPool.chain,
            amount: parsed.amount,
            settleAddress: null // Will ask for address
        };
        await db.setConversationState(userId, { parsedCommand: depositCommand });
        return ctx.reply(`To deposit to yield on ${matchingPool.chain}, please provide your wallet address on ${matchingPool.chain}.`);
    }

    if (parsed.intent === 'portfolio') {
        await db.setConversationState(userId, { parsedCommand: parsed });

        let msg = `📊 *Portfolio Strategy Detected*\nInput: ${parsed.amount} ${parsed.fromAsset} (${parsed.fromChain})\n\n*Allocation Plan:*\n`;
        parsed.portfolio?.forEach((item: any) => { msg += `• ${item.percentage}% → ${item.toAsset} on ${item.toChain}\n`; });

        return ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            Markup.button.callback('✅ Confirm Strategy', 'confirm_portfolio'),
            Markup.button.callback('❌ Cancel', 'cancel_swap')
        ]));
    }

    if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
        if (!parsed.settleAddress) {
            await db.setConversationState(userId, { parsedCommand: parsed });
            return ctx.reply(`Okay, I see you want to ${parsed.intent}. Please provide the destination/wallet address.`);
        }

        await db.setConversationState(userId, { parsedCommand: parsed });
        const confirmAction = parsed.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap';

        ctx.reply("Confirm...", Markup.inlineKeyboard([
            Markup.button.callback('✅ Yes', confirmAction),
            Markup.button.callback('❌ No', 'cancel_swap')
        ]));
    }

    if (inputType === 'voice' && parsed.success) await ctx.reply(`🗣️ ${parsed.parsedMessage}`);
}

bot.on(message('text'), async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    await handleTextMessage(ctx, ctx.message.text, 'text');
});

bot.on(message('voice'), async (ctx) => {
    const userId = ctx.from.id;
    await ctx.reply('👂 Listening...');

    const tempDir = os.tmpdir();
    const ogaPath = path.join(tempDir, `temp_${userId}.oga`);
    const mp3Path = path.join(tempDir, `temp_${userId}.mp3`);

    try {
        const file_id = ctx.message.voice.file_id;
        const fileLink = await ctx.telegram.getFileLink(file_id);

        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        fs.writeFileSync(ogaPath, Buffer.from(response.data));
        
        // Execute ffmpeg with timeout
        await new Promise<void>((resolve, reject) => {
            const ffmpegProcess = exec(`ffmpeg -i "${ogaPath}" "${mp3Path}" -y`, (err) => {
                if (err) reject(err);
                else resolve();
            });

            const timeout = setTimeout(() => {
                if (ffmpegProcess.pid) ffmpegProcess.kill('SIGTERM');
                reject(new Error('ffmpeg timed out'));
            }, 30000);

            ffmpegProcess.on('exit', () => clearTimeout(timeout));
        });

        const transcribedText = await transcribeAudio(mp3Path);
        await handleTextMessage(ctx, transcribedText, 'voice');
    } catch (error) {
        console.error("Voice error:", error);
        ctx.reply("Sorry, I couldn't hear that clearly. Please try again.");
    } finally {
        try {
            if (fs.existsSync(ogaPath)) fs.unlinkSync(ogaPath);
            if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
        } catch (e) { console.error("Cleanup failed", e); }
    }
});

// ------------------ ACTIONS ------------------

bot.action('confirm_swap', async (ctx) => {
    const state = await db.getConversationState(ctx.from.id);
    if (!state?.parsedCommand) return ctx.answerCbQuery('Session expired.');

    try {
        const q = await createQuote(
            state.parsedCommand.fromAsset!,
            state.parsedCommand.fromChain!,
            state.parsedCommand.toAsset!,
            state.parsedCommand.toChain!,
            state.parsedCommand.amount!
        );

        await db.setConversationState(ctx.from.id, {
            ...state,
            quoteId: q.id,
            settleAmount: q.settleAmount,
        });

        ctx.editMessageText(
            `➡️ Send ${q.depositAmount} ${q.depositCoin}\n⬅️ Receive ${q.settleAmount} ${q.settleCoin}`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    Markup.button.callback('✅ Place Order', 'place_order'),
                    Markup.button.callback('❌ Cancel', 'cancel_swap'),
                ]),
            }
        );
    } catch (e) {
        ctx.reply(`Error creating quote: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
});

bot.action('place_order', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.quoteId || !state?.parsedCommand?.settleAddress) return ctx.answerCbQuery('Session expired.');

    try {
        const order = await createOrder(
            state.quoteId,
            state.parsedCommand.settleAddress,
            state.parsedCommand.settleAddress // Refund address (same as settle for simplicity here)
        );

        await db.createOrderEntry(userId, state.parsedCommand, order, state.settleAmount!, state.quoteId);
        orderMonitor.trackOrder(order.id, userId);

        ctx.editMessageText(
            `✅ *Order Created*\nID: \`${order.id}\`\n\nSign transaction to complete.`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    Markup.button.webApp(
                        '📱 Sign Transaction',
                        `${MINI_APP_URL}?to=${typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress.address}`
                    ),
                ]),
            }
        );
    } catch (e) {
        ctx.reply(`Order failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
});

bot.action('confirm_checkout', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.parsedCommand || state.parsedCommand.intent !== 'checkout') return ctx.answerCbQuery('Start over.');

    try {
        await ctx.answerCbQuery('Creating link...');
        const { settleAsset, settleNetwork, settleAmount, settleAddress } = state.parsedCommand;
        
        const checkout = await createCheckout(settleAsset!, settleNetwork!, settleAmount!, settleAddress!);
        if (!checkout?.id) throw new Error("API Error");

        const checkoutMessage =
            `✅ *Checkout Link Created!*\n\n` +
            `💰 *Receive:* ${checkout.settleAmount} ${checkout.settleCoin}\n` +
            `📬 *Address:* \`${checkout.settleAddress}\`\n\n` +
            `[Pay Here](${checkout.url})`;

        ctx.editMessageText(checkoutMessage, {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true },
            ...Markup.inlineKeyboard([
                 Markup.button.callback('❌ Close', 'cancel_swap')
            ])
        });
    } catch (error) {
        console.error('Checkout error', error);
        ctx.reply('❌ Failed to create checkout link.');
    }
});

bot.action('confirm_portfolio', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    if (!state?.parsedCommand?.portfolio) return ctx.editMessageText('❌ No portfolio allocation found.');

    try {
        await ctx.answerCbQuery('Executing portfolio strategy...');
        await ctx.editMessageText('🔄 Executing portfolio swaps... This may take a moment.');

        const { successfulOrders, failedSwaps } = await executePortfolioStrategy(userId, state.parsedCommand);

        if (successfulOrders.length === 0) {
            return ctx.editMessageText(
                `❌ *Portfolio Execution Failed*\n\n` +
                failedSwaps.map((f: any) => `• ${f.asset}: ${f.reason}`).join('\n'),
                { parse_mode: 'Markdown' }
            );
        }

        await db.setConversationState(userId, {
            ...state,
            portfolioOrders: successfulOrders,
            currentTransactionIndex: 0
        });

        let summary = `✅ *Portfolio Executed*\n\n*Successful (${successfulOrders.length}):*\n`;
        successfulOrders.forEach((o: any) => { summary += `• ${o.allocation.toAsset}: Order created\n`; });
        
        if (failedSwaps.length > 0) {
            summary += `\n⚠️ *Failed (${failedSwaps.length}):*\n`;
            failedSwaps.forEach((f: any) => { summary += `• ${f.asset}: ${f.reason}\n`; });
        }

        summary += `\n📝 *Next Step:* Sign ${successfulOrders.length} transaction(s).`;

        ctx.editMessageText(summary, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('✍️ Sign Transactions', 'sign_portfolio_transaction'),
                Markup.button.callback('❌ Close', 'cancel_swap')
            ])
        });

    } catch (error) {
        console.error('Critical portfolio error', { userId, error });
        ctx.editMessageText(`⚠️ Critical Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
});

bot.action('sign_portfolio_transaction', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.portfolioOrders) return ctx.answerCbQuery('Session expired.');

    const i = state.currentTransactionIndex || 0;
    const orderData = state.portfolioOrders[i];

    if (!orderData) {
        await db.clearConversationState(userId);
        return ctx.editMessageText(`🎉 *All transactions signed!* \n\nI'll notify you as the swaps complete.`);
    }

    const { order, swapAmount, allocation } = orderData;
    const { fromAsset, fromChain } = state.parsedCommand!;

    const rawDepositAddress = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress.address;
    const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress.memo : null;
    const chainKey = fromChain?.toLowerCase() || 'ethereum';
    const assetKey = fromAsset?.toUpperCase() || 'ETH';

    let txTo = rawDepositAddress;
    let txValueHex = '0x0';
    let txData = '0x';

    try {
        const tokenData = await tokenResolver.getTokenInfo(assetKey, chainKey);
        if (tokenData) {
            txTo = tokenData.address;
            const amountBigInt = ethers.parseUnits(swapAmount.toString(), tokenData.decimals);
            const iface = new ethers.Interface(ERC20_ABI);
            txData = iface.encodeFunctionData("transfer", [rawDepositAddress, amountBigInt]);
        } else {
            const amountBigInt = ethers.parseUnits(swapAmount.toString(), 18); // Default to 18 if native not resolved
            txValueHex = '0x' + amountBigInt.toString(16);
            if (depositMemo) txData = ethers.hexlify(ethers.toUtf8Bytes(depositMemo));
        }
    } catch (err) {
        console.error("Token resolution failed", err);
    }

    const params = new URLSearchParams({
        to: txTo, value: txValueHex, data: txData,
        chainId: chainIdMap[chainKey] || '1',
        token: assetKey, amount: swapAmount.toString()
    });

    const isLast = i === state.portfolioOrders.length - 1;
    const buttons: any[] = [
        Markup.button.webApp('📱 Sign Transaction', `${MINI_APP_URL}?${params.toString()}`)
    ];

    if (!isLast) {
        buttons.push(Markup.button.callback('➡️ Next Transaction', 'next_portfolio_transaction'));
    } else {
        buttons.push(Markup.button.callback('✅ Done', 'next_portfolio_transaction'));
    }

    ctx.editMessageText(
        `📝 *Transaction ${i + 1}/${state.portfolioOrders.length}*\n\n` +
        `For: ${allocation.toAsset}\n` +
        `Amount: ${swapAmount} ${fromAsset}\n` +
        `Deposit Address: \`${rawDepositAddress}\`\n\n` +
        `Please sign the transaction to fund this swap.`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
    );
});

bot.action('next_portfolio_transaction', async (ctx) => {
    const state = await db.getConversationState(ctx.from.id);
    if (!state) return;
    await db.setConversationState(ctx.from.id, {
        ...state,
        currentTransactionIndex: (state.currentTransactionIndex || 0) + 1,
    });
    // Re-trigger sign action for next index
    // @ts-ignore
    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'sign_portfolio_transaction' } });
});

bot.action('confirm_migration', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.parsedCommand || state.parsedCommand.intent !== 'yield_migrate') return ctx.answerCbQuery('Session expired.');

    try {
        await ctx.answerCbQuery('Preparing migration...');
        const { fromAsset, settleAsset, settleNetwork, settleAmount, settleAddress, isCrossChain } = state.parsedCommand;

        if (!isCrossChain) {
             return ctx.editMessageText(
                `✅ *Same-Chain Migration*\n\nWithdraw ${fromAsset} manually and deposit to new pool.`,
                { parse_mode: 'Markdown' }
             );
        }

        const checkout = await createCheckout(
            settleAsset!, settleNetwork!, settleAmount!, settleAddress!, '1.1.1.1'
        );

        if (!checkout?.id) throw new Error("Failed to create migration checkout");

        const checkoutMessage =
            `✅ *Migration Checkout Link*\n\n` +
            `💰 *Receive:* ${checkout.settleAmount} ${checkout.settleCoin}\n` +
            `📬 *Address:* \`${checkout.settleAddress}\`\n\n` +
            `[Pay Here](${checkout.url})`;

        ctx.editMessageText(checkoutMessage, {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true }
        });

    } catch (e) {
        ctx.reply(`Migration failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
});

bot.action('cancel_swap', async (ctx) => {
    await db.clearConversationState(ctx.from.id);
    ctx.editMessageText('❌ Cancelled.');
});

bot.action(/deposit_(.+)_(.+)/, async (ctx) => {
    const project = ctx.match[1];
    const asset = ctx.match[2];
    await ctx.answerCbQuery();
    ctx.reply(`🚀 To deposit ${asset} into ${project}, please use the /swap command:\nExample: "swap 100 USDC to ${asset} on ${project} chain"`);
});

// ------------------ SERVER ------------------

const app = express();
app.get('/', (req, res) => { res.send('SwapSmith Alive'); });
app.listen(process.env.PORT || 3000, () => console.log(`Express server live`));

// --- STARTUP ---
(async () => {
    await orderMonitor.loadPendingOrders();
    orderMonitor.start();
    bot.launch();
    console.log('🤖 Bot is running...');
})();

// --- SHUTDOWN ---
const shutdown = (signal: string) => {
    console.log(`\n[${signal}] Shutting down...`);
    orderMonitor.stop();
    bot.stop(signal);
};
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));