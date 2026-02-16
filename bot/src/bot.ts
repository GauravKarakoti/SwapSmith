import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { exec, execSync } from 'child_process';
import express from 'express';

// Services
import { transcribeAudio } from './services/groq-client';
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
import { OrderMonitor } from './services/order-monitor';
import { tokenResolver } from './services/token-resolver'; // Kept if needed by other logic, though not explicitly used below
import { chainIdMap } from './config/chains';
import { parseUserCommand } from './services/parseUserCommand';

dotenv.config();

// --- Configuration ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://swap-smith.vercel.app/';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN is missing in environment variables.");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// --- Constants ---
const DEFAULT_EVM_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const ADDRESS_PATTERNS: Record<string, RegExp> = {
    ethereum: DEFAULT_EVM_PATTERN,
    base: DEFAULT_EVM_PATTERN,
    arbitrum: DEFAULT_EVM_PATTERN,
    polygon: DEFAULT_EVM_PATTERN,
    bsc: DEFAULT_EVM_PATTERN,
    optimism: DEFAULT_EVM_PATTERN,
    bitcoin: /^(1|3|bc1)[a-zA-Z0-9]{25,39}$/,
    solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
};

// --- Helpers ---

function isValidAddress(address: string, chain?: string): boolean {
    if (!address || typeof address !== 'string') return false;
    const trimmed = address.trim();
    const normalized = chain ? chain.toLowerCase().replace(/[^a-z]/g, '') : 'ethereum';
    const pattern = ADDRESS_PATTERNS[normalized] || DEFAULT_EVM_PATTERN;
    return pattern.test(trimmed);
}

function checkFFmpeg(): Promise<void> {
    return new Promise((resolve, reject) => {
        exec('ffmpeg -version', (error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

async function logAnalytics(ctx: any, errorType: string, details: any) {
    console.error(`[Analytics] ${errorType}:`, details);
    if (ADMIN_CHAT_ID) {
        const msg = `⚠️ *Analytics Alert*\n\n*Type:* ${errorType}\n*User:* ${ctx.from?.id}\n*Input:* "${details.input}"\n*Error:* ${details.error}`;
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' }).catch(e => console.error("Failed to send admin log", e));
    }
}

// --- Order Monitor ---

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
            console.error('Order update notify failed:', e);
        }
    }
});

// --- Commands ---

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
                Markup.button.url('🌐 Visit Website', MINI_APP_URL)
            ])
        }
        message += `  *Created:* ${new Date(stakeOrder.createdAt as Date).toLocaleString()}\n`;

        ctx.replyWithMarkdown(message);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.reply(`Sorry, couldn't get status. Error: ${errorMessage}`);
    }
});

bot.command('website', (ctx) =>
bot.command('website', (ctx) => {
    ctx.reply(
        "🌐 *SwapSmith Web Interface*\n\nClick the button below to access the full graphical interface.",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.url('🚀 Open Website', MINI_APP_URL)
            ])
        }
    );
});

bot.command('yield', async (ctx) => {
    await ctx.reply('📈 Fetching top yield opportunities...');
    try {
        const yields = await getTopStablecoinYields();
        ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
    } catch (error) {
        ctx.reply("❌ Failed to fetch yields.");
    }
});

bot.command('clear', async (ctx) => {
    await db.clearConversationState(ctx.from.id);
    ctx.reply("🗑️ Conversation context cleared.");
});

// --- Message Handlers ---

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
        const file_id = ctx.message.voice.file_id;
        const link = await ctx.telegram.getFileLink(file_id);
        const res = await axios.get(link.href, { responseType: 'arraybuffer' });
        fs.writeFileSync(oga, Buffer.from(res.data));

        // Convert OGA to MP3 using ffmpeg
        await new Promise<void>((resolve, reject) => {
            const p = exec(`ffmpeg -i "${oga}" "${mp3}" -y`, (err) => {
                if (err) reject(err);
                else resolve();
            });
            // Timeout safety
            const t = setTimeout(() => {
                if (p.pid) p.kill('SIGTERM');
                reject(new Error('ffmpeg timeout'));
            }, 30000);
            p.on('exit', () => clearTimeout(t));
        });

        const transcribedText = await transcribeAudio(mp3);
        await handleTextMessage(ctx, transcribedText, 'voice');

    } catch (e) {
        console.error('Voice error:', e);
        ctx.reply('❌ Could not process audio. Please try again.');
    } finally {
        if (fs.existsSync(oga)) fs.unlinkSync(oga);
        if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
    }
});

