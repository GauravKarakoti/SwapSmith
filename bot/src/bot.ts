import { Telegraf, Markup, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { parseUserCommand, transcribeAudio } from './services/groq-client';
import { createQuote, createOrder, createCheckout, getOrderStatus } from './services/sideshift-client';
import { getTopStablecoinYields } from './services/yield-client';
import * as db from './services/database';
import { OrderMonitor } from './services/order-monitor';
import { ethers } from 'ethers';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { chainIdMap } from './config/chains';
import { tokenResolver } from './services/token-resolver';
import { DCAScheduler } from './services/dca-scheduler';
import { resolveAddress, isNamingService } from './services/address-resolver';
import { ADDRESS_PATTERNS } from './config/address-patterns';
import { limitOrderWorker } from './workers/limitOrderWorker';
import * as os from 'os';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN!);
const MINI_APP_URL = process.env.MINI_APP_URL!;
const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

// ------------------ UTIL ------------------

// --- ADDRESS VALIDATION ---
// Regex patterns for validating wallet addresses by chain type
const ADDRESS_PATTERNS: Record<string, RegExp> = {
    // EVM-compatible chains (Ethereum, BSC, Polygon, Arbitrum, Base, Avalanche, etc.)
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    bsc: /^0x[a-fA-F0-9]{40}$/,
    polygon: /^0x[a-fA-F0-9]{40}$/,
    arbitrum: /^0x[a-fA-F0-9]{40}$/,
    base: /^0x[a-fA-F0-9]{40}$/,
    avalanche: /^0x[a-fA-F0-9]{40}$/,
    optimism: /^0x[a-fA-F0-9]{40}$/,
    fantom: /^0x[a-fA-F0-9]{40}$/,
    // Bitcoin (Legacy, SegWit, Native SegWit, Taproot)
    bitcoin: /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59}|bc1p[a-zA-HJ-NP-Z0-9]{58})$/,
    // Litecoin (Legacy, SegWit)
    litecoin: /^([LM3][a-km-zA-HJ-NP-Z1-9]{26,33}|ltc1[a-zA-HJ-NP-Z0-9]{39,59})$/,
    // Solana
    solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    // Tron
    tron: /^T[a-zA-HJ-NP-Z0-9]{33}$/,
    // Ripple (XRP)
    ripple: /^r[0-9a-zA-Z]{24,34}$/,
    xrp: /^r[0-9a-zA-Z]{24,34}$/,
    // Dogecoin
    dogecoin: /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/,
    // Cosmos-based chains
    cosmos: /^cosmos[a-z0-9]{38,45}$/,
    // Polkadot
    polkadot: /^1[a-zA-Z0-9]{47}$/,
    // Cardano
    cardano: /^addr1[a-zA-Z0-9]{53,}$/,
    // Monero
    monero: /^4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/,
    // Zcash (transparent)
    zcash: /^t1[a-zA-Z0-9]{33}$/,
};

// Default EVM pattern for unknown chains
const DEFAULT_EVM_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * Validates a wallet address against the expected format for a given chain.
 * @param address - The wallet address to validate
 * @param chain - The blockchain network (e.g., 'ethereum', 'bitcoin', 'solana')
 * @returns boolean indicating if the address is valid for the specified chain
 */
function isValidAddress(address: string, chain?: string): boolean {
    if (!address || typeof address !== 'string') {
        return false;
    }

    const trimmedAddress = address.trim();

    // If no chain specified, check if it matches any known pattern
    if (!chain) {
        // Check EVM first (most common)
        if (DEFAULT_EVM_PATTERN.test(trimmedAddress)) {
            return true;
        }
        // Check other common patterns
        for (const pattern of Object.values(ADDRESS_PATTERNS)) {
            if (pattern.test(trimmedAddress)) {
                return true;
            }
        }
        return false;
    }

    // Normalize chain name
    const normalizedChain = chain.toLowerCase().replace(/[^a-z]/g, '');

    // Get the pattern for the specified chain
    const pattern = ADDRESS_PATTERNS[normalizedChain];

    if (pattern) {
        return pattern.test(trimmedAddress);
    }

    // For unknown chains, assume EVM-compatible
    return DEFAULT_EVM_PATTERN.test(trimmedAddress);
}

// ------------------ INIT ------------------

// --- ORDER MONITOR ---
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
        const message =
            `${emoji} *Order Status Update*\n\n` +
            `*Order:* \`${orderId}\`\n` +
            `*Status:* ${oldStatus} → *${newStatus.toUpperCase()}*\n` +
            (details.depositAmount ? `*Sent:* ${details.depositAmount} ${details.depositCoin}\n` : '') +
            (details.settleAmount ? `*Received:* ${details.settleAmount} ${details.settleCoin}\n` : '') +
            (details.settleHash ? `*Tx:* \`${details.settleHash.substring(0, 16)}...\`\n` : '');
        try {
            await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error(`[OrderMonitor] Failed to notify user ${telegramId}:`, err);
        }
    },
});

