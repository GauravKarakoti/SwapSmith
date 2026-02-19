import { Telegraf, Markup, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { exec } from 'child_process';
import express from 'express';
import { sql } from 'drizzle-orm';

// Services
import { transcribeAudio } from './services/groq-client';
import logger from './services/logger';

import {
    createQuote,
    createOrder,
    createCheckout,
    getOrderStatus
} from './services/sideshift-client';
import {
    getTopStablecoinYields,
    getTopYieldPools,
    formatYieldPools
} from './services/yield-client';
import * as db from './services/database';
import { DCAScheduler } from './services/dca-scheduler';
import { resolveAddress, isNamingService } from './services/address-resolver';
import { limitOrderWorker } from './workers/limitOrderWorker';
import { OrderMonitor } from './services/order-monitor';
import { parseUserCommand } from './services/parseUserCommand';
import { ADDRESS_PATTERNS, isValidAddress } from './config/address-patterns';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://swapsmithminiapp.netlify.app/';
const PORT = Number(process.env.PORT || 3000);

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// Address validation is now imported from config/address-patterns.ts

/* -------------------------------------------------------------------------- */
/* ORDER MONITOR                                */
/* -------------------------------------------------------------------------- */

const orderMonitor = new OrderMonitor({
    getOrderStatus,
    updateOrderStatus: db.updateOrderStatus,
    getPendingOrders: db.getPendingOrders,
    onStatusChange: async (telegramId, orderId, oldStatus, newStatus, details) => {
        const emojiMap: Record<string, string> = {
            waiting: '⏳',
            pending: '⏳',
            processing: '⚙️',
            settling: '📤',
            settled: '✅',
            refunded: '↩️',
            expired: '⏰',
            failed: '❌',
        };

        const msg =
            `${emojiMap[newStatus] || '🔔'} *Order Update*\n\n` +
            `*Order:* \`${orderId}\`\n` +
            `*Status:* ${oldStatus} → *${newStatus.toUpperCase()}*\n` +
            (details?.depositAmount
                ? `*Sent:* ${details.depositAmount} ${details.depositCoin}\n`
                : '') +
            (details?.settleAmount
                ? `*Received:* ${details.settleAmount} ${details.settleCoin}\n`
                : '') +
            (details?.settleHash ? `*Tx:* \`${details.settleHash.slice(0, 16)}...\`\n` : '');

        try {
            await bot.telegram.sendMessage(telegramId, msg, { parse_mode: 'Markdown' });
        } catch (e) {
            logger.error('Order update notify failed:', e);
        }
    },
});

/* -------------------------------------------------------------------------- */
/* COMMANDS                                 */
/* -------------------------------------------------------------------------- */

bot.start((ctx) =>
    ctx.reply(
        `🤖 *Welcome to SwapSmith!*\n\nVoice-enabled crypto trading assistant.`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.url('🌐 Open Web App', MINI_APP_URL),
            ]),
        }
    )
);

