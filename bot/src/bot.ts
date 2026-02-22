import { Telegraf, Markup, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import logger from './services/logger';
import { executePortfolioStrategy } from './services/portfolio-service';
import { transcribeAudio } from './services/groq-client';
import { parseUserCommand } from './services/parseUserCommand';
import {
  createQuote,
  createOrder,
  createCheckout,
} from './services/sideshift-client';
import {
  getTopStablecoinYields,
  getTopYieldPools,
  suggestMigration,
  findHigherYieldPools,
} from './services/yield-client';
import * as db from 'shared';
import { ParsedCommand } from 'shared';
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
import { orderWorker } from './workers/order-worker';
import * as os from 'os';
import express from 'express';
import { sql } from 'shared';

// --- GLOBAL ERROR HANDLERS ---
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
let isReady = false;

// --- HEALTH CHECK ---
app.get("/health", (req, res) => {
  if (!isReady) {
    return res.status(503).json({ status: "starting" });
  }
  res.status(200).json({ status: "ok" });
});

const bot = new Telegraf(process.env.BOT_TOKEN!);
const MINI_APP_URL = process.env.MINI_APP_URL!;
const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

// ------------------ UTIL ------------------

function isValidAddress(address: string, chain?: string): boolean {
  if (!address) return false;
  const targetChain = chain?.toLowerCase() || 'ethereum';
  const pattern = ADDRESS_PATTERNS[targetChain] || ADDRESS_PATTERNS.ethereum;
  
  // First check regex pattern
  if (!pattern.test(address.trim())) {
    return false;
  }
  
  // For EVM chains, additionally verify checksum
  const evmChains = [
    'ethereum', 'base', 'arbitrum', 'polygon', 'bsc', 'optimism', 'avalanche',
    'fantom', 'cronos', 'moonbeam', 'moonriver', 'celo', 'gnosis', 'harmony',
    'metis', 'aurora', 'kava', 'evmos', 'boba', 'okc', 'heco', 'iotex',
    'klaytn', 'conflux', 'astar', 'shiden', 'telos', 'fuse', 'velas',
    'thundercore', 'nahmii', 'callisto', 'smartbch', 'energyweb', 'theta',
    'flare', 'songbird', 'coston', 'coston2', 'rei', 'kekchain', 'tomochain',
    'bitgert', 'clover', 'defichain', 'findora', 'gatechain', 'meter', 'nova',
    'syscoin', 'zksync', 'polygonzkevm', 'linea', 'mantle', 'scroll', 'taiko', 'rsk'
  ];
  
  if (evmChains.includes(targetChain)) {
    const addr = address.trim();
    
    // Check if address (excluding 0x prefix) is all-lowercase or all-uppercase
    const addrWithoutPrefix = addr.slice(2); // Remove '0x'
    const isAllLower = addrWithoutPrefix === addrWithoutPrefix.toLowerCase();
    const isAllUpper = addrWithoutPrefix === addrWithoutPrefix.toUpperCase();
    
    // Accept all-lowercase or all-uppercase (no checksum)
    if (isAllLower || isAllUpper) {
      return true;
    }
    
    // For mixed-case, verify checksum
    try {
      const checksummed = ethers.getAddress(addr);
      return checksummed === addr;
    } catch {
      // Invalid checksum
      return false;
    }
  }
  
  return true;
}

// ------------------ INIT ------------------

exec('ffmpeg -version', (error) => {
  if (error) console.warn('⚠️ ffmpeg not found. Voice disabled.');
  else console.log('✅ ffmpeg detected.');
});

const dcaScheduler = new DCAScheduler(bot);

// ------------------ START ------------------

bot.start((ctx) => {
  ctx.reply(
    "🤖 Welcome to SwapSmith!\n\n" +
    "Voice-Activated Crypto Trading Assistant.\n\n" +
    "📜 Commands\n" +
    "/yield - Top yields\n" +
    "/history - Orders\n" +
    "/checkouts - Payment links\n" +
    "/dca_list - DCA schedules\n\n" +
    "💡 Try: Swap $50 of USDC for ETH every Monday",
    {
      ...Markup.inlineKeyboard([
        Markup.button.url('🌐 Visit Website', 'https://swap-smith.vercel.app'),
      ]),
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

bot.on(message('voice'), async (ctx) => {
  const userId = ctx.from.id;
  await ctx.sendChatAction('typing');

  try {
    const fileId = ctx.message.voice.file_id;
    const fileLink = await bot.telegram.getFileLink(fileId);

    // Using unique filename with timestamp and random suffix to prevent race conditions
    const timestamp = Date.now();
    const uniqueId = Math.random().toString(36).substring(7);
    const tempOga = path.join(os.tmpdir(), `temp_${userId}_${timestamp}_${uniqueId}.oga`);
    const tempMp3 = path.join(os.tmpdir(), `temp_${userId}_${timestamp}_${uniqueId}.mp3`);

    const writer = fs.createWriteStream(tempOga);
    const response = await axios({
      url: fileLink.href,
      method: 'GET',
      responseType: 'stream',
    });

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(true));
      writer.on('error', reject);
    });

    // Convert to mp3
    await new Promise((resolve, reject) => {
      exec(`ffmpeg -i "${tempOga}" "${tempMp3}" -y`, (error) => {
        if (error) reject(error);
        else resolve(true);
      });
    });

    const text = await transcribeAudio(tempMp3);

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

// ------------------ CORE HANDLER ------------------

async function handleTextMessage(
  ctx: Context,
  text: string,
  inputType: 'text' | 'voice' = 'text'
) {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  const state = await db.getConversationState(userId);

  // 1. Check if we are waiting for an address resolution
  if (state?.parsedCommand && 
     (state.parsedCommand.intent === 'swap' || 
      state.parsedCommand.intent === 'checkout' || 
      state.parsedCommand.intent === 'portfolio') && 
     !state.parsedCommand.settleAddress) {

    const potentialAddress = text.trim();
    const targetChain = state.parsedCommand.toChain ?? state.parsedCommand.settleNetwork ?? state.parsedCommand.fromChain ?? undefined;

    // Try to resolve the address
    const resolved = await resolveAddress(userId, potentialAddress);
    
    if (resolved.address && isValidAddress(resolved.address, targetChain)) {
      // Successfully resolved and validated
      const updatedCommand = { ...state.parsedCommand, settleAddress: resolved.address };
      await db.setConversationState(userId, { parsedCommand: updatedCommand });
      
      // Provide feedback based on resolution type
      let feedbackMessage = '';
      if (resolved.type === 'ens') {
        feedbackMessage = `✅ ENS resolved: \`${resolved.originalInput}\` → \`${resolved.address}\``;
      } else if (resolved.type === 'lens') {
        feedbackMessage = `✅ Lens handle resolved: \`${resolved.originalInput}\` → \`${resolved.address}\``;
      } else if (resolved.type === 'unstoppable') {
        feedbackMessage = `✅ Unstoppable Domain resolved: \`${resolved.originalInput}\` → \`${resolved.address}\``;
      } else if (resolved.type === 'nickname') {
        feedbackMessage = `✅ Nickname resolved: \`${resolved.originalInput}\` → \`${resolved.address}\``;
      } else {
        feedbackMessage = `✅ Address received: \`${resolved.address}\``;
      }
      
      await ctx.reply(feedbackMessage, { parse_mode: 'Markdown' });

      const confirmAction = updatedCommand.intent === 'checkout' ? 'confirm_checkout' : updatedCommand.intent === 'portfolio' ? 'confirm_portfolio' : 'confirm_swap';
      return ctx.reply("Ready to proceed?", Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes', confirmAction),
        Markup.button.callback('❌ No', 'cancel_swap')
      ]));
    } else if (isNamingService(potentialAddress)) {
      // It's a naming service domain but resolution failed
      return ctx.reply(
        `❌ Could not resolve \`${potentialAddress}\`.\n\n` +
        `This appears to be a naming service domain, but resolution failed. Please check:\n` +
        `• The domain is registered and active\n` +
        `• The domain has a wallet address set\n` +
        `• Try using a raw wallet address instead\n\n` +
        `Or /clear to cancel.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      // Not a naming service and not a valid address
      const chainHint = targetChain ? ` for ${targetChain}` : '';
      return ctx.reply(
        `❌ That doesn't look like a valid wallet address${chainHint}.\n\n` +
        `You can provide:\n` +
        `• A wallet address (0x...)\n` +
        `• An ENS name (vitalik.eth)\n` +
        `• A Lens handle (lens.lens)\n` +
        `• An Unstoppable Domain (example.crypto)\n` +
        `• A saved nickname\n\n` +
        `Or /clear to cancel.`
      );
    }
  }

  // 2. Parse new command
  const history = state?.messages || [];
  await ctx.sendChatAction('typing');
  const parsed = await parseUserCommand(text, history, inputType);

  // 3. Handle Validation Errors
  if (!parsed.success && parsed.intent !== 'yield_scout') {
    // Log analytics removed as it was undefined
    
    console.log('📱 Bot received parsed command:', parsed);
    
    const contextualErrors = parsed.validationErrors.filter(err => 
      err.includes('💡') || err.includes('How much') || err.includes('Which asset') || err.includes('Example:')
    );
    
    const otherErrors = parsed.validationErrors.filter(err => 
      !err.includes('💡') && !err.includes('How much') && !err.includes('Which asset') && !err.includes('Example:')
    );
    
    let errorMessage = '';
    if (otherErrors.length > 0) {
      errorMessage = `⚠️ ${otherErrors.join(", ")}\n\n`;
    }
    
    if (contextualErrors.length > 0) {
      errorMessage += contextualErrors.join("\n\n");
    } else if (errorMessage === '') {
      errorMessage = `⚠️ I didn't understand.`;
    }
    
    return ctx.replyWithMarkdown(errorMessage);
  }

  // 4. Handle Specific Intents

  // --- Safety Check for Conditional Swaps ---
  if (parsed.conditions) {
    return ctx.reply(
      `⚠️ Conditional swap detected.\n\n` +
      `Swap will execute when ${parsed.toAsset || 'target asset'} price is ${parsed.conditions.type === "price_above" ? "above" : "below"} ${parsed.conditions.value}.\n\n` +
      `This conditional execution is not automated yet.`
    );
  }

  // --- Limit Order ---
  if (parsed.intent === 'swap' && (parsed.conditionOperator && parsed.conditionValue)) {
      const user = await db.getUser(userId);

      // Check if we need settle address
      if (!parsed.settleAddress && !user?.walletAddress) {
          await db.setConversationState(userId, { parsedCommand: parsed });
          return ctx.reply('To place this limit order, I need a destination wallet address. Please provide one.');
      }

      const settleAddress = parsed.settleAddress || user?.walletAddress!;

      await db.createLimitOrder(
          userId,
          parsed.fromAsset!,
          parsed.fromChain || 'ethereum',
          parsed.toAsset!,
          parsed.toChain || 'ethereum',
          parsed.amount!,
          parsed.conditionOperator!,
          parsed.conditionValue!,
          parsed.conditionAsset || parsed.fromAsset!,
          settleAddress
      );

      return ctx.reply(
          `✅ *Limit Order Placed*\n\n` +
          `Swap: ${parsed.amount} ${parsed.fromAsset} -> ${parsed.toAsset}\n` +
          `Condition: If ${parsed.conditionAsset || parsed.fromAsset} ${parsed.conditionOperator === 'gt' ? '>' : '<'} ${parsed.conditionValue}\n` +
          `Status: Pending\n\n` +
          `I will monitor the price and notify you when it executes.`,
          { parse_mode: 'Markdown' }
      );
  }

  // --- Yield Scout ---
  if (parsed.intent === 'yield_scout') {
    const yields = await getTopStablecoinYields();
    return ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
  }

  // --- Yield Deposit ---
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

  // --- Yield Migrate ---
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

    // This function was assumed to exist in previous context, passing placeholder
    const message = `Found better yield: ${suggestion.toPool.project} (${suggestion.toPool.apy}% APY)`; 

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

    await db.setConversationState(userId, { 
      parsedCommand: migrationCommand,
      migrationSuggestion: suggestion 
    });

    return ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
      Markup.button.callback('🚀 Migrate', 'confirm_migration'),
      Markup.button.callback('❌ Cancel', 'cancel_swap')
    ]));
  }

  // --- Portfolio ---
  if (parsed.intent === 'portfolio') {
    await db.setConversationState(userId, { parsedCommand: parsed });

    let msg = `📊 *Portfolio Strategy*\n\n`;
    parsed.portfolio?.forEach((p) => {
      msg += `• ${p.percentage}% → ${p.toAsset} on ${p.toChain}\n`;
    });

    msg += `\nProvide destination address.`;
    return ctx.replyWithMarkdown(msg);
  }

  // --- Swap / Checkout ---
  if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
    await db.setConversationState(userId, { parsedCommand: parsed });
    return ctx.reply('Provide destination wallet address.');
  }
}

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

  await db.createOrderEntry(
    ctx.from.id,
    state.parsedCommand,
    order,
    state.settleAmount,
    state.quoteId
  );

  await db.addWatchedOrder(ctx.from.id, order.id, 'pending');

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

  const { fromAsset, fromChain, amount, portfolio, settleAddress } = state.parsedCommand;

  // 1. Validate Input
  if (!portfolio || portfolio.length === 0) {
    return ctx.editMessageText('❌ No portfolio allocation found.');
  }

  const totalPercentage = portfolio.reduce((sum: number, p: NonNullable<ParsedCommand['portfolio']>[number]) => sum + p.percentage, 0);
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

    const quote = await createQuote(
      fromAsset!, fromChain!,
      toAsset!, toChain!,
      amount!
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

// ------------------ START SERVICES & SERVER ------------------

let dcaStarted = false;
let limitOrderStarted = false;

const startServer = async () => {
  try {
    // 1. Check Database
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('memory')) {
        await db.db.execute(sql`SELECT 1`);
        console.log("✅ Database connected");

        dcaScheduler.start();
        dcaStarted = true;

        orderWorker.start(bot);
        limitOrderStarted = true;
    }

    // 2. Start Express
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });

    // 3. Launch Bot
    await new Promise<void>((resolve, reject) => {
        bot.launch(() => {
            console.log("✅ Bot polling started");
            resolve();
        }).catch((err) => {
            reject(err);
        });
    });

    // 4. Mark Ready
    isReady = true;
    console.log("✅ App is ready");

    // Graceful Shutdown
    const stop = (signal: string) => {
        console.log(`Received ${signal}. Shutting down...`);
        if (dcaStarted) dcaScheduler.stop();
        if (limitOrderStarted) orderWorker.stop();
        bot.stop(signal);
        server.close(() => {
            console.log("Server closed");
            process.exit(0);
        });
    };

    process.once('SIGINT', () => stop('SIGINT'));
    process.once('SIGTERM', () => stop('SIGTERM'));

  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
};

startServer();
