import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { parseUserCommand, transcribeAudio } from './services/groq-client';
import { createQuote, createOrder, createCheckout, getOrderStatus } from './services/sideshift-client';
import { getTopStablecoinYields, getTopYieldPools, suggestMigration, findHigherYieldPools, formatMigrationMessage, MigrationSuggestion } from './services/yield-client';
import * as db from './services/database';
import { startLimitOrderWorker } from './workers/limitOrderWorker';
import { parseLimitOrder } from './utils/parseLimitOrder';
import { ethers } from 'ethers';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import express from 'express';
import { chainIdMap } from './config/chains';
import { handleError } from './services/logger';
import { tokenResolver } from './services/token-resolver';
import { OrderMonitor } from './services/order-monitor';

dotenv.config();
const MINI_APP_URL = process.env.MINI_APP_URL!;
const bot = new Telegraf(process.env.BOT_TOKEN!);

// Start Limit Order Worker
startLimitOrderWorker(bot);

// --- FFMPEG CHECK ---
try {
    execSync('ffmpeg -version');
    console.log('✅ ffmpeg is installed. Voice messages enabled.');
} catch (error) {
    console.warn('⚠️ ffmpeg not found. Voice messages will fail. Please install ffmpeg.');
// Initialize order monitor
const orderMonitor = new OrderMonitor(bot);

// --- ADDRESS VALIDATION PATTERNS ---
const ADDRESS_PATTERNS: Record<string, RegExp> = {
  // EVM chains
  ethereum: /^0x[a-fA-F0-9]{40}$/,
  base: /^0x[a-fA-F0-9]{40}$/,
  arbitrum: /^0x[a-fA-F0-9]{40}$/,
  polygon: /^0x[a-fA-F0-9]{40}$/,
  bsc: /^0x[a-fA-F0-9]{40}$/,
  optimism: /^0x[a-fA-F0-9]{40}$/,
  avalanche: /^0x[a-fA-F0-9]{40}$/,
  fantom: /^0x[a-fA-F0-9]{40}$/,
  cronos: /^0x[a-fA-F0-9]{40}$/,
  moonbeam: /^0x[a-fA-F0-9]{40}$/,
  moonriver: /^0x[a-fA-F0-9]{40}$/,
  celo: /^0x[a-fA-F0-9]{40}$/,
  gnosis: /^0x[a-fA-F0-9]{40}$/,
  harmony: /^0x[a-fA-F0-9]{40}$/,
  metis: /^0x[a-fA-F0-9]{40}$/,
  aurora: /^0x[a-fA-F0-9]{40}$/,
  kava: /^0x[a-fA-F0-9]{40}$/,
  evmos: /^0x[a-fA-F0-9]{40}$/,
  boba: /^0x[a-fA-F0-9]{40}$/,
  okc: /^0x[a-fA-F0-9]{40}$/,
  heco: /^0x[a-fA-F0-9]{40}$/,
  iotex: /^0x[a-fA-F0-9]{40}$/,
  klaytn: /^0x[a-fA-F0-9]{40}$/,
  conflux: /^0x[a-fA-F0-9]{40}$/,
  astar: /^0x[a-fA-F0-9]{40}$/,
  shiden: /^0x[a-fA-F0-9]{40}$/,
  telos: /^0x[a-fA-F0-9]{40}$/,
  fuse: /^0x[a-fA-F0-9]{40}$/,
  velas: /^0x[a-fA-F0-9]{40}$/,
  thundercore: /^0x[a-fA-F0-9]{40}$/,
  xdc: /^xdc[a-fA-F0-9]{40}$/,
  nahmii: /^0x[a-fA-F0-9]{40}$/,
  callisto: /^0x[a-fA-F0-9]{40}$/,
  smartbch: /^0x[a-fA-F0-9]{40}$/,
  energyweb: /^0x[a-fA-F0-9]{40}$/,
  theta: /^0x[a-fA-F0-9]{40}$/,
  flare: /^0x[a-fA-F0-9]{40}$/,
  songbird: /^0x[a-fA-F0-9]{40}$/,
  coston: /^0x[a-fA-F0-9]{40}$/,
  coston2: /^0x[a-fA-F0-9]{40}$/,
  rei: /^0x[a-fA-F0-9]{40}$/,
  kekchain: /^0x[a-fA-F0-9]{40}$/,
  tomochain: /^0x[a-fA-F0-9]{40}$/,
  bitgert: /^0x[a-fA-F0-9]{40}$/,
  clover: /^0x[a-fA-F0-9]{40}$/,
  defichain: /^0x[a-fA-F0-9]{40}$/,
  findora: /^0x[a-fA-F0-9]{40}$/,
  gatechain: /^0x[a-fA-F0-9]{40}$/,
  meter: /^0x[a-fA-F0-9]{40}$/,
  nova: /^0x[a-fA-F0-9]{40}$/,
  syscoin: /^0x[a-fA-F0-9]{40}$/,
  zksync: /^0x[a-fA-F0-9]{40}$/,
  polygonzkevm: /^0x[a-fA-F0-9]{40}$/,
  linea: /^0x[a-fA-F0-9]{40}$/,
  mantle: /^0x[a-fA-F0-9]{40}$/,
  scroll: /^0x[a-fA-F0-9]{40}$/,
  taiko: /^0x[a-fA-F0-9]{40}$/,
  bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  polkadot: /^1[a-zA-Z0-9]{47}$/,
  cardano: /^addr1[a-z0-9]{98}$|^Ae2tdPwUPEZ[a-zA-Z0-9]{50}$/,
  monero: /^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/,
  litecoin: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
  dogecoin: /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{24,33}$/,
  dash: /^X[1-9A-HJ-NP-Za-km-z]{33}$/,
  zcash: /^t1[a-zA-Z0-9]{33}$|^t3[a-zA-Z0-9]{33}$/,
  ripple: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  stellar: /^G[A-Z0-9]{55}$/,
  cosmos: /^cosmos1[a-z0-9]{38}$/,
  osmosis: /^osmo1[a-z0-9]{38}$/,
  terra: /^terra1[a-z0-9]{38}$/,
  tron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  tezos: /^tz[1-3][a-zA-Z0-9]{33}$/,
  algorand: /^[A-Z0-9]{58}$/,
  near: /^[a-z0-9_-]{2,64}\.near$|^[a-fA-F0-9]{64}$/,
  flow: /^0x[a-fA-F0-9]{16}$/,
  hedera: /^0\.0\.\d+$/,
  elrond: /^erd1[a-z0-9]{58}$/,
  kusama: /^[A-Z0-9]{47}$/,
  rsk: /^0x[a-fA-F0-9]{40}$/,
  waves: /^3P[a-zA-Z0-9]{33}$/,
  zilliqa: /^zil1[a-z0-9]{38}$/,
};

function isValidAddress(address: string, chain?: string): boolean {
  if (!address) return false;
  const targetChain = chain?.toLowerCase() || 'ethereum';
  const pattern = ADDRESS_PATTERNS[targetChain] || ADDRESS_PATTERNS.ethereum;
  return pattern.test(address.trim());
}

// --- FFMPEG CHECK ---
// --- FFMPEG CHECK (non-blocking, correct) ---
exec('ffmpeg -version', (error) => {
    if (error) {
        console.warn('⚠️ ffmpeg not found. Voice messages will fail. Please install ffmpeg.');
    } else {
        console.log('✅ ffmpeg is installed. Voice messages enabled.');
    }
});


// --- ERC20 CONFIGURATION ---
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)"
];