// --- Core Logic ---

async function handleTextMessage(ctx: any, text: string, inputType: 'text' | 'voice' = 'text') {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    // 1. Check for pending address input
    if (state?.parsedCommand && (state.parsedCommand.intent === 'swap' || state.parsedCommand.intent === 'checkout') && !state.parsedCommand.settleAddress) {
        const potentialAddress = text.trim();
        // Get the target chain for validation (use toChain for swaps, settleNetwork for checkouts)
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

    // 2. Parse new command
    const history = state?.messages || [];
    await ctx.sendChatAction('typing');
    const parsed = await parseUserCommand(text, history, inputType);

    if (inputType === 'voice' && parsed.success) {
        await ctx.reply(`🗣️ *You said:* "${parsed.parsedMessage}"`, { parse_mode: 'Markdown' });
    }

    if (!parsed.success && parsed.intent !== 'yield_scout') {
        await logAnalytics(ctx, 'ValidationError', { input: text, error: parsed.validationErrors?.join(", ") });
        let errorMessage = `⚠️ ${parsed.validationErrors?.join(", ") || "I didn't understand."}`;
        if (parsed.confidence < 50) {
            errorMessage += "\n\n💡 *Suggestion:* Try rephrasing. Example: 'Swap 1 ETH to BTC'";
        }
        return ctx.replyWithMarkdown(errorMessage);
    }

    // 3. Handle Intents
    if (parsed.intent === 'yield_scout') {
        const yields = await getTopStablecoinYields();
        return ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
    }

    if (parsed.intent === 'yield_deposit') {
        // Logic to bridge/swap into a yield pool
        const pools = await getTopYieldPools();
        const matchingPool = pools.find((p: any) => p.symbol === parsed.fromAsset?.toUpperCase());

        if (!matchingPool) {
            return ctx.reply(`Sorry, no suitable yield pool found for ${parsed.fromAsset}. Try /yield to see options.`);
        }

        // Check if bridging is needed
        if (parsed.fromChain?.toLowerCase() !== matchingPool.chain.toLowerCase()) {
            const bridgeCommand = {
                intent: 'swap',
                fromAsset: parsed.fromAsset,
                fromChain: parsed.fromChain,
                toAsset: parsed.fromAsset, // Bridge same asset
                toChain: matchingPool.chain.toLowerCase(),
                amount: parsed.amount,
                settleAddress: null // Need address
            };
            await db.setConversationState(userId, { parsedCommand: bridgeCommand });
            return ctx.reply(`To deposit to yield on ${matchingPool.chain}, we need to bridge first. Please provide your wallet address on ${matchingPool.chain}.`);
        } else {
            // Logic for same-chain deposit would go here (or simplified as swap)
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
            return ctx.reply(`Okay, I see you want to ${parsed.intent}. Please provide the destination/wallet address.`);
        }

        await db.setConversationState(userId, { parsedCommand: parsed });
        const confirmAction = parsed.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap';

        ctx.reply("Confirm parameters?", Markup.inlineKeyboard([
            Markup.button.callback('✅ Yes', confirmAction),
            Markup.button.callback('❌ No', 'cancel_swap')
        ]));
    }
}

// --- Actions ---

bot.action(['confirm_swap', 'confirm_checkout'], async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.parsedCommand) return ctx.answerCbQuery('Session expired.');

    try {
        await ctx.answerCbQuery('Fetching quote...');
        
        // Use default params or what we have in state
        const q = await createQuote(
            state.parsedCommand.fromAsset!,
            state.parsedCommand.fromChain!,
            state.parsedCommand.toAsset || state.parsedCommand.settleAsset!, // Handle both swap/checkout keys
            state.parsedCommand.toChain || state.parsedCommand.settleNetwork!,
            state.parsedCommand.amount!
        );

        await db.setConversationState(userId, { ...state, quoteId: q.id });

        const confirmText = 
            `🔄 *Quote Received*\n\n` +
            `➡️ Send: ${q.depositAmount} ${q.depositCoin}\n` +
            `⬅️ Receive: ~${q.settleAmount} ${q.settleCoin}\n` +
            `⏱️ Rate: 1 ${q.depositCoin} ≈ ${q.rate} ${q.settleCoin}`;

        ctx.editMessageText(
            confirmText,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    Markup.button.callback('✅ Place Order', 'place_order'),
                    Markup.button.callback('❌ Cancel', 'cancel_swap')
                ])
            }
        );
    } catch (e) {
        console.error(e);
        ctx.reply('❌ Failed to get a quote. Please try again.');
    }
});