// --- FFMPEG CHECK ---
try {
    execSync('ffmpeg -version');
    console.log('✅ ffmpeg is installed. Voice messages enabled.');
} catch (error) {
    console.warn('⚠️ ffmpeg not found. Voice messages will fail. Please install ffmpeg.');
}

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

// ------------------ START ------------------

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

// ------------------ YIELD COMMAND ------------------

bot.command('yield', async (ctx) => {
  const pools = await getTopYieldPools();

  if (!pools || pools.length === 0) {
    return ctx.reply('No yield pools found.');
  }

  const topPools = pools.slice(0, 5);

  for (const [index, pool] of topPools.entries()) {
    await ctx.reply(
      "Pool: " + pool.project +
      "\nAsset: " + pool.symbol +
      "\nAPY: " + pool.apy + "%",
      {
        ...Markup.inlineKeyboard([
          Markup.button.callback(
            "💸 Deposit",
            `deposit_${index}`
          ),
        ]),
      }
    );
  }
});

// ------------------ MESSAGE HANDLERS ------------------

bot.on(message('text'), async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  await handleTextMessage(ctx, ctx.message.text, 'text');
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

    response.data.pipe(writer);

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

    // Cleanup
    if (fs.existsSync(tempOga)) fs.unlinkSync(tempOga);
    if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);

    if (!text) {
      return ctx.reply('❌ Could not transcribe audio. Please try again.');
    }

    ctx.reply(`🎤 *Transcribed:* "${text}"`, { parse_mode: 'Markdown' });
    await handleTextMessage(ctx, text, 'voice');

  } catch (error) {
    console.error('Voice processing error:', error);
    ctx.reply('❌ Error processing voice message.');
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
        
        // Execute ffmpeg with timeout to prevent hanging processes
        await new Promise<void>((resolve, reject) => {
            const ffmpegProcess = exec(`ffmpeg -i "${ogaPath}" "${mp3Path}" -y`, (err) => {
                if (err) reject(err);
                else resolve();
            });

            // Set a 30-second timeout for ffmpeg execution
            const timeout = setTimeout(() => {
                if (ffmpegProcess.pid) {
                    ffmpegProcess.kill('SIGTERM');
                }
                reject(new Error('ffmpeg execution timed out after 30 seconds'));
            }, 30000);

            // Clear timeout if process completes normally
            ffmpegProcess.on('exit', () => {
                clearTimeout(timeout);
            });
        });

        const transcribedText = await transcribeAudio(mp3Path);
        await handleTextMessage(ctx, transcribedText, 'voice');
    } catch (error) {
        console.error("Voice error:", error);
        const errorMessage = error instanceof Error && error.message.includes('timed out') 
            ? "Sorry, audio processing took too long. Please try a shorter message."
            : "Sorry, I couldn't hear that clearly. Please try again.";
        ctx.reply(errorMessage);
    } finally {
        // Always clean up temp files, regardless of success or failure
        try {
            if (fs.existsSync(ogaPath)) {
                fs.unlinkSync(ogaPath);
            }
            if (fs.existsSync(mp3Path)) {
                fs.unlinkSync(mp3Path);
            }
        } catch (cleanupError) {
            console.error("Failed to clean up temp files:", cleanupError);
        }
    }
});

// ------------------ ACTIONS ------------------

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
});

bot.action(/deposit_(.+)/, async (ctx) => {
  const poolId = ctx.match[1];

  await ctx.answerCbQuery();
  ctx.reply(`🚀 Starting deposit flow for pool: ${poolId}`);
});