async function logAnalytics(ctx: any, errorType: string, details: any) {
    await handleError(errorType, details, ctx, true);
}

// --- COMMANDS ---

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
        "/watch [id] - Watch order for completion\n" +
        "/unwatch [id] - Stop watching order\n" +
        "/watching - List watched orders\n" +
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

bot.command('history', async (ctx) => {
    const userId = ctx.from.id;
    const orders = await db.getUserHistory(userId);

    if (orders.length === 0) return ctx.reply("You have no order history yet.");

    let message = "Your last 10 orders:\n\n";
    orders.forEach((order) => {
        message += `*Order ${order.sideshiftOrderId}* (${order.status})\n`;
        message += `  *Send:* ${order.fromAmount} ${order.fromAsset} (${order.fromNetwork})\n`;
        message += `  *Rcv:* ~${order.settleAmount} ${order.toAsset} (${order.toNetwork})\n`;
        message += `  *To:* \`${order.depositAddress}\`\n`;
        if (order.txHash) message += `  *TxHash:* \`${order.txHash.substring(0, 10)}...\`\n`;
        message += `  *Date:* ${new Date(order.createdAt as Date).toLocaleString()}\n\n`;
    });
    ctx.replyWithMarkdown(message);
});

bot.command('status', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    let orderIdToCheck: string | null = args[1];

    try {
        if (!orderIdToCheck) {
            const lastOrder = await db.getLatestUserOrder(userId);
            if (!lastOrder) return ctx.reply("You have no order history to check. Send a swap first.");
            orderIdToCheck = lastOrder.sideshiftOrderId;
            await ctx.reply(`Checking status of your latest order: \`${orderIdToCheck}\``);
        }

        await ctx.reply(`⏳ Checking status...`);
        const status = await getOrderStatus(orderIdToCheck);
        db.updateOrderStatus(orderIdToCheck, status.status);

        let message = `*Order Status: ${status.id}*\n\n`;
        message += `  *Status:* \`${status.status.toUpperCase()}\`\n`;
        message += `  *Send:* ${status.depositAmount || '?'} ${status.depositCoin} (${status.depositNetwork})\n`;
        message += `  *Receive:* ${status.settleAmount || '?'} ${status.settleCoin} (${status.settleNetwork})\n`;
        message += `  *Created:* ${new Date(status.createdAt).toLocaleString()}\n`;

        ctx.replyWithMarkdown(message);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.reply(`Sorry, couldn't get status. Error: ${errorMessage}`);
    }
});

bot.command('watch', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    let orderIdToWatch: string | null = args[1];

    try {
        if (!orderIdToWatch) {
            const lastOrder = await db.getLatestUserOrder(userId);
            if (!lastOrder) return ctx.reply("You have no order history to watch. Send a swap first.");
            orderIdToWatch = lastOrder.sideshiftOrderId;
        }

        // Check if order exists and get its current status
        await ctx.reply(`⏳ Setting up watch for order \`${orderIdToWatch}\`...`, { parse_mode: 'Markdown' });
        const status = await getOrderStatus(orderIdToWatch);
        
        // Check if already completed
        if (status.status.toLowerCase() === 'settled' || status.status.toLowerCase() === 'refunded') {
            return ctx.reply(`⚠️ Order \`${orderIdToWatch}\` is already ${status.status}. No need to watch.`, { parse_mode: 'Markdown' });
        }

        // Add to watch list
        await db.addWatchedOrder(userId, orderIdToWatch, status.status);
        
        let message = `✅ *Now watching order:* \`${orderIdToWatch}\`\n\n`;
        message += `*Current Status:* \`${status.status.toUpperCase()}\`\n`;
        message += `*Send:* ${status.depositAmount || '?'} ${status.depositCoin} (${status.depositNetwork})\n`;
        message += `*Receive:* ${status.settleAmount || '?'} ${status.settleCoin} (${status.settleNetwork})\n\n`;
        message += `🔔 I'll notify you when the status changes or when it's completed!`;

        ctx.replyWithMarkdown(message);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.reply(`Sorry, couldn't watch order. Error: ${errorMessage}`);
    }
});