bot.command('yield', async (ctx) => {
    await ctx.reply('📈 Fetching top yield opportunities...');
    try {
        const yields = await getTopStablecoinYields();
        const msg = formatYieldPools(yields);
        ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${msg}`);
    } catch (error) {
        ctx.reply("❌ Failed to fetch yields.");
    }
});

bot.command('clear', async (ctx) => {
    if (ctx.from) {
        await db.clearConversationState(ctx.from.id);
        ctx.reply('🗑️ Conversation cleared');
    }
});

/* -------------------------------------------------------------------------- */
/* MESSAGE HANDLERS                              */
/* -------------------------------------------------------------------------- */

bot.on(message('text'), async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    await handleTextMessage(ctx, ctx.message.text);
});

bot.on(message('voice'), async (ctx) => {
    await ctx.reply('👂 Listening...');
    const fileId = ctx.message.voice.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);

    const oga = path.join(os.tmpdir(), `${Date.now()}.oga`);
    const mp3 = oga.replace('.oga', '.mp3');

    try {
        const res = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        fs.writeFileSync(oga, res.data);

        await new Promise<void>((resolve, reject) =>
            exec(`ffmpeg -i "${oga}" "${mp3}" -y`, (e) =>
                e ? reject(e) : resolve()
            )
        );

        const text = await transcribeAudio(mp3);
        await handleTextMessage(ctx, text, 'voice');
    } finally {
        fs.existsSync(oga) && fs.unlinkSync(oga);
        fs.existsSync(mp3) && fs.unlinkSync(mp3);
    }
});

/* -------------------------------------------------------------------------- */
/* CORE HANDLER                                 */
/* -------------------------------------------------------------------------- */

async function handleTextMessage(
    ctx: Context,
    text: string,
    inputType: 'text' | 'voice' = 'text'
) {
    if (!ctx.from) return;

    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    /* ---------------- Address Resolution ---------------- */

    if (
        state?.parsedCommand &&
        !state.parsedCommand.settleAddress &&
        state.parsedCommand.intent &&
        ['swap', 'checkout', 'portfolio'].includes(state.parsedCommand.intent)
    ) {
        const resolved = await resolveAddress(userId, text.trim());
        const targetChain =
            state.parsedCommand.toChain ||
            state.parsedCommand.settleNetwork ||
            state.parsedCommand.fromChain ||
            'ethereum';

        if (resolved.address && isValidAddress(resolved.address, targetChain)) {
            const updated = { ...state.parsedCommand, settleAddress: resolved.address };
            await db.setConversationState(userId, { parsedCommand: updated });

            await ctx.reply(
                `✅ Address resolved:\n\`${resolved.originalInput}\` → \`${resolved.address}\``,
                { parse_mode: 'Markdown' }
            );

            const confirmAction = updated.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap';
            return ctx.reply(
                'Ready to proceed?',
                Markup.inlineKeyboard([
                    Markup.button.callback('✅ Yes', confirmAction),
                    Markup.button.callback('❌ No', 'cancel_swap'),
                ])
            );
        }

        if (isNamingService(text)) {
            return ctx.reply(
                `❌ Could not resolve \`${text}\`. Please check the domain or try a raw address.`,
                { parse_mode: 'Markdown' }
            );
        }
    }

    /* ---------------- NLP Parsing ---------------- */

    const parsed = await parseUserCommand(text, state?.messages || [], inputType);

    if (!parsed.success) {
        const errors = (parsed as any).validationErrors?.join('\n') || '❌ I didn’t understand.';
        return ctx.replyWithMarkdown(errors);
    }

    /* ---------------- Handle Intents ---------------- */

    if (parsed.intent === 'yield_scout') {
        const yields = await getTopStablecoinYields();
        const msg = formatYieldPools(yields);
        return ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${msg}`);
    }

    if (parsed.intent === 'yield_deposit') {
        const pools = await getTopYieldPools();
        const matchingPool = pools.find((p: any) => p.symbol === parsed.fromAsset?.toUpperCase());

        if (!matchingPool) {
            return ctx.reply(`Sorry, no suitable yield pool found for ${parsed.fromAsset}. Try /yield to see options.`);
        }

        if (parsed.fromChain?.toLowerCase() !== matchingPool.chain.toLowerCase()) {
            const bridgeCommand = {
                intent: 'swap',
                fromAsset: parsed.fromAsset,
                fromChain: parsed.fromChain,
                toAsset: parsed.fromAsset,
                toChain: matchingPool.chain.toLowerCase(),
                amount: parsed.amount,
                settleAddress: null
            };
            await db.setConversationState(userId, { parsedCommand: bridgeCommand });
            return ctx.reply(`To deposit to yield on ${matchingPool.chain}, we need to bridge first. Please provide your wallet address on ${matchingPool.chain}.`);
        } else {
            const depositCommand = {
                intent: 'swap',
                fromAsset: parsed.fromAsset,
                fromChain: parsed.fromChain,
                toAsset: matchingPool.symbol,
                toChain: matchingPool.chain,
                amount: parsed.amount,
                settleAddress: null
            };
            await db.setConversationState(userId, { parsedCommand: depositCommand });
            return ctx.reply(`Ready to deposit ${parsed.amount} ${parsed.fromAsset} to yield on ${matchingPool.chain} via ${matchingPool.project}. Please provide your wallet address.`);
        }
    }

    if (parsed.intent === 'portfolio') {
        await db.setConversationState(userId, { parsedCommand: parsed });

        let msg = `📊 *Portfolio Strategy Detected*\nInput: ${parsed.amount} ${parsed.fromAsset} (${parsed.fromChain})\n\n*Allocation Plan:*\n`;
        parsed.portfolio?.forEach((item: any) => { msg += `• ${item.percentage}% → ${item.toAsset} on ${item.toChain}\n`; });

        const params = new URLSearchParams({
            mode: 'portfolio',
            data: JSON.stringify(parsed.portfolio),
            amount: parsed.amount?.toString() || '0',
            token: parsed.fromAsset || '',
            chain: parsed.fromChain || ''
        });

        const webAppUrl = `${MINI_APP_URL}?${params.toString()}`;

        return ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            Markup.button.webApp('📱 Batch Sign (Frontend)', webAppUrl),
            Markup.button.callback('❌ Cancel', 'cancel_swap')
        ]));
    }

    if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
        if (!parsed.settleAddress) {
            await db.setConversationState(userId, { parsedCommand: parsed });
            return ctx.reply(`Please provide the destination wallet address for your ${parsed.intent}.`);
        }

        await db.setConversationState(userId, { parsedCommand: parsed });
        const confirmAction = parsed.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap';

        return ctx.reply(
            'Confirm parameters?',
            Markup.inlineKeyboard([
                Markup.button.callback('✅ Yes', confirmAction),
                Markup.button.callback('❌ Cancel', 'cancel_swap'),
            ])
        );
    }
}

/* -------------------------------------------------------------------------- */
/* ACTIONS                                  */
/* -------------------------------------------------------------------------- */

bot.action('confirm_swap', async (ctx) => {
    if (!ctx.from) return;
    const state = await db.getConversationState(ctx.from.id);
    if (!state?.parsedCommand) return;

    try {
        await ctx.answerCbQuery('Fetching quote...');

        const q = await createQuote(
            state.parsedCommand.fromAsset!,
            state.parsedCommand.fromChain!,
            state.parsedCommand.toAsset || state.parsedCommand.settleAsset!,
            state.parsedCommand.toChain || state.parsedCommand.settleNetwork!,
            state.parsedCommand.amount!
        );

        await db.setConversationState(ctx.from.id, { ...state, quoteId: q.id });

        const confirmText =
            `🔄 *Quote Received*\n\n` +
            `➡️ Send: ${q.depositAmount} ${q.depositCoin}\n` +
            `⬅️ Receive: ~${q.settleAmount} ${q.settleCoin}\n` +
            `⏱️ Rate: 1 ${q.depositCoin} ≈ ${q.rate} ${q.settleCoin}`;

        await ctx.editMessageText(
            confirmText,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    Markup.button.callback('🚀 Place Order', 'place_order'),
                    Markup.button.callback('❌ Cancel', 'cancel_swap'),
                ]),
            }
        );
    } catch (e) {
        logger.error('Quote error:', e);
        ctx.reply('❌ Failed to get a quote. Please try again.');
    }
});

bot.action('confirm_checkout', async (ctx) => {
    if (!ctx.from) return;
    const state = await db.getConversationState(ctx.from.id);
    if (!state?.parsedCommand) return;

    try {
        const { settleAsset, settleNetwork, amount, settleAddress } = state.parsedCommand;

        const checkout = await createCheckout(
            settleAsset!, settleNetwork!, amount!, settleAddress!
        );

        if (!checkout || !checkout.id) throw new Error("API Error");

        db.createCheckoutEntry(ctx.from.id, checkout);

        const paymentUrl = `https://pay.sideshift.ai/checkout/${checkout.id}`;
        const msg =
            `✅ *Checkout Link Created!*\n\n` +
            `💰 *Receive:* ${checkout.settleAmount} ${checkout.settleCoin}\n` +
            `📬 *Address:* \`${checkout.settleAddress}\`\n\n` +
            `[Pay Here](${paymentUrl})`;

        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true }
        });

    } catch (e) {
        logger.error('Checkout error:', e);
        ctx.reply('❌ Failed to create checkout.');
    } finally {
        db.clearConversationState(ctx.from.id);
    }
});

