import { Telegraf, Markup, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { parseUserCommand, transcribeAudio } from './services/groq-client';
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
import * as db from './services/database';
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
import * as os from 'os';

dotenv.config();

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

  // Swap / Checkout
  if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
    await db.setConversationState(userId, { parsedCommand: parsed });
    return ctx.reply('Provide destination wallet address.');
  }
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
          swapAmount
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
  const state = await db.getConversationState(ctx.from.id);
  if (!state?.portfolioQuotes) return;

  const i = state.currentTransactionIndex;
  const q = state.portfolioQuotes[i];

  if (!q) {
    await db.clearConversationState(ctx.from.id);
    return ctx.editMessageText(`🎉 Portfolio complete!`);
  }

  ctx.editMessageText(
    `📝 Transaction ${i + 1}/${state.portfolioQuotes.length}\n\n` +
    `Send ${q.amount} ${state.parsedCommand.fromAsset}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.webApp(
          '📱 Sign Transaction',
          `${MINI_APP_URL}?amount=${q.amount}`
        ),
        Markup.button.callback(
          '➡️ Next',
          'next_portfolio_transaction'
        ),
      ]),
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

// ------------------ START SERVICES ------------------

let dcaStarted = false;
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('memory')) {
  dcaScheduler.start();
  dcaStarted = true;
}

// ------------------ LAUNCH ------------------

bot.launch();

process.once('SIGINT', () => {
  if (dcaStarted) dcaScheduler.stop();
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  if (dcaStarted) dcaScheduler.stop();
  bot.stop('SIGTERM');
});