bot.command('unwatch', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    let orderIdToUnwatch: string | null = args[1];

    try {
        if (!orderIdToUnwatch) {
            const watchedOrders = await db.getUserWatchedOrders(userId);
            if (watchedOrders.length === 0) {
                return ctx.reply("You have no watched orders.");
            }
            orderIdToUnwatch = watchedOrders[0].sideshiftOrderId;
        }

        await db.removeWatchedOrder(orderIdToUnwatch);
        ctx.reply(`✅ Stopped watching order \`${orderIdToUnwatch}\``, { parse_mode: 'Markdown' });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.reply(`Sorry, couldn't unwatch order. Error: ${errorMessage}`);
    }
});

bot.command('watching', async (ctx) => {
    const userId = ctx.from.id;
    
    try {
        const watchedOrders = await db.getUserWatchedOrders(userId);
        
        if (watchedOrders.length === 0) {
            return ctx.reply("You are not watching any orders.\n\nUse /watch [order_id] to start monitoring an order.");
        }

        let message = `🔍 *Your Watched Orders:*\n\n`;
        
        for (const watched of watchedOrders) {
            message += `*Order:* \`${watched.sideshiftOrderId}\`\n`;
            message += `  *Status:* \`${watched.lastStatus.toUpperCase()}\`\n`;
            message += `  *Last Checked:* ${new Date(watched.lastChecked as Date).toLocaleString()}\n\n`;
        }
        
        message += `💡 Use /unwatch [order_id] to stop watching an order.`;
        
        ctx.replyWithMarkdown(message);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.reply(`Sorry, couldn't fetch watched orders. Error: ${errorMessage}`);
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

bot.command('yield', async (ctx) => {
    await ctx.reply('📈 Fetching top yield opportunities...');
    const yields = await getTopStablecoinYields();
    ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
});

bot.command('migrate', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const userId = ctx.from.id;

    if (args.length < 1) {
        return ctx.replyWithMarkdown(
            `*Yield Migration Command*\n\n` +
            `Usage: /migrate <asset> [chain] [current_project]\n\n` +
            `Examples:\n` +
            `• /migrate USDC\n` +
            `• /migrate USDC base\n` +
            `• /migrate USDC base aave\n\n` +
            `This will find higher-yielding pools and suggest a migration.`
        );
    }

    await ctx.reply('🔍 Analyzing yield opportunities...');

    const asset = args[0];
    const chain = args[1] || null;
    const project = args[2] || null;
    const amount = 10000;

    const suggestion = await suggestMigration(asset, chain || undefined, project || undefined, amount);

    if (!suggestion) {
        const higherPools = await findHigherYieldPools(asset, chain || undefined);
        if (higherPools.length === 0) {
            return ctx.reply(`No higher-yielding pools found for ${asset}.`);
        }
        return ctx.replyWithMarkdown(
            `*Higher Yield Options for ${asset}:*\n\n` +
            higherPools.slice(0, 3).map(p =>
                `• ${p.symbol} on ${p.chain} via ${p.project}: *${p.apy.toFixed(2)}% APY*`
            ).join('\n')
        );
    }

    const message = formatMigrationMessage(suggestion, amount);
    const isCrossChain = suggestion.isCrossChain;

    const migrationCommand = {
        intent: 'yield_migrate',
        fromAsset: suggestion.fromPool.symbol,
        fromChain: suggestion.fromPool.chain.toLowerCase(),
        toAsset: suggestion.toPool.symbol,
        toChain: suggestion.toPool.chain.toLowerCase(),
        amount: amount,
        fromProject: suggestion.fromPool.project,
        toProject: suggestion.toPool.project,
        fromYield: suggestion.fromPool.apy,
        toYield: suggestion.toPool.apy,
        isCrossChain
    };

    await db.setConversationState(userId, { parsedCommand: migrationCommand, migrationSuggestion: suggestion });

    if (isCrossChain) {
        ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
            Markup.button.callback('✅ Migrate', 'confirm_migration'),
            Markup.button.callback('❌ Cancel', 'cancel_swap'),
            Markup.button.callback('🔄 See Alternatives', 'see_alternatives')
        ]));
    } else {
        ctx.replyWithMarkdown(message + `\n\n*Same-chain: Deposit directly to save fees.*`, Markup.inlineKeyboard([
            Markup.button.callback('📖 Show Deposit Instructions', 'show_deposit_instructions'),
            Markup.button.callback('🔄 See Alternatives', 'see_alternatives'),
            Markup.button.callback('❌ Cancel', 'cancel_swap')
        ]));
    }
});

bot.command('add_address', async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ').slice(1);

  if (args.length < 3) {
    return ctx.reply("Usage: /add_address <nickname> <address> <chain>\nExample: /add_address mywallet 0x123... ethereum");
  }

  const [nickname, address, chain] = args;

  try {
    await db.addAddressBookEntry(userId, nickname, address, chain);
    ctx.reply(`✅ Added "${nickname}" → \`${address}\` on ${chain}`, { parse_mode: 'Markdown' });
  } catch (error) {
    ctx.reply("❌ Failed to add address. It might already exist.");
  }
});

