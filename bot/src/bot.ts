import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { parseUserCommand, transcribeAudio } from './services/groq-client';
import { createQuote, createOrder, createCheckout, getOrderStatus } from './services/sideshift-client';
import { getTopStablecoinYields, getStakingPoolByAsset, getStakingInfo, getStakingQuote } from './services/yield-client';
import * as db from './services/database';
import { resolveAddress } from './services/address-resolver';
import { ethers } from 'ethers';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import express from 'express';
import { chainIdMap } from './config/chains';
import { handleError } from './services/logger';

dotenv.config();
const MINI_APP_URL = process.env.MINI_APP_URL!;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const bot = new Telegraf(process.env.BOT_TOKEN!);

// --- ADDRESS VALIDATION PATTERNS ---
const ADDRESS_PATTERNS: Record<string, RegExp> = {
  // EVM chains (default for unrecognized chains)
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
  xdc: /^xdc[a-fA-F0-9]{40}$/, // XDC Network
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

  // Bitcoin
  bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/,

  // Solana
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,

  // Polkadot
  polkadot: /^1[a-zA-Z0-9]{47}$/,

  // Cardano
  cardano: /^addr1[a-z0-9]{98}$|^Ae2tdPwUPEZ[a-zA-Z0-9]{50}$/,

  // Monero
  monero: /^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/,

  // Other chains (add more as needed)
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
  eos: /^[a-z1-5\.]{1,12}$/,
  tezos: /^tz[1-3][a-zA-Z0-9]{33}$/,
  algorand: /^[A-Z0-9]{58}$/,
  near: /^[a-z0-9_-]{2,64}\.near$|^[a-fA-F0-9]{64}$/,
  flow: /^0x[a-fA-F0-9]{16}$/,
  hedera: /^0\.0\.\d+$/,
  internetcomputer: /^[a-z0-9-]{1,63}\.ic$|^[a-fA-F0-9]{64}$/,
  elrond: /^erd1[a-z0-9]{58}$/,
  kusama: /^[A-Z0-9]{47}$/, // Similar to Polkadot
  rsk: /^0x[a-fA-F0-9]{40}$/, // RSK
  waves: /^3P[a-zA-Z0-9]{33}$/,
  zilliqa: /^zil1[a-z0-9]{38}$/,
};

function isValidAddress(chain: string, address: string): boolean {
  const pattern = ADDRESS_PATTERNS[chain.toLowerCase()] || ADDRESS_PATTERNS.ethereum; // Default to EVM
  return pattern.test(address);
}

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

bot.command('add_address', async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ').slice(1); // Remove /add_address

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

    const tempDir = os.tmpdir();
    const ogaPath = path.join(tempDir, `temp_${userId}.oga`);
    const mp3Path = path.join(tempDir, `temp_${userId}.mp3`);

    try {
        const file_id = ctx.message.voice.file_id;
        const fileLink = await ctx.telegram.getFileLink(file_id);
        
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        fs.writeFileSync(ogaPath, Buffer.from(response.data));
        execSync(`ffmpeg -i ${ogaPath} ${mp3Path} -y`);

        const transcribedText = await transcribeAudio(mp3Path);
        await handleTextMessage(ctx, transcribedText, 'voice');
    } catch (error) {
        console.error("Voice error:", error);
        ctx.reply("Sorry, I couldn't hear that clearly. Please try again.");
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


async function handleTextMessage(ctx: any, text: string, inputType: 'text' | 'voice' = 'text') {
  const userId = ctx.from.id;
  
  const state = await db.getConversationState(userId); 
  
  // 1. Check for pending address input
  if (state?.parsedCommand && (state.parsedCommand.intent === 'swap' || state.parsedCommand.intent === 'checkout') && !state.parsedCommand.settleAddress) {
      const potentialAddress = text.trim();
      // Enhanced address validation based on chain
      const chain = state.parsedCommand.intent === 'swap' ? state.parsedCommand.toChain : state.parsedCommand.settleNetwork;
      if (chain && isValidAddress(chain, potentialAddress)) {
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
          return ctx.reply(`That doesn't look like a valid address for ${chain || 'the selected chain'}. Please check and try again or /clear to cancel.`);
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

// --- ACTION HANDLERS ---

bot.action('confirm_portfolio', async (ctx) => {
    ctx.reply("Portfolio execution not fully implemented in this snippet.");
});

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
        const quoteMessage = `Here's your quote:\n\n➡️ *Send:* \`${quote.depositAmount} ${quote.depositCoin}\`\n⬅️ *Receive:* \`${quote.settleAmount} ${quote.settleCoin}\`\n\nReady?`;

        ctx.editMessageText(quoteMessage, {
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

        const { amount, fromChain, fromAsset } = state.parsedCommand;
        
        // --- ERC20 Logic ---
        const rawDepositAddress = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress.address;
        const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress.memo : null;

        const chainKey = fromChain?.toLowerCase() || 'ethereum';
        const assetKey = fromAsset?.toUpperCase() || 'ETH';
        const tokenData = TOKEN_MAP[chainKey]?.[assetKey];

        let txTo = rawDepositAddress;
        let txValueHex = '0x0';
        let txData = '0x';

        try {
            if (tokenData) {
                // ERC20 Token
                txTo = tokenData.address;
                txValueHex = '0x0'; // Value is 0 for tokens
                const amountBigInt = ethers.parseUnits(amount!.toString(), tokenData.decimals);
                const iface = new ethers.Interface(ERC20_ABI);
                txData = iface.encodeFunctionData("transfer", [rawDepositAddress, amountBigInt]);
            } else {
                // Native Asset
                txTo = rawDepositAddress;
                const amountBigInt = ethers.parseUnits(amount!.toString(), 18);
                txValueHex = '0x' + amountBigInt.toString(16);
                if (depositMemo) txData = ethers.hexlify(ethers.toUtf8Bytes(depositMemo));
            }
        } catch (err) {
            return ctx.editMessageText(`Tx construction error: ${err instanceof Error ? err.message : 'Unknown'}`);
        }

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

    } catch (error) {
        ctx.editMessageText(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});

// --- Button Handler for Checkouts ---
bot.action('confirm_checkout', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

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


bot.action('cancel_swap', (ctx) => {
    db.clearConversationState(ctx.from.id);
    ctx.editMessageText('❌ Cancelled.');
});

const app = express();
app.get('/', (req, res) => res.send('SwapSmith Alive'));
app.listen(process.env.PORT || 3000, () => console.log(`Express server live`));
bot.launch();
console.log('🤖 Bot is running...');