bot.action('place_order', async (ctx) => {
    if (!ctx.from) return;
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.quoteId || !state.parsedCommand?.settleAddress) return;

    try {
        const order = await createOrder(
            state.quoteId,
            state.parsedCommand.settleAddress,
            state.parsedCommand.settleAddress
        );

        await db.createOrderEntry(
            userId,
            state.parsedCommand,
            order,
            order.settleAmount,
            state.quoteId
        );

        const depositAddr = (order.depositAddress as any).address || order.depositAddress;
        const memo = (order.depositAddress as any).memo;

        const msg =
            `✅ *Order Created!* (ID: \`${order.id}\`)\n\n` +
            `To complete the swap, please send funds to the address below:\n\n` +
            `🏦 *Deposit:* \`${depositAddr}\`\n` +
            `💰 *Amount:* ${order.depositAmount} ${order.depositCoin}\n` +
            (memo ? `📝 *Memo:* \`${memo}\`\n` : '') +
            `\n_Destination: ${state.parsedCommand.settleAddress}_`;

        await ctx.editMessageText(msg, { parse_mode: 'Markdown' });

    } catch (e) {
        logger.error('Place order error:', e);
        ctx.editMessageText('❌ Failed to place order.');
    } finally {
        await db.clearConversationState(userId);
    }
});

bot.action('cancel_swap', async (ctx) => {
    if (!ctx.from) return;
    await db.clearConversationState(ctx.from.id);
    ctx.editMessageText('❌ Cancelled');
});

/* -------------------------------------------------------------------------- */
/* STARTUP                                   */
/* -------------------------------------------------------------------------- */

const dcaScheduler = new DCAScheduler();

async function start() {
    try {
        if (process.env.DATABASE_URL) {
            await db.db.execute(sql`SELECT 1`);
            dcaScheduler.start();
            limitOrderWorker.start(bot);
        }

        await orderMonitor.loadPendingOrders();
        orderMonitor.start();
        logger.info('👀 Order Monitor started');

        const server = app.listen(PORT, () =>
            logger.info(`🌍 Server running on port ${PORT}`)
        );

        await bot.launch();
        logger.info('🤖 Bot launched successfully');

        const shutdown = (signal: string) => {
            logger.info(`\n${signal} received. Shutting down gracefully...`);
            dcaScheduler.stop();
            limitOrderWorker.stop();
            orderMonitor.stop();
            bot.stop(signal);
            server.close(() => {
                logger.info('Cleanup complete. Goodbye!');
                process.exit(0);
            });
        };

        process.once('SIGINT', () => shutdown('SIGINT'));
        process.once('SIGTERM', () => shutdown('SIGTERM'));

    } catch (e) {
        logger.error('Startup failed', e);
        process.exit(1);
    }
}

start();