bot.command('list_addresses', async (ctx) => {
  const userId = ctx.from.id;
  const addresses = await db.getAddressBookEntries(userId);

  if (addresses.length === 0) {
    return ctx.reply("You have no saved addresses. Use /add_address to add some.");
  }

  let message = "📖 *Your Address Book:*\n\n";
  addresses.forEach((entry) => {
    message += `• **${entry.nickname}**: \`${entry.address}\` (${entry.chain})\n`;
  });

  ctx.replyWithMarkdown(message);
});

// --- MESSAGE HANDLERS ---

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
        // execSync(`ffmpeg -i ${ogaPath} ${mp3Path} -y`);
        await new Promise<void>((resolve, reject) => {
         exec(`ffmpeg -i "${ogaPath}" "${mp3Path}" -y`, (err) => {
           if (err) reject(err);
           else resolve();
         });
        });


        const transcribedText = await transcribeAudio(mp3Path);
        await handleTextMessage(ctx, transcribedText, 'voice');

        fs.unlinkSync(ogaPath);
        fs.unlinkSync(mp3Path);
    } catch (error) {
        console.error("Voice error:", error);
        ctx.reply("Sorry, I couldn't hear that clearly. Please try again.");
    }
});

function inferNetwork(asset: string): string {
  const map: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'USDT': 'ethereum',
    'USDC': 'ethereum',
    'DAI': 'ethereum',
    'WBTC': 'ethereum',
    'BNB': 'bsc',
    'AVAX': 'avalanche',
    'MATIC': 'polygon',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'BASE': 'base'
  };
  return map[asset?.toUpperCase()] || 'ethereum';
}

