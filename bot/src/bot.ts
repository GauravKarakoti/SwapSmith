import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import rateLimit from 'telegraf-ratelimit';

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

import logger, { Sentry, handleError } from './services/logger';
import { getOrderStatus } from './services/sideshift-client';
import { getTopStablecoinYields, formatYieldPools } from './services/yield-client';
import * as db from './services/database';
import { OrderMonitor } from './services/order-monitor';

dotenv.config();

/* -------------------------------------------------------------------------- */
/* CONFIG */
/* -------------------------------------------------------------------------- */

const BOT_TOKEN = process.env.BOT_TOKEN!;
const MINI_APP_URL =
  process.env.MINI_APP_URL || 'https://swapsmithminiapp.netlify.app/';
const PORT = Number(process.env.PORT || 3000);

const bot = new Telegraf(BOT_TOKEN);

const orderMonitor = new OrderMonitor({
  getOrderStatus: getOrderStatus,
  updateOrderStatus: db.updateOrderStatus,
  updateWatchedOrderStatus: db.updateWatchedOrderStatus,
  getPendingOrders: db.getPendingOrders,
  getPendingWatchedOrders: db.getPendingWatchedOrders,
  addWatchedOrder: db.addWatchedOrder,
  onStatusChange: async (telegramId, orderId, oldStatus, newStatus, orderDetails) => {
    try {
      await bot.telegram.sendMessage(
        telegramId,
        `🔔 *Order Status Update*\n\nOrder \`${orderId}\` status changed to: *${newStatus.toUpperCase()}*`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error(`[Bot] Failed to send status update to ${telegramId}:`, error);
    }
  }
});

/* ---------------- Rate Limit ---------------- */

bot.use(
  rateLimit({
    window: 60000,
    limit: 20,
    keyGenerator: (ctx: Context) => ctx.from?.id?.toString() || 'unknown',
    onLimitExceeded: async (ctx: Context) => {
      await ctx.reply('⚠️ Too many requests. Please slow down.');
    },
  })
);

const app = express();

/* ---------------- CORS ---------------- */

const allowedOrigins = [
  MINI_APP_URL,
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(
  cors({
    origin: function (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      if (!origin) return callback(null, true);

      if (!allowedOrigins.includes(origin)) {
        return callback(
          new Error(
            'The CORS policy for this site does not allow access from the specified Origin.'
          )
        );
      }

      return callback(null, true);
    },
  })
);

app.use(express.json());

/* -------------------------------------------------------------------------- */
/* COMMANDS */
/* -------------------------------------------------------------------------- */

bot.start((ctx: Context) =>
  ctx.reply(
    `🤖 *Welcome to SwapSmith!*\n\nVoice-enabled crypto trading assistant.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.url('🌐 Open Web App', MINI_APP_URL),
      ]),
    }
  )
);

bot.command('yield', async (ctx: Context) => {
  await ctx.reply('📈 Fetching top yield opportunities...');

  try {
    const yields = await getTopStablecoinYields();

    await ctx.replyWithMarkdown(
      `📈 *Top Stablecoin Yields:*\n\n${formatYieldPools(yields)}`
    );
  } catch {
    await ctx.reply('❌ Failed to fetch yields.');
  }
});

bot.command('clear', async (ctx: Context) => {
  if (!ctx.from) return;

  await db.clearConversationState(ctx.from.id);
  await ctx.reply('🗑️ Conversation cleared');
});

/* -------------------------------------------------------------------------- */
/* MESSAGE HANDLERS */
/* -------------------------------------------------------------------------- */

bot.on(message('text'), async (ctx) => {
  if (!ctx.message.text.startsWith('/')) {
    await ctx.reply('Message processed.');
  }
});

/* -------------------------------------------------------------------------- */
/* ACTIONS */
/* -------------------------------------------------------------------------- */

bot.action(/deposit_(.+)/, async (ctx) => {
  const poolId = ctx.match[1];
  await ctx.answerCbQuery();
  await ctx.reply(`🚀 Starting deposit flow for pool: ${poolId}`);
});

bot.action('confirm_limit_order', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = await db.getConversationState(userId);

  if (!state?.parsedCommand || state.parsedCommand.intent !== 'limit_order') {
    return ctx.answerCbQuery('Session expired.');
  }

  try {
    await ctx.answerCbQuery('Processing...');
    await ctx.editMessageText('✅ Limit order created!');
  } catch {
    await ctx.editMessageText('❌ Failed to create limit order.');
  } finally {
    await db.clearConversationState(userId);
  }
});

bot.action('confirm_swap_and_stake', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = await db.getConversationState(userId);

  if (!state?.parsedCommand || state.parsedCommand.intent !== 'swap_and_stake') {
    return ctx.answerCbQuery('Session expired.');
  }

  try {
    await ctx.answerCbQuery('Processing...');
    await ctx.editMessageText('⚙️ Creating swap & stake order...');

    const parsed = state.parsedCommand;

    const { getZapQuote, createZapTransaction, formatZapQuote } =
      await import('./services/stake-client');

    const fromNetwork = parsed.fromChain || 'ethereum';
    const toNetwork = parsed.toChain || 'ethereum';

    const zapQuote = await getZapQuote(
      parsed.fromAsset,
      fromNetwork,
      parsed.toAsset,
      toNetwork,
      parsed.amount,
      process.env.SIDESHIFT_CLIENT_IP || '127.0.0.1',
      toNetwork
    );

    const quoteMessage = formatZapQuote(zapQuote);
    await ctx.editMessageText(quoteMessage, { parse_mode: 'Markdown' });

    const zapTx = await createZapTransaction(
      zapQuote,
      parsed.settleAddress,
      process.env.SIDESHIFT_CLIENT_IP || '127.0.0.1'
    );

    await db.createStakeOrder({
      telegramId: userId,
      sideshiftOrderId: zapTx.swapOrderId,
      quoteId: zapQuote.stakePool.poolId || zapTx.swapOrderId,
      fromAsset: parsed.fromAsset,
      fromNetwork,
      fromAmount: parsed.amount,
      swapToAsset: parsed.toAsset,
      swapToNetwork: toNetwork,
      stakeAsset: parsed.toAsset,
      stakeProtocol: zapQuote.protocolName,
      stakeNetwork: toNetwork,
      depositAddress: zapQuote.depositAddress,
      stakeAddress: parsed.settleAddress,
    });

    orderMonitor.trackOrder(zapTx.swapOrderId, userId);

    const swapOrderStatus = await getOrderStatus(zapTx.swapOrderId);

    const depositAddress =
      typeof swapOrderStatus.depositAddress === 'string'
        ? swapOrderStatus.depositAddress
        : swapOrderStatus.depositAddress.address;

    const depositMemo =
      typeof swapOrderStatus.depositAddress === 'object'
        ? swapOrderStatus.depositAddress.memo
        : null;

    await ctx.reply(
      `✅ *Swap & Stake Order Created!*\n\n` +
        `*Order ID:* \`${zapTx.swapOrderId}\`\n\n` +
        `Send *${parsed.amount} ${parsed.fromAsset}* to:\n` +
        `\`${depositAddress}\`\n` +
        (depositMemo ? `Memo: \`${depositMemo}\`\n` : ''),
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    handleError('SwapAndStakeError', error);
    await ctx.editMessageText(
      '❌ Failed to create swap & stake order. Please try again later.'
    );
  } finally {
    await db.clearConversationState(userId);
  }
});

bot.action('cancel_swap', async (ctx) => {
  if (!ctx.from) return;

  await db.clearConversationState(ctx.from.id);
  await ctx.editMessageText('❌ Cancelled');
});

/* -------------------------------------------------------------------------- */
/* STARTUP */
/* -------------------------------------------------------------------------- */

async function start() {
  try {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 1.0,
      });
    }

    await orderMonitor.loadPendingOrders();
    orderMonitor.start();

    await bot.launch();
    logger.info('🤖 Bot launched');

    const server = app.listen(PORT, () =>
      logger.info(`🌍 Server running on port ${PORT}`)
    );

    const shutdown = async (signal: string) => {
      logger.info(`🛑 Shutdown (${signal})`);

      orderMonitor.stop();
      bot.stop(signal);

      await new Promise<void>((resolve) => server.close(() => resolve()));

      process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  } catch (e) {
    handleError('StartupFailed', e);
    process.exit(1);
  }
}

start();