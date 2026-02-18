import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { exec } from 'child_process';
import express from 'express';
import { sql } from 'drizzle-orm';
import { ethers } from 'ethers';

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
    getTopYieldPools
} from './services/yield-client';
import * as db from './services/database';
import { chainIdMap } from './config/chains';
import { tokenResolver } from './services/token-resolver';
import { DCAScheduler } from './services/dca-scheduler';
import { resolveAddress, isNamingService } from './services/address-resolver';
import { ADDRESS_PATTERNS } from './config/address-patterns';
import { limitOrderWorker } from './workers/limitOrderWorker';
import { OrderMonitor } from './services/order-monitor';

dotenv.config();

/* -------------------------------------------------------------------------- */
/*                               GLOBAL SETUP                                 */
/* -------------------------------------------------------------------------- */

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
let isReady = false;

const bot = new Telegraf(process.env.BOT_TOKEN!);
const MINI_APP_URL = process.env.MINI_APP_URL!;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const DEFAULT_EVM_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function isValidAddress(address: string, chain?: string): boolean {
    if (!address) return false;
    const normalized = chain ? chain.toLowerCase().replace(/[^a-z]/g, '') : 'ethereum';
    const pattern = ADDRESS_PATTERNS[normalized] || DEFAULT_EVM_PATTERN;
    return pattern.test(address.trim());
}

async function logAnalytics(ctx: any, type: string, details: any) {
    logger.error(`[Analytics] ${type}`, details);
    if (!ADMIN_CHAT_ID) return;

    try {
        await bot.telegram.sendMessage(
            ADMIN_CHAT_ID,
            `⚠️ *${type}*\nUser: ${ctx.from?.id}\nInput: ${details.input}`,
            { parse_mode: 'Markdown' }
        );
    } catch {}
}

/* -------------------------------------------------------------------------- */
/*                               ORDER MONITOR                                */
/* -------------------------------------------------------------------------- */

const orderMonitor = new OrderMonitor({
    getOrderStatus,
    updateOrderStatus: db.updateOrderStatus,
    getPendingOrders: db.getPendingOrders,
    onStatusChange: async (telegramId, orderId, oldStatus, newStatus) => {
        await bot.telegram.sendMessage(
            telegramId,
            `🔔 Order *${orderId}*\n${oldStatus} → *${newStatus}*`,
            { parse_mode: 'Markdown' }
        );
    }
});

/* -------------------------------------------------------------------------- */
/*                                   COMMANDS                                 */
/* -------------------------------------------------------------------------- */

bot.start((ctx) => {
    ctx.reply(
        `🤖 *Welcome to SwapSmith!*\n\nVoice-enabled crypto trading assistant.`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.url('🌐 Open Web App', MINI_APP_URL)
            ])
        }
    );
});

bot.command('yield', async (ctx) => {
    const yields = await getTopStablecoinYields();
    ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields*\n\n${yields}`);
});

bot.command('clear', async (ctx) => {
    await db.clearConversationState(ctx.from.id);
    ctx.reply('🗑️ Conversation cleared');
});

/* -------------------------------------------------------------------------- */
/*                              MESSAGE HANDLERS                              */
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
            exec(`ffmpeg -i "${oga}" "${mp3}" -y`, (e) => e ? reject(e) : resolve())
        );

        const text = await transcribeAudio(mp3);
        await handleTextMessage(ctx, text, 'voice');
    } finally {
        fs.existsSync(oga) && fs.unlinkSync(oga);
        fs.existsSync(mp3) && fs.unlinkSync(mp3);
    }
});

/* -------------------------------------------------------------------------- */
/*                               CORE HANDLER                                 */
/* -------------------------------------------------------------------------- */

async function handleTextMessage(ctx: any, text: string, inputType: 'text' | 'voice' = 'text') {
    const parsed = await parseUserCommand(text);

    if (!parsed.success) {
        await logAnalytics(ctx, 'ParseError', { input: text });
        return ctx.reply('❌ I didn’t understand. Try: "Swap 1 ETH to BTC"');
    }

    if (parsed.intent === 'yield_scout') {
        const yields = await getTopStablecoinYields();
        return ctx.replyWithMarkdown(yields);
    }

    if (parsed.intent === 'swap') {
        await db.setConversationState(ctx.from.id, { parsedCommand: parsed });
        return ctx.reply(
            'Confirm swap?',
            Markup.inlineKeyboard([
                Markup.button.callback('✅ Yes', 'confirm_swap'),
                Markup.button.callback('❌ Cancel', 'cancel_swap')
            ])
        );
    }
}

/* -------------------------------------------------------------------------- */
/*                                   ACTIONS                                  */
/* -------------------------------------------------------------------------- */

bot.action('confirm_swap', async (ctx) => {
    const state = await db.getConversationState(ctx.from.id);
    if (!state?.parsedCommand) return;

    const q = await createQuote(
        state.parsedCommand.fromAsset,
        state.parsedCommand.fromChain,
        state.parsedCommand.toAsset,
        state.parsedCommand.toChain,
        state.parsedCommand.amount
    );

    await db.setConversationState(ctx.from.id, { ...state, quoteId: q.id });

    ctx.editMessageText(
        `🔄 *Quote*\nSend: ${q.depositAmount} ${q.depositCoin}\nReceive: ~${q.settleAmount} ${q.settleCoin}`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('🚀 Place Order', 'place_order'),
                Markup.button.callback('❌ Cancel', 'cancel_swap')
            ])
        }
    );
});

bot.action('place_order', async (ctx) => {
    const state = await db.getConversationState(ctx.from.id);
    if (!state?.quoteId || !state.parsedCommand?.settleAddress) return;

    const order = await createOrder(
        state.quoteId,
        state.parsedCommand.settleAddress,
        state.parsedCommand.settleAddress
    );

    await db.createOrderEntry(ctx.from.id, state.parsedCommand, order, order.settleAmount, state.quoteId);

    ctx.editMessageText(
        `✅ Order Created\n\nSend ${order.depositAmount} ${order.depositCoin} to:\n\`${order.depositAddress}\``,
        { parse_mode: 'Markdown' }
    );

    await db.clearConversationState(ctx.from.id);
});