async function handleTextMessage(ctx: any, text: string, inputType: 'text' | 'voice' = 'text') {
  const userId = ctx.from.id;

  // NEW: Check for limit order pattern first
  const limitOrder = parseLimitOrder(text);
  if (limitOrder.success) {
      await db.setConversationState(userId, {
          intent: 'limit_order',
          data: limitOrder,
          step: 'awaiting_address'
      });

      return ctx.reply(
          `👍 I understood: Swap ${limitOrder.amount} ${limitOrder.fromAsset} for ${limitOrder.toAsset} ` +
          `if ${limitOrder.conditionAsset || limitOrder.toAsset} is ${limitOrder.conditionType} $${limitOrder.targetPrice}.\n\n` +
          `Please enter the destination ${limitOrder.toAsset} wallet address:`
      );
  }
  
  const state = await db.getConversationState(userId); 

  // Check if we are in 'limit_order' flow
  if (state?.intent === 'limit_order' && state.step === 'awaiting_address') {
      const address = text.trim();
      if (address.length < 10) return ctx.reply("Address too short. Please try again or /clear.");

      const orderData = state.data;
      const fromNetwork = inferNetwork(orderData.fromAsset);
      const toNetwork = inferNetwork(orderData.toAsset);

      await db.createLimitOrder({
          telegramId: userId,
          fromAsset: orderData.fromAsset,
          toAsset: orderData.toAsset,
          fromNetwork: fromNetwork,
          toNetwork: toNetwork,
          amount: orderData.amount,
          conditionAsset: orderData.conditionAsset || orderData.toAsset,
          conditionType: orderData.conditionType,
          targetPrice: orderData.targetPrice,
          settleAddress: address
      });

      await db.clearConversationState(userId);
      return ctx.reply(`✅ Limit Order Created! I'll watch the price for you.`);
  }
  
  // 1. Check for pending address input
  if (state?.parsedCommand && (state.parsedCommand.intent === 'swap' || state.parsedCommand.intent === 'checkout') && !state.parsedCommand.settleAddress) {
      const potentialAddress = text.trim();
      // Basic address validation (can be improved)
      if (potentialAddress.length > 25) { // Arbitrary length check for now
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
          return ctx.reply("That doesn't look like a valid address. Please try again or /clear to cancel.");
      }
  }
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    if (state?.parsedCommand && (state.parsedCommand.intent === 'swap' || state.parsedCommand.intent === 'checkout' || state.parsedCommand.intent === 'portfolio') && !state.parsedCommand.settleAddress) {
        const potentialAddress = text.trim();
        const targetChain = state.parsedCommand.toChain || state.parsedCommand.settleNetwork || state.parsedCommand.fromChain;

        if (isValidAddress(potentialAddress, targetChain)) {
            const updatedCommand = { ...state.parsedCommand, settleAddress: potentialAddress };
            await db.setConversationState(userId, { parsedCommand: updatedCommand });
            await ctx.reply(`Address received: \`${potentialAddress}\``, { parse_mode: 'Markdown' });

            const confirmAction = updatedCommand.intent === 'checkout' ? 'confirm_checkout' : updatedCommand.intent === 'portfolio' ? 'confirm_portfolio' : 'confirm_swap';
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
        
        console.log('📱 Bot received parsed command:');
        console.log('Success:', parsed.success);
        console.log('Intent:', parsed.intent);
        console.log('Validation Errors:', parsed.validationErrors);
        console.log('Parsed Message:', parsed.parsedMessage);
        
        // Filter out generic messages and show contextual help
        const contextualErrors = parsed.validationErrors.filter(err => 
            err.includes('💡') || err.includes('How much') || err.includes('Which asset') || err.includes('Example:')
        );
        
        const otherErrors = parsed.validationErrors.filter(err => 
            !err.includes('💡') && !err.includes('How much') && !err.includes('Which asset') && !err.includes('Example:')
        );
        
        console.log('Contextual Errors:', contextualErrors);
        console.log('Other Errors:', otherErrors);
        
        let errorMessage = '';
        if (otherErrors.length > 0) {
            errorMessage = `⚠️ ${otherErrors.join(", ")}\n\n`;
        }
        
        if (contextualErrors.length > 0) {
            errorMessage += contextualErrors.join("\n\n");
        } else if (errorMessage === '') {
            errorMessage = `⚠️ I didn't understand.`;
        }
        
        console.log('Final Error Message:', errorMessage);
        
        return ctx.replyWithMarkdown(errorMessage);
    }

    if (parsed.intent === 'yield_scout') {
        const yields = await getTopStablecoinYields();
        return ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
    }

    if (parsed.intent === 'yield_deposit') {
        const pools = await getTopYieldPools();
        const matchingPool = pools.find(p => p.symbol === parsed.fromAsset?.toUpperCase());
        if (!matchingPool) return ctx.reply(`Sorry, no suitable yield pool found for ${parsed.fromAsset}. Try /yield.`);

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
            return ctx.reply(`Ready to deposit ${parsed.amount} ${parsed.fromAsset} to yield on ${matchingPool.chain} via ${matchingPool.project}. Please provide your address.`);
        }
    }

    if (parsed.intent === 'yield_migrate') {
        await ctx.sendChatAction('typing');
        await ctx.reply('🔍 Analyzing yield migration opportunities...');

        const suggestion = await suggestMigration(
            parsed.fromAsset!,
            parsed.fromChain || undefined,
            parsed.fromProject || undefined,
            parsed.amount || 10000
        );

        if (!suggestion) {
            const higherPools = await findHigherYieldPools(parsed.fromAsset!, parsed.fromChain || undefined, parsed.fromYield || 0);
            if (higherPools.length === 0) {
                return ctx.reply(`No higher-yielding pools found for ${parsed.fromAsset}.`);
            }

            let message = `*Higher Yield Options for ${parsed.fromAsset}:*\n\n`;
            higherPools.slice(0, 5).forEach((p, i) => {
                message += `${i + 1}. ${p.symbol} on ${p.chain} via ${p.project}: *${p.apy.toFixed(2)}% APY*\n`;
            });

            return ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
                Markup.button.callback('🔄 Refresh', 'refresh_yields'),
                Markup.button.callback('❌ Cancel', 'cancel_swap')
            ]));
        }

        const message = formatMigrationMessage(suggestion, parsed.amount || 10000);

        const isCrossChain = suggestion.isCrossChain;

        const migrationCommand = {
            ...parsed,
            intent: 'yield_migrate',
            fromProject: suggestion.fromPool.project,
            toProject: suggestion.toPool.project,
            fromYield: suggestion.fromPool.apy,
            toYield: suggestion.toPool.apy,
            toChain: suggestion.toPool.chain.toLowerCase(),
            toAsset: suggestion.toPool.symbol,
            isCrossChain
        };

        await db.setConversationState(userId, { parsedCommand: migrationCommand, migrationSuggestion: suggestion });

        if (isCrossChain) {
            return ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
                Markup.button.callback('✅ Migrate', 'confirm_migration'),
                Markup.button.callback('🔄 See Alternatives', 'see_alternatives'),
                Markup.button.callback('❌ Cancel', 'cancel_swap')
            ]));
        } else {
            return ctx.replyWithMarkdown(message + `\n\n*Same-chain migration: Deposit directly to the new protocol.*`, Markup.inlineKeyboard([
                Markup.button.callback('📖 Show Deposit Instructions', 'show_deposit_instructions'),
                Markup.button.callback('🔄 See Alternatives', 'see_alternatives'),
                Markup.button.callback('❌ Cancel', 'cancel_swap')
            ]));
        }
    }

    if ((parsed as any).intent === 'refresh_yields') {
        await ctx.sendChatAction('typing');
        return ctx.reply('🔄 Use /migrate <asset> to find the best yields.');
    }

    if (parsed.intent === 'portfolio') {
        if (!parsed.settleAddress) {
            await db.setConversationState(userId, { parsedCommand: parsed });
            let msg = `📊 *Portfolio Strategy Detected*\nInput: ${parsed.amount} ${parsed.fromAsset}\n\n*Allocation Plan:*\n`;
            parsed.portfolio?.forEach(item => { msg += `• ${item.percentage}% → ${item.toAsset} on ${item.toChain}\n`; });
            msg += `\nPlease provide your destination wallet address to receive the assets.`;
            return ctx.replyWithMarkdown(msg);
        }

        await db.setConversationState(userId, { parsedCommand: parsed });
        return ctx.reply("Ready to execute portfolio swap?", Markup.inlineKeyboard([
            Markup.button.callback('✅ Yes', 'confirm_portfolio'),
            Markup.button.callback('❌ No', 'cancel_swap')
        ]));
    }

    if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
        if (!parsed.settleAddress) {
            await db.setConversationState(userId, { parsedCommand: parsed });
            return ctx.reply(`Okay, I see you want to ${parsed.intent}. Please provide the destination address.`);
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

// --- ACTION HANDLERS ---

bot.action('confirm_swap', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.parsedCommand || state.parsedCommand.intent !== 'swap') return ctx.answerCbQuery('Session expired.');

    try {
        await ctx.answerCbQuery('Fetching quote...');
        const quote = await createQuote(
            state.parsedCommand.fromAsset!, state.parsedCommand.fromChain!,
            state.parsedCommand.toAsset!, state.parsedCommand.toChain!,
            state.parsedCommand.amount!, '1.1.1.1'
        );

        if (quote.error) return ctx.editMessageText(`Error: ${quote.error.message}`);
        db.setConversationState(userId, { ...state, quoteId: quote.id, settleAmount: quote.settleAmount });
        
        ctx.editMessageText(`➡️ *Send:* \`${quote.depositAmount} ${quote.depositCoin}\`\n⬅️ *Receive:* \`${quote.settleAmount} ${quote.settleCoin}\`\n\nReady?`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('✅ Place Order', 'place_order'),
                Markup.button.callback('❌ Cancel', 'cancel_swap'),
            ])
        });
    } catch (error) {
        ctx.editMessageText(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
});

