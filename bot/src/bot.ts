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
import { executePortfolioStrategy } from './services/portfolio-service';
import * as db from './services/database';
import { OrderMonitor } from './services/order-monitor';
import { tokenResolver } from './services/token-resolver';
import { chainIdMap } from './config/chains';
import { ADDRESS_PATTERNS } from './config/address-patterns';
import { parseUserCommand } from './services/parseUserCommand';

dotenv.config();

// --------------------------------------------------
// CONFIG
// --------------------------------------------------

const bot = new Telegraf(process.env.BOT_TOKEN!);
const MINI_APP_URL = process.env.MINI_APP_URL!;
const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

const DEFAULT_EVM_PATTERN = /^0x[a-fA-F0-9]{40}$/;

// --------------------------------------------------
// UTILITIES
// --------------------------------------------------

function isValidAddress(address: string, chain?: string): boolean {
    if (!address || typeof address !== 'string') return false;
    const trimmed = address.trim();

    if (!chain) {
        if (DEFAULT_EVM_PATTERN.test(trimmed)) return true;
        return Object.values(ADDRESS_PATTERNS).some(p => p.test(trimmed));
    }

    const normalized = chain.toLowerCase().replace(/[^a-z]/g, '');
    const pattern = ADDRESS_PATTERNS[normalized as keyof typeof ADDRESS_PATTERNS];
    return pattern ? pattern.test(trimmed) : DEFAULT_EVM_PATTERN.test(trimmed);
}

// --------------------------------------------------
// ORDER MONITOR
// --------------------------------------------------

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
            (details.depositAmount ? `*Sent:* ${details.depositAmount} ${details.depositCoin}\n` : '') +
            (details.settleAmount ? `*Received:* ${details.settleAmount} ${details.settleCoin}\n` : '') +
            (details.settleHash ? `*Tx:* \`${details.settleHash.slice(0, 16)}...\`\n` : '');

        try {
            await bot.telegram.sendMessage(telegramId, msg, { parse_mode: 'Markdown' });
        } catch (e) {
            logger.error('Order update notify failed:', e);
        }

    }
});

// --------------------------------------------------
// COMMANDS
// --------------------------------------------------

bot.start((ctx) => {
            message += `  *Stake Tx:* \`${stakeOrder.stakeTxHash.slice(0, 10)}...\`\n`;
        }
        message += `  *Created:* ${new Date(stakeOrder.createdAt as Date).toLocaleString()}\n`;

        ctx.replyWithMarkdown(message);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.reply(`Sorry, couldn't get status. Error: ${errorMessage}`);
    }
});

bot.command('checkouts', async (ctx) => {
    const userId = ctx.from.id;
    const checkouts = await db.getUserCheckouts(userId);
    if (checkouts.length === 0) return ctx.reply("You have no checkout history yet.");

    let message = "Your last 10 checkouts (payment links):\n\n";
    checkouts.forEach((checkout) => {
        const paymentUrl = `https://pay.sideshift.ai/checkout/${checkout.checkoutId}`;
        message += `*Checkout ${checkout.id}* (${checkout.status})\n`;
        message += `  *Receive:* ${checkout.settleAmount} ${checkout.settleAsset} (${checkout.settleNetwork})\n`;
        message += `  *Link:* [Pay Here](${paymentUrl})\n`;
    });
    ctx.replyWithMarkdown(message, { link_preview_options: { is_disabled: true } });
});

bot.command('clear', (ctx) => {
    db.clearConversationState(ctx.from.id);
    ctx.reply('✅ Conversation history cleared.');
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
=======
bot.command('website', (ctx) =>
    ctx.reply(
        '🌐 *SwapSmith Web Interface*',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.url('🚀 Open', 'https://swap-smith.vercel.app/')
            ])
        }
    )
);
>>>>>>> c19f0ad6b5c3090a6f87c7d0b1f436493d9f85aa

bot.command('yield', async (ctx) => {
    try {
        await ctx.reply('📈 Fetching yield data...');
        const stable = await getTopStablecoinYields();
        await ctx.replyWithMarkdown(`📊 *Top Stablecoin Yields*\n\n${stable}`);

        const pools = (await getTopYieldPools()).slice(0, 3);
        for (const pool of pools) {
            await ctx.reply(
                `*${pool.project}*\nAsset: ${pool.symbol}\nAPY: ${pool.apy}%`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        Markup.button.callback('💸 Deposit', `deposit_${pool.project}_${pool.symbol}`)
                    ])
                }
            );
        }
    } catch {
        ctx.reply('❌ Failed to fetch yields.');
    }
});

bot.command('clear', async (ctx) => {
    await db.clearConversationState(ctx.from.id);
    ctx.reply('🧹 Conversation cleared.');
});

// --------------------------------------------------
// MESSAGE HANDLERS (ONLY ONE EACH)
// --------------------------------------------------