bot.action('cancel_swap', async (ctx) => {
    await db.clearConversationState(ctx.from.id);
    ctx.editMessageText('❌ Cancelled');
});

/* -------------------------------------------------------------------------- */
/*                                   APIs                                     */
/* -------------------------------------------------------------------------- */

const app = express();
app.use(express.json());

// Health check
app.get('/', (_, res) => res.send('SwapSmith Alive'));

// --- DCA API Endpoints ---
app.post('/api/dca/create', async (req, res) => {
    try {
        const {
            fromAsset,
            fromChain,
            toAsset,
            toChain,
            amount,
            frequency,
            dayOfWeek,
            dayOfMonth,
            settleAddress,
        } = req.body;

        // Validate parameters
        if (!fromAsset || !toAsset || !amount || !frequency || !settleAddress) {
            return res.status(400).json({
                error: 'Missing required parameters',
            });
        }

        // Create DCA schedule (no telegram ID for web user - use 0)
        const dcaSchedule = await db.createDCASchedule(
            null,
            fromAsset,
            fromChain || 'ethereum',
            toAsset,
            toChain || 'ethereum',
            amount,
            frequency as 'daily' | 'weekly' | 'monthly',
            settleAddress,
            dayOfWeek,
            dayOfMonth
        );

        res.status(201).json({
            success: true,
            id: dcaSchedule.id,
            message: `DCA schedule created successfully`,
            data: dcaSchedule,
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        console.error('Error creating DCA schedule:', errorMessage);
        res.status(500).json({ error: errorMessage });
    }
});

// --- Limit Order API Endpoints ---
app.post('/api/limit-order/create', async (req, res) => {
    try {
        const {
            fromAsset,
            fromChain,
            toAsset,
            toChain,
            amount,
            conditionOperator,
            conditionValue,
            conditionAsset,
            settleAddress,
        } = req.body;

        // Validate parameters
        if (
            !fromAsset ||
            !toAsset ||
            !amount ||
            !conditionOperator ||
            conditionValue === undefined ||
            !conditionAsset
        ) {
            return res.status(400).json({
                error: 'Missing required parameters',
            });
        }

        // Create limit order (no telegram ID for web user - use 0)
        const limitOrder = await db.createLimitOrder(
            null,
            fromAsset,
            fromChain || 'ethereum',
            toAsset,
            toChain || 'ethereum',
            amount,
            conditionOperator as 'gt' | 'lt',
            conditionValue,
            conditionAsset,
            settleAddress
        );

        res.status(201).json({
            success: true,
            id: limitOrder.id,
            message: `Limit order created successfully`,
            data: limitOrder,
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        console.error('Error creating limit order:', errorMessage);
        res.status(500).json({ error: errorMessage });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));

app.get('/health', (_, res) => {
    if (!isReady) return res.status(503).json({ status: 'starting' });
    res.json({ status: 'ok' });
});

/* -------------------------------------------------------------------------- */
/*                                  STARTUP                                   */
/* -------------------------------------------------------------------------- */

const dcaScheduler = new DCAScheduler();

async function parseUserCommand(text: string): Promise<any> {
    // TODO: replace with real NLP
    return {
        success: true,
        intent: 'swap',
        fromAsset: 'ETH',
        fromChain: 'ethereum',
        toAsset: 'BTC',
        toChain: 'bitcoin',
        amount: 1,
        settleAddress: '0x0000000000000000000000000000000000000000'
    };
}

async function start() {
    try {
        if (process.env.DATABASE_URL) {
            await db.db.execute(sql`SELECT 1`);
            dcaScheduler.start();
            limitOrderWorker.start(bot);
        }

        await orderMonitor.loadPendingOrders();
        orderMonitor.start();

        const server = app.listen(PORT, () =>
            logger.info(`🌍 Server running on ${PORT}`)
        );

        await bot.launch();
        logger.info('🤖 Bot started');

        isReady = true;

        const shutdown = () => {
            dcaScheduler.stop();
            limitOrderWorker.stop();
            orderMonitor.stop();
            bot.stop();
            server.close(() => process.exit(0));
        };

        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);

    } catch (e) {
        logger.error('Startup failed', e);
        process.exit(1);
    }
}

start();