bot.action('place_order', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.quoteId || !state.parsedCommand) return ctx.answerCbQuery('Session expired.');

    try {
        await ctx.answerCbQuery('Setting up order...');
        const destinationAddress = state.parsedCommand.settleAddress!;
        const order = await createOrder(state.quoteId, destinationAddress, destinationAddress);
        if (!order.id) throw new Error("Failed to create order");

        db.createOrderEntry(userId, state.parsedCommand, order, state.settleAmount, state.quoteId);
        
        // Automatically add order to watch list
        await db.addWatchedOrder(userId, order.id, 'pending');

        const { amount, fromChain, fromAsset } = state.parsedCommand;
        const rawDepositAddress = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress.address;
        const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress.memo : null;

        const chainKey = fromChain?.toLowerCase() || 'ethereum';
        const assetKey = fromAsset?.toUpperCase() || 'ETH';
        
        // Use dynamic token resolver instead of hardcoded TOKEN_MAP
        const tokenData = await tokenResolver.getTokenInfo(assetKey, chainKey);

        let txTo = rawDepositAddress, txValueHex = '0x0', txData = '0x';

        if (tokenData) {
            // This is an ERC20 token - construct transfer transaction
            txTo = tokenData.address;
            const amountBigInt = ethers.parseUnits(amount!.toString(), tokenData.decimals);
            const iface = new ethers.Interface(ERC20_ABI);
            txData = iface.encodeFunctionData("transfer", [rawDepositAddress, amountBigInt]);
        } else {
            // This is a native token (ETH, AVAX, BNB, etc.) - send value directly
            const amountBigInt = ethers.parseUnits(amount!.toString(), 18);
            txValueHex = '0x' + amountBigInt.toString(16);
            if (depositMemo) txData = ethers.hexlify(ethers.toUtf8Bytes(depositMemo));
        }

        const params = new URLSearchParams({
            to: txTo, value: txValueHex, data: txData,
            chainId: chainIdMap[chainKey] || '1',
            token: assetKey, amount: amount!.toString()
        });

        ctx.editMessageText(`✅ *Order Created!*\nTo complete the swap, sign in your wallet.\n\n🔔 *Auto-Watch Enabled:* I'll notify you when your swap completes!`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.webApp('📱 Sign Transaction', `${MINI_APP_URL}?${params.toString()}`),
                Markup.button.callback('❌ Close', 'cancel_swap')
            ])
        });
    } catch (error) {
        ctx.editMessageText(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});

bot.action('confirm_checkout', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.parsedCommand || state.parsedCommand.intent !== 'checkout') return ctx.answerCbQuery('Start over.');

    try {
        await ctx.answerCbQuery('Creating link...');
        const { settleAsset, settleNetwork, settleAmount, settleAddress } = state.parsedCommand;
        const checkout = await createCheckout(settleAsset!, settleNetwork!, settleAmount!, settleAddress!, '1.1.1.1');
        if (!checkout?.id) throw new Error("API Error");

        db.createCheckoutEntry(userId, checkout);
        ctx.editMessageText(`✅ *Checkout Link Created!*\n💰 *Receive:* ${checkout.settleAmount} ${checkout.settleCoin}\n[Pay Here](https://pay.sideshift.ai/checkout/${checkout.id})`, {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true }
        });
    } catch (error) {
        ctx.editMessageText(`Error creating link.`);
    } finally {
        db.clearConversationState(userId);
    }
});