bot.on(message('text'), async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    await handleTextMessage(ctx, ctx.message.text, 'text');
});

bot.on(message('voice'), async (ctx) => {
    const userId = ctx.from.id;
    await ctx.reply('👂 Listening...');

    const timestamp = Date.now();
    const tempDir = os.tmpdir();
    const oga = path.join(tempDir, `voice_${userId}_${timestamp}.oga`);
    const mp3 = path.join(tempDir, `voice_${userId}_${timestamp}.mp3`);

    try {
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
        const res = await axios.get(link.href, { responseType: 'arraybuffer' });
        fs.writeFileSync(oga, Buffer.from(res.data));

        await new Promise<void>((resolve, reject) => {
            const p = exec(`ffmpeg -i "${oga}" "${mp3}" -y`, err => err ? reject(err) : resolve());
            const t = setTimeout(() => {
                if (p.pid) p.kill('SIGTERM');
                reject(new Error('ffmpeg timeout'));
            }, 30000);
            p.on('exit', () => clearTimeout(t));
        });

        const text = await transcribeAudio(mp3);
        await handleTextMessage(ctx, text, 'voice');

    } catch (e) {
        logger.error('Voice error:', e);
        ctx.reply('❌ Could not process audio.');

    } finally {
        if (fs.existsSync(oga)) fs.unlinkSync(oga);
        if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
    }
});

// --------------------------------------------------
// CORE LOGIC
// --------------------------------------------------

async function handleTextMessage(ctx: any, text: string, inputType: 'text' | 'voice') {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    if (
        state?.parsedCommand &&
        (state.parsedCommand.intent === 'swap' || state.parsedCommand.intent === 'checkout') &&
        !state.parsedCommand.settleAddress
    ) {
        if (!isValidAddress(text, state.parsedCommand.toChain)) {
            return ctx.reply('❌ Invalid address.');
        }

        const updated = { ...state.parsedCommand, settleAddress: text.trim() };
        await db.setConversationState(userId, { parsedCommand: updated });

        return ctx.reply(
            'Confirm?',
            Markup.inlineKeyboard([
                Markup.button.callback('✅ Yes', updated.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap'),
                Markup.button.callback('❌ No', 'cancel_swap')
            ])
        );
    }

    const history = state?.messages || [];
    const parsed = await parseUserCommand(text, history, inputType);

    if (!parsed.success) {
        return ctx.reply(`⚠️ ${parsed.validationErrors.join(', ') || 'Could not understand.'}`);
    }

    await db.setConversationState(userId, { parsedCommand: parsed });
    ctx.reply('Confirm?', Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes', parsed.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap'),
        Markup.button.callback('❌ No', 'cancel_swap')
    ]));
}

// --------------------------------------------------
// ACTIONS
// --------------------------------------------------

bot.action('confirm_swap', async (ctx) => {
    const state = await db.getConversationState(ctx.from.id);
    if (!state?.parsedCommand) return;

    const q = await createQuote(
        state.parsedCommand.fromAsset!,
        state.parsedCommand.fromChain!,
        state.parsedCommand.toAsset!,
        state.parsedCommand.toChain!,
        state.parsedCommand.amount!
    );

    await db.setConversationState(ctx.from.id, { ...state, quoteId: q.id });

    ctx.editMessageText(
        `➡️ Send ${q.depositAmount} ${q.depositCoin}\n⬅️ Receive ${q.settleAmount} ${q.settleCoin}`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('✅ Place Order', 'place_order'),
                Markup.button.callback('❌ Cancel', 'cancel_swap')
            ])
        }
    );
});

bot.action('place_order', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.quoteId || !state.parsedCommand?.settleAddress) return;

    const order = await createOrder(
        state.quoteId,
        state.parsedCommand.settleAddress,
        state.parsedCommand.settleAddress
    );

    await db.createOrderEntry(userId, state.parsedCommand, order, state.settleAmount!, state.quoteId);
    orderMonitor.trackOrder(order.id, userId);

    ctx.editMessageText(
        `✅ *Order Created*\nID: \`${order.id}\``,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.webApp(
                    '📱 Sign Transaction',
                    `${MINI_APP_URL}?to=${typeof order.depositAddress === 'string'
                        ? order.depositAddress
                        : order.depositAddress.address}`
                )
            ])
        }
    );
});

bot.action('cancel_swap', async (ctx) => {
    await db.clearConversationState(ctx.from.id);
    ctx.editMessageText('❌ Cancelled.');
});

// --------------------------------------------------
// SERVER + STARTUP
// --------------------------------------------------

const app = express();
app.get('/', (_, res) => res.send('SwapSmith Alive'));
app.listen(process.env.PORT || 3000);

(async () => {
    await orderMonitor.loadPendingOrders();
    orderMonitor.start();
    bot.launch();
    logger.info('🤖 Bot running');
})();


process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
