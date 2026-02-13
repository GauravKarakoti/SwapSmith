import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { parseUserCommand, transcribeAudio } from './services/groq-client';
import {
  createQuote,
  createOrder,
  createCheckout,
  getOrderStatus,
} from './services/sideshift-client';
import {
  getTopStablecoinYields,
  getTopYieldPools,
  suggestMigration,
  findHigherYieldPools,
  formatMigrationMessage,
} from './services/yield-client';
import * as db from './services/database';
import { ethers } from 'ethers';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { chainIdMap } from './config/chains';
import { handleError } from './services/logger';
import { tokenResolver } from './services/token-resolver';
import { OrderMonitor } from './services/order-monitor';
import { resolveAddress, isNamingService } from './services/address-resolver';
import { ADDRESS_PATTERNS } from './config/address-patterns';
import * as os from 'os';

console.log("SIDESHIFT_CLIENT_IP =", process.env.SIDESHIFT_CLIENT_IP);
console.log("BOT_TOKEN exists =", Boolean(process.env.BOT_TOKEN));

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN!);
const MINI_APP_URL = process.env.MINI_APP_URL!;

// ------------------ INIT ------------------

const orderMonitor = new OrderMonitor(bot);

exec('ffmpeg -version', (error) => {
  if (error) console.warn('⚠️ ffmpeg not found. Voice messages disabled.');
  else console.log('✅ ffmpeg detected.');
});

const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

function isValidAddress(address: string, chain?: string): boolean {
  const pattern =
    ADDRESS_PATTERNS[chain?.toLowerCase() || 'ethereum'] ??
    ADDRESS_PATTERNS.ethereum;
  return pattern.test(address.trim());
}

// ------------------ START ------------------

bot.start((ctx) =>
  ctx.reply(
    `🤖 *Welcome to SwapSmith!*\n\nVoice-Activated Crypto Trading Assistant.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.url('🌐 Visit Website', 'https://swap-smith.vercel.app'),
      ]),
    }
  )
);

// ------------------ MESSAGE HANDLER ------------------

bot.on(message('text'), async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  await handleTextMessage(ctx, ctx.message.text);
});

// ------------------ VOICE HANDLER ------------------
bot.on(message('voice'), async (ctx) => {
  const userId = ctx.from.id;
  await ctx.sendChatAction('typing');

  try {
    const fileId = ctx.message.voice.file_id;
    const fileLink = await bot.telegram.getFileLink(fileId);
    
    // FIX: Using unique filename with timestamp and random suffix to prevent race conditions
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
    await handleTextMessage(ctx, text);

  } catch (error) {
    console.error('Voice processing error:', error);
    ctx.reply('❌ Error processing voice message.');
  }
});

async function handleTextMessage(ctx: any, text: string) {
  const userId = ctx.from.id;
  const state = await db.getConversationState(userId);

  // ---------- ADDRESS COLLECTION ----------
  if (state?.parsedCommand && !state.parsedCommand.settleAddress) {
    const targetChain =
      state.parsedCommand.toChain ??
      state.parsedCommand.settleNetwork ??
      state.parsedCommand.fromChain ??
      undefined;

    const resolved = await resolveAddress(userId, text.trim());

    if (resolved.address && isValidAddress(resolved.address, targetChain)) {
      const updated = { ...state.parsedCommand, settleAddress: resolved.address };
      await db.setConversationState(userId, { parsedCommand: updated });

      return ctx.reply(
        `✅ Address resolved: \`${resolved.address}\`\n\nProceed?`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            Markup.button.callback(
              '✅ Yes',
              updated.intent === 'checkout'
                ? 'confirm_checkout'
                : updated.intent === 'portfolio'
                ? 'confirm_portfolio'
                : 'confirm_swap'
            ),
            Markup.button.callback('❌ Cancel', 'cancel_swap'),
          ]),
        }
      );
    }

    if (isNamingService(text)) {
      return ctx.reply(`❌ Could not resolve domain. Try a raw address.`);
    }

    return ctx.reply(`❌ Invalid address. Try again or /clear.`);
  }

  // ---------- PARSE COMMAND ----------
  const parsed = await parseUserCommand(text, state?.messages || []);

  if (!parsed.success) {
    return ctx.reply(parsed.validationErrors.join('\n'));
  }

  // ---------- PORTFOLIO ----------
  if (parsed.intent === 'portfolio') {
    await db.setConversationState(userId, { parsedCommand: parsed });

    let msg = `📊 *Portfolio Detected*\n\n`;
    parsed.portfolio?.forEach((p: any) => {
      msg += `• ${p.percentage}% → ${p.toAsset} (${p.toChain})\n`;
    });
    msg += `\nProvide destination address.`;

    return ctx.replyWithMarkdown(msg);
  }

  // ---------- SWAP / CHECKOUT ----------
  if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
    await db.setConversationState(userId, { parsedCommand: parsed });
    return ctx.reply(`Provide destination wallet address.`);
  }
}