bot.action('confirm_portfolio', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.parsedCommand || state.parsedCommand.intent !== 'portfolio') return ctx.answerCbQuery('Session expired.');

    try {
        await ctx.answerCbQuery('Creating portfolio swaps...');
        const { fromAsset, fromChain, amount, portfolio, settleAddress } = state.parsedCommand;
        
        if (!portfolio || portfolio.length === 0) {
            return ctx.editMessageText('❌ No portfolio allocation found.');
        }

        // Create quotes for each allocation
        const quotes: Array<{ quote: any; allocation: any; swapAmount: number }> = [];
        let quoteSummary = `📊 *Portfolio Swap Summary*\n\nFrom: ${amount} ${fromAsset} on ${fromChain}\n\n*Swaps:*\n`;

        for (const allocation of portfolio) {
            const swapAmount = (amount! * allocation.percentage) / 100;
            
            try {
                const quote = await createQuote(
                    fromAsset!,
                    fromChain!,
                    allocation.toAsset,
                    allocation.toChain,
                    swapAmount,
                    '1.1.1.1'
                );

                if (quote.error) {
                    throw new Error(`${allocation.toAsset}: ${quote.error.message}`);
                }

                quotes.push({ quote, allocation, swapAmount });
                quoteSummary += `• ${allocation.percentage}% (${swapAmount} ${fromAsset}) → ~${quote.settleAmount} ${allocation.toAsset}\n`;
            } catch (error) {
                return ctx.editMessageText(`❌ Failed to create quote for ${allocation.toAsset}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // Store quotes in state
        await db.setConversationState(userId, { 
            ...state, 
            portfolioQuotes: quotes.map(q => ({ 
                quoteId: q.quote.id, 
                allocation: q.allocation, 
                swapAmount: q.swapAmount,
                settleAmount: q.quote.settleAmount
            }))
        });

        quoteSummary += `\nReady to place orders?`;

        ctx.editMessageText(quoteSummary, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('✅ Place Orders', 'place_portfolio_orders'),
                Markup.button.callback('❌ Cancel', 'cancel_swap')
            ])
        });
    } catch (error) {
        ctx.editMessageText(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
});

bot.action('place_portfolio_orders', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.portfolioQuotes || !state.parsedCommand) return ctx.answerCbQuery('Session expired.');

    try {
        await ctx.answerCbQuery('Placing orders...');
        const { settleAddress, fromAsset, fromChain, amount } = state.parsedCommand;
        const orders: Array<{ order: any; allocation: any; quoteId: string }> = [];

        // Create orders for each quote
        for (const quoteData of state.portfolioQuotes) {
            try {
                const order = await createOrder(quoteData.quoteId, settleAddress!, settleAddress!);
                if (!order.id) throw new Error(`Failed to create order for ${quoteData.allocation.toAsset}`);

                // Store each order in database
                const orderCommand = {
                    ...state.parsedCommand,
                    toAsset: quoteData.allocation.toAsset,
                    toChain: quoteData.allocation.toChain,
                    amount: quoteData.swapAmount
                };
                db.createOrderEntry(userId, orderCommand, order, quoteData.settleAmount, quoteData.quoteId);
                
                // Automatically add each order to watch list
                await db.addWatchedOrder(userId, order.id, 'pending');

                orders.push({ order, allocation: quoteData.allocation, quoteId: quoteData.quoteId });
            } catch (error) {
                return ctx.editMessageText(`❌ Failed to create order for ${quoteData.allocation.toAsset}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // For portfolio swaps, we need to execute multiple transactions
        // The user will need to send the full amount to the first order's deposit address
        // Then the system will handle the splits via SideShift
        const firstOrder = orders[0].order;
        const rawDepositAddress = typeof firstOrder.depositAddress === 'string' ? firstOrder.depositAddress : firstOrder.depositAddress.address;
        const depositMemo = typeof firstOrder.depositAddress === 'object' ? firstOrder.depositAddress.memo : null;

        const chainKey = fromChain?.toLowerCase() || 'ethereum';
        const assetKey = fromAsset?.toUpperCase() || 'ETH';
        const totalAmount = amount!;
        
        // Use dynamic token resolver
        const tokenData = await tokenResolver.getTokenInfo(assetKey, chainKey);

        let txTo = rawDepositAddress, txValueHex = '0x0', txData = '0x';

        if (tokenData) {
            // ERC20 token
            txTo = tokenData.address;
            const amountBigInt = ethers.parseUnits(totalAmount.toString(), tokenData.decimals);
            const iface = new ethers.Interface(ERC20_ABI);
            txData = iface.encodeFunctionData("transfer", [rawDepositAddress, amountBigInt]);
        } else {
            // Native token
            const amountBigInt = ethers.parseUnits(totalAmount.toString(), 18);
            txValueHex = '0x' + amountBigInt.toString(16);
            if (depositMemo) txData = ethers.hexlify(ethers.toUtf8Bytes(depositMemo));
        }

        const params = new URLSearchParams({
            to: txTo, value: txValueHex, data: txData,
            chainId: chainIdMap[chainKey] || '1',
            token: assetKey, amount: totalAmount.toString()
        });

        let orderSummary = `✅ *Portfolio Orders Created!*\n\n*Orders:*\n`;
        orders.forEach((o, i) => {
            orderSummary += `${i + 1}. Order ${o.order.id.substring(0, 8)}... → ${o.allocation.toAsset}\n`;
        });
        orderSummary += `\nSign the transaction to complete all swaps.\n\n🔔 *Auto-Watch Enabled:* I'll notify you when each swap completes!`;

        ctx.editMessageText(orderSummary, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.webApp('📱 Sign Transaction', `${MINI_APP_URL}?${params.toString()}`),
                Markup.button.callback('❌ Close', 'cancel_swap')
            ])
        });
    } catch (error) {
        ctx.editMessageText(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        db.clearConversationState(userId);
    }
});

bot.action('cancel_swap', (ctx) => {
    db.clearConversationState(ctx.from.id);
    ctx.editMessageText('❌ Cancelled.');
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
            return ctx.editMessageText(`🌉 *Same-Chain Migration*\n\n` +
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

        const quote = await createQuote(
            fromAsset!, fromChain!,
            toAsset!, toChain!,
            amount!, '1.1.1.1'
        );

        if (quote.error) return ctx.editMessageText(`Error: ${quote.error.message}`);

        db.setConversationState(userId, { ...state, quoteId: quote.id, settleAmount: quote.settleAmount });

        const migrationText = state.migrationSuggestion
            ? `*Yield Migration*\n\n` +
              `From: ${state.parsedCommand.fromProject} (${state.parsedCommand.fromYield}% APY)\n` +
              `To: ${state.parsedCommand.toProject} (${state.parsedCommand.toYield}% APY)\n\n`
            : '';

        ctx.editMessageText(`${migrationText}➡️ *Send:* \`${quote.depositAmount} ${quote.depositCoin}\`\n⬅️ *Receive:* \`${quote.settleAmount} ${quote.settleCoin}\`\n\nReady to migrate?`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('✅ Migrate', 'place_migration'),
                Markup.button.callback('❌ Cancel', 'cancel_swap'),
            ])
        });
    } catch (error) {
        ctx.editMessageText(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
});

