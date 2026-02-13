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
    `➡️ Send: ${q.depositAmount} ${q.depositCoin}\n⬅️ Receive: ${q.settleAmount} ${q.settleCoin}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.callback('✅ Place Order', 'place_order'),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
      ]),
    }
  );
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

// ------------------ PORTFOLIO FLOW ------------------

bot.action('confirm_portfolio', async (ctx) => {
  const state = await db.getConversationState(ctx.from.id);
  if (!state?.parsedCommand) return;

  const quotes = [];

  for (const p of state.parsedCommand.portfolio) {
    const amt =
      (state.parsedCommand.amount * p.percentage) / 100;

    const q = await createQuote(
      state.parsedCommand.fromAsset,
      state.parsedCommand.fromChain,
      p.toAsset,
      p.toChain,
      amt
    );

    quotes.push({ allocation: p, quote: q, amount: amt });
  }

  await db.setConversationState(ctx.from.id, {
    ...state,
    portfolioQuotes: quotes,
    currentTransactionIndex: 0,
  });

  ctx.editMessageText(
    `📊 Portfolio quotes ready.\n\nYou will sign ${quotes.length} transactions.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.callback(
          '✅ Start Signing',
          'sign_portfolio_transaction'
        ),
      ]),
    }
  );
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
          '⏭️ Next',
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

// ------------------ START BOT ------------------

bot.launch();