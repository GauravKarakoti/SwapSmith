import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { parseUserCommand, transcribeAudio } from './services/groq-client';
import { createQuote, createOrder, createCheckout, getOrderStatus } from './services/sideshift-client';
import { getTopStablecoinYields } from './services/yield-client';
import * as db from './services/database';
import { ethers } from 'ethers';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { exec } from 'child_process';
import { ethers } from 'ethers';

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
import { executePortfolioStrategy } from './services/portfolio-service';
import * as db from './services/database';
import { OrderMonitor } from './services/order-monitor';
import { tokenResolver } from './services/token-resolver';
import { chainIdMap } from './config/chains';
import { isValidAddress } from './config/address-patterns';

const bot = new Telegraf(process.env.BOT_TOKEN!);
const MINI_APP_URL = process.env.MINI_APP_URL!;
const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

const DEFAULT_EVM_PATTERN = /^0x[a-fA-F0-9]{40}$/;

// --- ERC20 CONFIGURATION ---
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)"
];

// Map of common tokens -> Address & Decimals
const TOKEN_MAP: Record<string, Record<string, { address: string, decimals: number }>> = {
    ethereum: {
        USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
        USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
        DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
        WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 }
    },
    base: {
        USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
        WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 }
    },
    arbitrum: {
        USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
        USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 }
    },
    polygon: {
        USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
        USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 }
    },
    bsc: {
        USDC: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
        USDT: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 }
    }
};

async function logAnalytics(ctx: any, errorType: string, details: any) {
    console.error(`[Analytics] ${errorType}:`, details);
    if (ADMIN_CHAT_ID) {
        const msg = `⚠️ *Analytics Alert*\n\n*Type:* ${errorType}\n*User:* ${ctx.from?.id}\n*Input:* "${details.input}"\n*Error:* ${details.error}`;
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' }).catch(e => console.error("Failed to send admin log", e));
    }
}

function isValidAddress(address: string, chain?: string): boolean {
    if (!address || typeof address !== 'string') return false;
    const trimmed = address.trim();

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
            console.error('Order update notify failed:', e);
        }
    }
});

// --------------------------------------------------
// COMMANDS
// --------------------------------------------------