bot.action('show_deposit_instructions', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    if (!state?.migrationSuggestion) return ctx.answerCbQuery('Session expired.');

    const { fromPool, toPool } = state.migrationSuggestion;

    ctx.editMessageText(`📖 *Direct Deposit Instructions*\n\n` +
        `1. Go to ${toPool.project}\n` +
        `2. Connect your wallet\n` +
        `3. Withdraw from ${fromPool.project}\n` +
        `4. Deposit to ${toPool.project}\n\n` +
        `This is instant and saves bridge fees!\n\n` +
        `*APY Improvement:* ${fromPool.apy.toFixed(2)}% → ${toPool.apy.toFixed(2)}%`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            Markup.button.callback('🔙 Back', 'cancel_swap')
        ])
    });
});

bot.action('find_bridge_options', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    if (!state?.migrationSuggestion) return ctx.answerCbQuery('Session expired.');

    const { fromAsset } = state.parsedCommand;
    const pools = await getTopYieldPools();
    const crossChainPools = pools.filter(p =>
        p.symbol.toUpperCase() === fromAsset?.toUpperCase() &&
        p.chain.toLowerCase() !== state.parsedCommand.fromChain?.toLowerCase()
    );

    if (crossChainPools.length === 0) {
        return ctx.editMessageText(`No cross-chain yield options found for ${fromAsset}.`);
    }

    ctx.editMessageText(`🌉 *Cross-Chain Migration Options*\n\n` +
        crossChainPools.slice(0, 3).map((p, i) =>
            `${i + 1}. ${p.symbol} on ${p.chain} via ${p.project}: *${p.apy.toFixed(2)}% APY*`
        ).join('\n'), {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            Markup.button.callback('❌ Cancel', 'cancel_swap')
        ])
    });
});

bot.action('place_migration', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    if (!state?.quoteId || !state.parsedCommand) return ctx.answerCbQuery('Session expired.');

    try {
        await ctx.answerCbQuery('Creating migration order...');

        const destinationAddress = state.parsedCommand.settleAddress || state.parsedCommand.toAsset!;
        const order = await createOrder(state.quoteId, destinationAddress, destinationAddress);

        if (!order.id) throw new Error("Failed to create order");

        const migrationData = {
            intent: 'yield_migrate',
            fromAsset: state.parsedCommand.fromAsset,
            fromChain: state.parsedCommand.fromChain,
            toAsset: state.parsedCommand.toAsset,
            toChain: state.parsedCommand.toChain,
            amount: state.parsedCommand.amount,
            fromProject: state.parsedCommand.fromProject,
            toProject: state.parsedCommand.toProject,
            fromYield: state.parsedCommand.fromYield,
            toYield: state.parsedCommand.toYield
        };

        db.createOrderEntry(userId, migrationData as any, order, state.settleAmount, state.quoteId);

        const { amount, fromChain, fromAsset } = state.parsedCommand;
        const rawDepositAddress = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress.address;
        const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress.memo : null;

        const chainKey = fromChain?.toLowerCase() || 'ethereum';
        const assetKey = fromAsset?.toUpperCase() || 'ETH';

        const tokenData = await tokenResolver.getTokenInfo(assetKey, chainKey);

        let txTo = rawDepositAddress, txValueHex = '0x0', txData = '0x';

        if (tokenData) {
            txTo = tokenData.address;
            const amountBigInt = ethers.parseUnits(amount!.toString(), tokenData.decimals);
            const iface = new ethers.Interface(ERC20_ABI);
            txData = iface.encodeFunctionData("transfer", [rawDepositAddress, amountBigInt]);
        } else {
            const amountBigInt = ethers.parseUnits(amount!.toString(), 18);
            txValueHex = '0x' + amountBigInt.toString(16);
            if (depositMemo) txData = ethers.hexlify(ethers.toUtf8Bytes(depositMemo));
        }

        const params = new URLSearchParams({
            to: txTo, value: txValueHex, data: txData,
            chainId: chainIdMap[chainKey] || '1',
            token: assetKey, amount: amount!.toString()
        });

        ctx.editMessageText(`✅ *Migration Order Created!*\n\nYour funds will be moved to the higher-yielding pool.\n\nSign to complete the migration.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.webApp('📱 Sign Transaction', `${MINI_APP_URL}?${params.toString()}`),
                Markup.button.callback('❌ Close', 'cancel_swap')
            ])
        });
    } catch (error) {
        ctx.editMessageText(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});

bot.action('see_alternatives', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    if (!state?.parsedCommand) return ctx.answerCbQuery('Session expired.');

    const { fromAsset, fromChain } = state.parsedCommand;
    const pools = await getTopYieldPools();

    const alternatives = pools
        .filter(p =>
            p.symbol.toUpperCase() === (fromAsset?.toUpperCase()) &&
            (!fromChain || p.chain.toLowerCase() === fromChain.toLowerCase())
        )
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 5);

    if (alternatives.length === 0) {
        return ctx.answerCbQuery('No alternative pools found.');
    }

    ctx.editMessageText(`*Alternative Yield Pools for ${fromAsset}:*\n\n` +
        alternatives.map((p, i) =>
            `${i + 1}. ${p.symbol} on ${p.chain} via ${p.project}: *${p.apy.toFixed(2)}% APY*`
        ).join('\n'), { parse_mode: 'Markdown' });
});

bot.action('refresh_yields', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    if (!state?.parsedCommand) return ctx.answerCbQuery('Session expired.');

    await ctx.answerCbQuery('Refreshing yields...');
    return ctx.reply('🔄 Refreshing yield data... Use /migrate to try again.');
});

const app = express();
app.get('/', (req, res) => res.send('SwapSmith Alive'));
app.listen(process.env.PORT || 3000, () => console.log(`Express server live`));

// Start the order monitor
orderMonitor.start();

bot.launch();

// Graceful shutdown
process.once('SIGINT', () => {
    orderMonitor.stop();
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    orderMonitor.stop();
    bot.stop('SIGTERM');
});