bot.action('place_order', async (ctx) => {
  const state = await db.getConversationState(ctx.from.id);
  if (!state?.quoteId) return;

  const order = await createOrder(
    state.quoteId,
    state.parsedCommand.settleAddress,
    state.parsedCommand.settleAddress
  );

        db.createOrderEntry(userId, state.parsedCommand, order, state.settleAmount, state.quoteId);
        orderMonitor.trackOrder(order.id, userId);

        const { amount, fromChain, fromAsset } = state.parsedCommand;

        // --- ERC20 Logic ---
        const rawDepositAddress = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress.address;
        const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress.memo : null;

  ctx.editMessageText(
    `✅ *Order Created*\n\nSign transaction to complete.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.webApp(
          '📱 Sign Transaction',
          `${MINI_APP_URL}?to=${order.depositAddress}`
        ),
      ]),
    }
  );
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

        const params = new URLSearchParams({
            to: txTo,
            value: txValueHex,
            data: txData,
            chainId: chainIdMap[fromChain?.toLowerCase() || 'ethereum'] || '1',
            token: assetKey,
            chain: fromChain || 'Ethereum',
            amount: amount!.toString()
        });

        const webAppUrl = `${MINI_APP_URL}?${params.toString()}`;

        const QV =
            `✅ *Order Created!* (ID: \`${order.id}\`)\n\n` +
            `To complete the swap, please sign the transaction in your wallet.\n\n` +
            `1. Click the button below.\n` +
            `2. Connect your wallet (MetaMask, etc).\n` +
            `3. Confirm the transaction.\n\n` +
            `_Destination: ${destinationAddress}_`;

        ctx.editMessageText(QV, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.webApp('📱 Sign Transaction', webAppUrl),
                Markup.button.callback('❌ Close', 'cancel_swap')
            ])
        });

  const { fromAsset, fromChain, amount, portfolio, settleAddress } = state.parsedCommand;

  // 1. Validate Input
  if (!portfolio || portfolio.length === 0) {
    return ctx.editMessageText('❌ No portfolio allocation found.');
  }

  const totalPercentage = portfolio.reduce((sum: number, p: any) => sum + p.percentage, 0);
  if (Math.abs(totalPercentage - 100) > 1) { // Allow 1% tolerance
    return ctx.editMessageText(`❌ Portfolio percentages must sum to 100% (Current: ${totalPercentage}%)`);
  }

  if (!amount || amount <= 0) {
    return ctx.editMessageText('❌ Invalid amount.');
  }

  try {
    await ctx.answerCbQuery('Executing portfolio strategy...');
    await ctx.editMessageText('🔄 Executing portfolio swaps... This may take a moment.');

    // 2. Execute Strategy using Service
    const { successfulOrders, failedSwaps } = await executePortfolioStrategy(userId, state.parsedCommand);

    // 3. Final Response Structure
    if (successfulOrders.length === 0) {
        return ctx.editMessageText(
            `❌ *Portfolio Execution Failed*\n\n` +
            failedSwaps.map(f => `• ${f.asset}: ${f.reason}`).join('\n'),
            { parse_mode: 'Markdown' }
        );
    }

    // Store successful orders in state for signing
    await db.setConversationState(userId, {
        ...state,
        portfolioOrders: successfulOrders,
        currentTransactionIndex: 0
    });

    let summary = `✅ *Portfolio Executed*\n\n`;
    summary += `*Successful (${successfulOrders.length}):*\n`;
    successfulOrders.forEach(o => {
        summary += `• ${o.allocation.toAsset}: Order created\n`;
    });

    if (failedSwaps.length > 0) {
        summary += `\n⚠️ *Failed (${failedSwaps.length}):*\n`;
        failedSwaps.forEach(f => {
            summary += `• ${f.asset}: ${f.reason}\n`;
        });
    }

    summary += `\n📝 *Next Step:* Sign ${successfulOrders.length} transaction(s) to fund these swaps.`;

    ctx.editMessageText(summary, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            Markup.button.callback('✍️ Sign Transactions', 'sign_portfolio_transaction'),
            Markup.button.callback('❌ Close', 'cancel_swap')
        ])
    });

  } catch (error) {
    logger.error('Critical portfolio error', { userId, error });
    ctx.editMessageText(`⚠️ Critical Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
});


bot.action('confirm_migration', async (ctx) => {
  const userId = ctx.from.id;
  const state = await db.getConversationState(userId);

  if (!state?.parsedCommand || state.parsedCommand.intent !== 'yield_migrate') {
    return ctx.answerCbQuery('Session expired.');
  }

  try {
    await ctx.answerCbQuery('Preparing migration...');

    const { fromChain, toChain, fromAsset, toAsset, amount, isCrossChain } = state.parsedCommand;

    if (!isCrossChain) {
      return ctx.editMessageText(`✅ *Same-Chain Migration*\n\n` +
        `Since both pools are on the same chain, you can migrate directly:\n\n` +
        `1. Withdraw your ${fromAsset} from ${state.parsedCommand.fromProject}\n` +
        `2. Deposit to ${state.parsedCommand.toProject}\n\n` +
        `This saves on bridge fees and is instant.\n\n` +
        `Do you need a quote to swap ${fromAsset} to a different chain?`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('🔄 Find Cross-Chain Options', 'find_bridge_options'),
          Markup.button.callback('❌ Cancel', 'cancel_swap')
        ])
      });
    }

    try {
        await ctx.answerCbQuery('Creating link...');
        const { settleAsset, settleNetwork, settleAmount, settleAddress } = state.parsedCommand;

        const checkout = await createCheckout(
            settleAsset!, settleNetwork!, settleAmount!, settleAddress!, '1.1.1.1'
        );

    if (quote.error) return ctx.editMessageText(`Error: ${quote.error.message}`);

    db.setConversationState(userId, { ...state, quoteId: quote.id, settleAmount: quote.settleAmount });

    const migrationText = state.migrationSuggestion
      ? `*Yield Migration*\n\n` +
      `From: ${state.parsedCommand.fromProject} (${state.parsedCommand.fromYield}% APY)\n` +
      `To: ${state.parsedCommand.toProject} (${state.parsedCommand.toYield}% APY)\n\n`
      : '';

        const checkoutMessage =
            `✅ *Checkout Link Created!*\n\n` +
            `💰 *Receive:* ${checkout.settleAmount} ${checkout.settleCoin}\n` +
            `📬 *Address:* \`${checkout.settleAddress}\`\n\n` +
            `[Pay Here](${paymentUrl})`;

        ctx.editMessageText(checkoutMessage, {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true }
        });

bot.action('find_bridge_options', async (ctx) => {
  const userId = ctx.from.id;
  const state = await db.getConversationState(userId);

  if (!state?.migrationSuggestion) return ctx.answerCbQuery('Session expired.');

  const { fromAsset } = state.parsedCommand;
  ctx.reply('Bridge options feature pending.');
});

bot.action('sign_portfolio_transaction', async (ctx) => {
  const userId = ctx.from.id;
  const state = await db.getConversationState(userId);
  if (!state?.portfolioOrders) return ctx.answerCbQuery('Session expired.');

  const i = state.currentTransactionIndex;
  const orderData = state.portfolioOrders[i];

  if (!orderData) {
    await db.clearConversationState(userId);
    return ctx.editMessageText(`🎉 *All transactions signed!* \n\nI'll notify you as the swaps complete.`);
  }

  const { order, swapAmount, allocation } = orderData;
  const { fromAsset, fromChain } = state.parsedCommand;

  // Prepare Transaction Data
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
          // ERC20
          txTo = tokenData.address;
          const amountBigInt = ethers.parseUnits(swapAmount.toString(), tokenData.decimals);
          const iface = new ethers.Interface(ERC20_ABI);
          txData = iface.encodeFunctionData("transfer", [rawDepositAddress, amountBigInt]);
      } else {
          // Native
          // Assuming 18 decimals for simplicity if not found, but native usually is 18 (ETH, BSC, etc)
          // Ideally we need chain info. For now, defaulting to 18.
          const amountBigInt = ethers.parseUnits(swapAmount.toString(), 18);
          txValueHex = '0x' + amountBigInt.toString(16);
          if (depositMemo) txData = ethers.hexlify(ethers.toUtf8Bytes(depositMemo));
      }
  } catch (err) {
      console.error("Token resolution failed", err);
      // Fallback or alert? Proceeding with basic params.
  }

  const params = new URLSearchParams({
      to: txTo, value: txValueHex, data: txData,
      chainId: chainIdMap[chainKey] || '1',
      token: assetKey, amount: swapAmount.toString()
  });

  const isLast = i === state.portfolioOrders.length - 1;
  const buttons: any[] = [
      Markup.button.webApp(
          '📱 Sign Transaction',
          `${MINI_APP_URL}?${params.toString()}`
      )
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
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    }
  );
});

bot.action('next_portfolio_transaction', async (ctx) => {
  const state = await db.getConversationState(ctx.from.id);
  await db.setConversationState(ctx.from.id, {
    ...state,
    currentTransactionIndex: state.currentTransactionIndex + 1,
  });

  return bot.handleUpdate({
    ...ctx.update,
    callback_query: {
      ...ctx.callbackQuery,
      data: 'sign_portfolio_transaction',
    },
  } as any);
});

bot.action('cancel_swap', async (ctx) => {
  await db.clearConversationState(ctx.from.id);
  ctx.editMessageText('❌ Cancelled.');
});

const app = express();
app.get('/', (req, res) => res.send('SwapSmith Alive'));
app.listen(process.env.PORT || 3000, () => console.log(`Express server live`));

// --- STARTUP: Load pending orders and start monitoring ---
(async () => {
    await orderMonitor.loadPendingOrders();
    orderMonitor.start();
})();

bot.launch();
console.log('🤖 Bot is running...');

// --- GRACEFUL SHUTDOWN ---
const shutdown = (signal: string) => {
    console.log(`\n[${signal}] Shutting down...`);
    orderMonitor.stop();
    bot.stop(signal);
};
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