// ------------------ ACTIONS ------------------

bot.action('confirm_swap', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.parsedCommand || state.parsedCommand.intent !== 'swap') return ctx.answerCbQuery('Session expired.');

    try {
        await ctx.answerCbQuery('Fetching quote...');
        const q = await createQuote(
            state.parsedCommand.fromAsset!, state.parsedCommand.fromChain!,
            state.parsedCommand.toAsset!, state.parsedCommand.toChain!,
            state.parsedCommand.amount!
        );

        await db.setConversationState(ctx.from.id, {
            ...state,
            quoteId: q.id,
            settleAmount: q.settleAmount,
        });

        ctx.editMessageText(
            `➡️ Send: ${q.depositAmount} ${q.depositCoin}\n⬅️ Receive: ${q.settleAmount} ${q.settleCoin}`,
            {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('✅ Place Order', 'place_order'),
                Markup.button.callback('❌ Cancel', 'cancel_swap'),
            ]),
            }
        );
    } catch (error) {
        console.error('Error creating quote:', error);
        ctx.reply('Failed to create quote. Please try again.');
    }
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
            return ctx.editMessageText('G�� No portfolio allocation found.');
        }

        // Create quotes for each allocation
        const quotes: Array<{ quote: any; allocation: any; swapAmount: number }> = [];
        let quoteSummary = `=��� *Portfolio Swap Summary*\n\nFrom: ${amount} ${fromAsset} on ${fromChain}\n\n*Swaps:*\n`;

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
                quoteSummary += `G�� ${allocation.percentage}% (${swapAmount} ${fromAsset}) G�� ~${quote.settleAmount} ${allocation.toAsset}\n`;
            } catch (error) {
                return ctx.editMessageText(`G�� Failed to create quote for ${allocation.toAsset}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                Markup.button.callback('G�� Place Orders', 'place_portfolio_orders'),
                Markup.button.callback('G�� Cancel', 'cancel_swap')
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
                return ctx.editMessageText(`G�� Failed to create order for ${quoteData.allocation.toAsset}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

        let orderSummary = `G�� *Portfolio Orders Created!*\n\n*Orders:*\n`;
        orders.forEach((o, i) => {
            orderSummary += `${i + 1}. Order ${o.order.id.substring(0, 8)}... G�� ${o.allocation.toAsset}\n`;
        });
        orderSummary += `\nSign the transaction to complete all swaps.\n\n=��� *Auto-Watch Enabled:* I'll notify you when each swap completes!`;

        ctx.editMessageText(orderSummary, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.webApp('=��� Sign Transaction', `${MINI_APP_URL}?${params.toString()}`),
                Markup.button.callback('G�� Close', 'cancel_swap')
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
    ctx.editMessageText('G�� Cancelled.');
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
            return ctx.editMessageText(`=��� *Same-Chain Migration*\n\n` +
                `Since both pools are on the same chain, you can migrate directly:\n\n` +
                `1. Withdraw your ${fromAsset} from ${state.parsedCommand.fromProject}\n` +
                `2. Deposit to ${state.parsedCommand.toProject}\n\n` +
                `This saves on bridge fees and is instant.\n\n` +
                `Do you need a quote to swap ${fromAsset} to a different chain?`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    Markup.button.callback('=��� Find Cross-Chain Options', 'find_bridge_options'),
                    Markup.button.callback('G�� Cancel', 'cancel_swap')
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

        ctx.editMessageText(`${migrationText}GP�n+� *Send:* \`${quote.depositAmount} ${quote.depositCoin}\`\nG��n+� *Receive:* \`${quote.settleAmount} ${quote.settleCoin}\`\n\nReady to migrate?`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('G�� Migrate', 'place_migration'),
                Markup.button.callback('G�� Cancel', 'cancel_swap'),
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

    ctx.editMessageText(`=��� *Direct Deposit Instructions*\n\n` +
        `1. Go to ${toPool.project}\n` +
        `2. Connect your wallet\n` +
        `3. Withdraw from ${fromPool.project}\n` +
        `4. Deposit to ${toPool.project}\n\n` +
        `This is instant and saves bridge fees!\n\n` +
        `*APY Improvement:* ${fromPool.apy.toFixed(2)}% G�� ${toPool.apy.toFixed(2)}%`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            Markup.button.callback('=��� Back', 'cancel_swap')
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
    return ctx.editMessageText(`=��� Portfolio complete!`);
  }

  ctx.editMessageText(
    `=��� Transaction ${i + 1}/${state.portfolioQuotes.length}\n\n` +
      `Send ${q.amount} ${state.parsedCommand.fromAsset}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.webApp(
          '=��� Sign Transaction',
          `${MINI_APP_URL}?amount=${q.amount}`
        ),
        Markup.button.callback(
          'Gšn+� Next',
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
  ctx.editMessageText('G�� Cancelled.');
});

// ------------------ START BOT ------------------

bot.launch();