bot.start((ctx) => {
    ctx.reply(
        "🤖 *Welcome to SwapSmith!*\n\n" +
        "Voice-Activated Crypto Trading Assistant.\n\n" +
        "/website – Web App\n" +
        "/yield – Top yield pools\n" +
        "/clear – Reset conversation",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.url('🌐 Website', 'https://swap-smith.vercel.app/')
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

bot.command('yield', async (ctx) => {
    await ctx.reply('📈 Fetching top yield opportunities...');
    const yields = await getTopStablecoinYields();
    ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
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

    try {
        const file_id = ctx.message.voice.file_id;
        const fileLink = await ctx.telegram.getFileLink(file_id);

        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const ogaPath = path.join(__dirname, `temp_${userId}.oga`);
        const mp3Path = path.join(__dirname, `temp_${userId}.mp3`);
        fs.writeFileSync(ogaPath, Buffer.from(response.data));
        execSync(`ffmpeg -i ${ogaPath} ${mp3Path} -y`);

        const transcribedText = await transcribeAudio(mp3Path);
        await handleTextMessage(ctx, transcribedText, 'voice');

        fs.unlinkSync(ogaPath);
        fs.unlinkSync(mp3Path);
    } catch (error) {
        console.error("Voice error:", error);
        ctx.reply("Sorry, I couldn't hear that clearly. Please try again.");
    }
});

async function handleTextMessage(ctx: any, text: string, inputType: 'text' | 'voice' = 'text') {
    const userId = ctx.from.id;

    const state = await db.getConversationState(userId);

    // 1. Check for pending address input
    if (state?.parsedCommand && (state.parsedCommand.intent === 'swap' || state.parsedCommand.intent === 'checkout') && !state.parsedCommand.settleAddress) {
        const potentialAddress = text.trim();
        // Get the target chain for validation (use toChain for swaps, settleNetwork for checkouts)
        const targetChain = state.parsedCommand.toChain || state.parsedCommand.settleNetwork;

        // Validate address format based on the target chain
        if (isValidAddress(potentialAddress, targetChain)) {
            const updatedCommand = { ...state.parsedCommand, settleAddress: potentialAddress };
            await db.setConversationState(userId, { parsedCommand: updatedCommand });

            await ctx.reply(`Address received: \`${potentialAddress}\``, { parse_mode: 'Markdown' });

            // Re-trigger the confirmation logic with the complete command
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
        await logAnalytics(ctx, 'ValidationError', { input: text, error: parsed.validationErrors.join(", ") });
        let errorMessage = `⚠️ ${parsed.validationErrors.join(", ") || "I didn't understand."}`;
        if (parsed.confidence < 50) {
            errorMessage += "\n\n💡 *Suggestion:* Try rephrasing your command. For example:\n- Instead of 'swap to BTC or USDC', say 'swap to BTC'\n- For splits: 'split 1 ETH into 50% BTC and 50% USDC'";
        }
        return ctx.replyWithMarkdown(errorMessage);
    }

    if (parsed.intent === 'yield_scout') {
        const yields = await getTopStablecoinYields();
        return ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
    }

    if (parsed.intent === 'yield_deposit') {
        // For yield_deposit, we need to swap to the yield asset on the yield chain
        // Simplified: assume user wants to deposit to the top yield pool for their fromAsset
        const { getTopYieldPools } = await import('./services/yield-client');
        const pools = await getTopYieldPools();
        const matchingPool = pools.find(p => p.symbol === parsed.fromAsset?.toUpperCase());

        if (!matchingPool) {
            return ctx.reply(`Sorry, no suitable yield pool found for ${parsed.fromAsset}. Try /yield to see options.`);
        }

        // If user is not on the yield chain, bridge via SideShift
        if (parsed.fromChain?.toLowerCase() !== matchingPool.chain.toLowerCase()) {
            // Bridge to yield chain first
            const bridgeCommand = {
                intent: 'swap',
                fromAsset: parsed.fromAsset,
                fromChain: parsed.fromChain,
                toAsset: parsed.fromAsset, // Same asset, different chain
                toChain: matchingPool.chain.toLowerCase(),
                amount: parsed.amount,
                settleAddress: null // Will ask for address
            };
            await db.setConversationState(userId, { parsedCommand: bridgeCommand });
            return ctx.reply(`To deposit to yield on ${matchingPool.chain}, we need to bridge first. Please provide your wallet address on ${matchingPool.chain}.`);
        } else {
            // Already on the right chain, proceed to swap to yield asset (simplified as swap to the stable)
            const depositCommand = {
                intent: 'swap',
                fromAsset: parsed.fromAsset,
                fromChain: parsed.fromChain,
                toAsset: matchingPool.symbol, // Swap to the yield asset
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
        parsed.portfolio?.forEach(item => { msg += `• ${item.percentage}% → ${item.toAsset} on ${item.toChain}\n`; });

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
        // 2. Handle missing address
        if (!parsed.settleAddress) {
            // Store partial state
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
        console.error('Voice error:', e);
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

    try {
        await ctx.answerCbQuery('Setting up order...');
        const destinationAddress = state.parsedCommand.settleAddress!;
        const order = await createOrder(state.quoteId, destinationAddress, destinationAddress);
        if (!order.id) throw new Error("Failed to create order");

        db.createOrderEntry(userId, state.parsedCommand, order, state.settleAmount, state.quoteId);

        const { amount, fromChain, fromAsset } = state.parsedCommand;

        // --- ERC20 Logic ---
        const rawDepositAddress = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress.address;
        const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress.memo : null;

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

        const params = new URLSearchParams({
            to: txTo,
            value: txValueHex,
            data: txData,
            chainId: chainIdMap[fromChain?.toLowerCase() || 'ethereum'] || '1',
            token: assetKey,
            chain: fromChain || 'Ethereum',
            amount: amount!.toString()
        });

    await db.setConversationState(userId, { parsedCommand: parsed });
    ctx.reply('Confirm?', Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes', parsed.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap'),
        Markup.button.callback('❌ No', 'cancel_swap')
    ]));
}

        const QV =
            `✅ *Order Created!* (ID: \`${order.id}\`)\n\n` +
            `To complete the swap, please sign the transaction in your wallet.\n\n` +
            `1. Click the button below.\n` +
            `2. Connect your wallet (MetaMask, etc).\n` +
            `3. Confirm the transaction.\n\n` +
            `_Destination: ${destinationAddress}_`;

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

    if (!state || !state.parsedCommand || state.parsedCommand.intent !== 'checkout') {
        return ctx.answerCbQuery('Start over.');
    }

    try {
        await ctx.answerCbQuery('Creating link...');
        const { settleAsset, settleNetwork, settleAmount, settleAddress } = state.parsedCommand;

        const checkout = await createCheckout(
            settleAsset!, settleNetwork!, settleAmount!, settleAddress!, '1.1.1.1'
        );

        if (!checkout || !checkout.id) throw new Error("API Error");

        try {
            db.createCheckoutEntry(userId, checkout);
        } catch (e) { console.error(e); }

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

    } catch (error) {
        console.error(error);
        ctx.editMessageText(`Error creating link.`);
    } finally {
        db.clearConversationState(userId);
    }
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
    console.log('🤖 Bot running');
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));