bot.action('place_order', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    
    if (!state?.quoteId || !state.parsedCommand?.settleAddress) {
        return ctx.answerCbQuery('Session missing required data. Start over.');
    }

    const { intent, settleAsset, settleNetwork, settleAmount, settleAddress, amount, fromAsset, fromChain } = state.parsedCommand;

    try {
        await ctx.answerCbQuery('Creating order...');

        if (intent === 'checkout') {
            // --- Checkout Flow ---
            const checkout = await createCheckout(
                settleAsset!, settleNetwork!, settleAmount!, settleAddress!, '1.1.1.1' // dummy IP
            );

            if (!checkout || !checkout.id) throw new Error("API Error");
            
            try { db.createCheckoutEntry(userId, checkout); } catch (e) { console.error(e); }

            const paymentUrl = `https://pay.sideshift.ai/checkout/${checkout.id}`;
            const checkoutMessage =
                `✅ *Checkout Link Created!*\n\n` +
                `💰 *Receive:* ${checkout.settleAmount} ${checkout.settleCoin}\n` +
                `📬 *Address:* \`${checkout.settleAddress}\`\n\n` +
                `[Pay Here](${paymentUrl})`;

            ctx.editMessageText(checkoutMessage, {
                parse_mode: 'Markdown',
                link_preview_options: { is_disabled: true }
            });

        } else {
            // --- Standard Swap Flow ---
            const order = await createOrder(state.quoteId, settleAddress, settleAddress); // refundAddress = settleAddress for simplicity
            if (!order.id) throw new Error("Failed to create order");

            db.createOrderEntry(userId, state.parsedCommand, order, order.settleAmount, state.quoteId);

            const msg =
                `✅ *Order Created!* (ID: \`${order.id}\`)\n\n` +
                `To complete the swap, please send funds to the address below:\n\n` +
                `🏦 *Deposit:* \`${(order.depositAddress as {address: string;memo: string;}).address || order.depositAddress}\`\n` +
                `💰 *Amount:* ${order.depositAmount} ${order.depositCoin}\n` +
                ((order.depositAddress as {address: string;memo: string;}).memo ? `📝 *Memo:* \`${(order.depositAddress as {address: string;memo: string;}).memo || ''}\`\n` : '') + 
                `\n_Destination: ${settleAddress}_`;

            ctx.editMessageText(msg, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        console.error(error);
        ctx.editMessageText(`❌ Error creating order.`);
    } finally {
        db.clearConversationState(userId);
    }
});

bot.action('cancel_swap', async (ctx) => {
    await db.clearConversationState(ctx.from.id);
    ctx.editMessageText('❌ Cancelled.');
});

// --- Server & Startup ---

const app = express();
app.get('/', (_, res) => res.send('SwapSmith Alive'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));

(async () => {
    try {
        await checkFFmpeg();
        console.log('✅ ffmpeg is installed. Voice messages enabled.');
    } catch {
        console.error('❌ ffmpeg not found. Voice messages may fail.');
    }

    try {
        await orderMonitor.loadPendingOrders();
        orderMonitor.start();
        console.log('👀 Order Monitor started');
    } catch (e) {
        console.error('⚠️ Failed to start order monitor:', e);
    }

    await bot.launch();
    console.log('🤖 Bot launched successfully');
})();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
