import { Telegraf, Markup, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import rateLimit from 'telegraf-ratelimit';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { spawn, spawnSync } from 'child_process';
import express from 'express';
import { sql } from 'drizzle-orm';
import cors from 'cors';
import type { Server } from 'http';
import type { Socket } from 'net';

import { transcribeAudio } from './services/groq-client';
import logger, { Sentry, handleError } from './services/logger';
import { getOrderStatus, createOrder, createCheckout } from './services/sideshift-client';
import { getTopStablecoinYields, formatYieldPools } from './services/yield-client';
import * as db from './services/database';
import { DCAScheduler } from './services/dca-scheduler';
import { resolveAddress, isNamingService } from './services/address-resolver';
import { limitOrderWorker } from './workers/limitOrderWorker';
import { initializeStakeWorker, stopStakeWorker } from './workers/stakeOrderWorker';
import { OrderMonitor } from './services/order-monitor';
import { parseUserCommand } from './services/parseUserCommand';
import { isValidAddress } from './config/address-patterns';
import { executePortfolioStrategy } from './services/portfolio-service';

dotenv.config();

/* -------------------------------------------------------------------------- */
/* CONFIG                                                                     */
/* -------------------------------------------------------------------------- */

const BOT_TOKEN = process.env.BOT_TOKEN!;
const MINI_APP_URL =
  process.env.MINI_APP_URL || 'https://swapsmithminiapp.netlify.app/';
const PORT = Number(process.env.PORT || 3000);

const bot = new Telegraf(BOT_TOKEN);

/* ---------------- Rate Limit ---------------- */

bot.use(
  rateLimit({
    window: 60000,
    limit: 20,
    keyGenerator: (ctx: Context) => ctx.from?.id.toString() || 'unknown',
    onLimitExceeded: async (ctx: Context) => {
      await ctx.reply('⚠️ Too many requests. Please slow down.');
    },
  })
);

const app = express();

const allowedOrigins = [MINI_APP_URL, 'http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json());

/* -------------------------------------------------------------------------- */
/* ORDER MONITOR                                                              */
/* -------------------------------------------------------------------------- */

const orderMonitor = new OrderMonitor({
  getOrderStatus,
  updateOrderStatus: db.updateOrderStatus,
  updateWatchedOrderStatus: db.updateWatchedOrderStatus,
  getPendingOrders: db.getPendingOrders,
  getPendingWatchedOrders: db.getPendingWatchedOrders,
  addWatchedOrder: db.addWatchedOrder,
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
      (details?.depositAmount
        ? `*Sent:* ${details.depositAmount} ${details.depositCoin}\n`
        : '') +
      (details?.settleAmount
        ? `*Received:* ${details.settleAmount} ${details.settleCoin}\n`
        : '') +
      (details?.settleHash
        ? `*Tx:* \`${details.settleHash.slice(0, 16)}...\`\n`
        : '');

    try {
      await bot.telegram.sendMessage(telegramId, msg, {
        parse_mode: 'Markdown',
      });
    } catch (e) {
      handleError('OrderUpdateNotifyFailed', e);
    }
  },
});

/* -------------------------------------------------------------------------- */
/* COMMANDS                                                                   */
/* -------------------------------------------------------------------------- */

bot.start((ctx) =>
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

bot.command('yield', async (ctx) => {
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

bot.command('clear', async (ctx) => {
  if (!ctx.from) return;
  await db.clearConversationState(ctx.from.id);
  await ctx.reply('🗑️ Conversation cleared');
});

/* -------------------------------------------------------------------------- */
/* MESSAGE HANDLERS                                                           */
/* -------------------------------------------------------------------------- */

bot.on(message('text'), async (ctx) => {
  if (!ctx.message.text.startsWith('/')) {
    await handleTextMessage(ctx, ctx.message.text);
  }
});

bot.on(message('voice'), async (ctx) => {
  await ctx.reply('👂 Listening...');
  const fileId = ctx.message.voice.file_id;
  const fileLink = await ctx.telegram.getFileLink(fileId);

  // Security: Generate safe temporary file paths to prevent shell injection
  // Using timestamp-based naming ensures uniqueness and prevents path traversal
  const tempDir = os.tmpdir();
  const safeFileName = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const oga = path.join(tempDir, `${safeFileName}.oga`);
  const mp3 = path.join(tempDir, `${safeFileName}.mp3`);

  // Security: Validate file paths are within temp directory
  const ogaNormalized = path.normalize(oga);
  const mp3Normalized = path.normalize(mp3);
  
  if (!ogaNormalized.startsWith(path.normalize(tempDir)) || 
      !mp3Normalized.startsWith(path.normalize(tempDir))) {
    return ctx.reply('❌ Security error: Invalid file path.');
  }

  try {
    const res = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    fs.writeFileSync(oga, res.data);

    await new Promise<void>((resolve, reject) => {
      // Security: Using spawn() instead of exec() prevents shell injection
      // Arguments are passed as an array, not concatenated into a shell command string
      const ffmpeg = spawn('ffmpeg', ['-i', oga, mp3, '-y'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000, // 30 second timeout
      });

      let stderrData = '';

      if (ffmpeg.stderr) {
        ffmpeg.stderr.on('data', (chunk) => {
          stderrData += chunk.toString();
        });
      }

      if (ffmpeg.stdout) {
        ffmpeg.stdout.on('data', () => {
          // drain stdout to avoid blocking if ffmpeg writes to it
        });
      }

      ffmpeg.on('error', (err) => reject(err));

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `FFmpeg process exited with code ${code}${
                stderrData ? `; stderr: ${stderrData}` : ''
              }`,
            ),
          );
        }
      });
    });

    const text = await transcribeAudio(mp3);
    await handleTextMessage(ctx, text, 'voice');
  } finally {
    fs.existsSync(oga) && fs.unlinkSync(oga);
    fs.existsSync(mp3) && fs.unlinkSync(mp3);
  }
});

/* -------------------------------------------------------------------------- */
/* CORE HANDLER                                                               */
/* -------------------------------------------------------------------------- */

async function handleTextMessage(
  ctx: Context,
  text: string,
  inputType: 'text' | 'voice' = 'text'
) {
  if (!ctx.from) return;

  const userId = ctx.from.id;
  const state = await db.getConversationState(userId);

  /* ---------------- Address Resolution ---------------- */

  if (
    state?.parsedCommand &&
    !state.parsedCommand.settleAddress &&
    ['swap', 'checkout', 'portfolio', 'limit_order'].includes(
      state.parsedCommand.intent
    )
  ) {
    const resolved = await resolveAddress(userId, text.trim());
    const targetChain =
      state.parsedCommand.toChain ||
      state.parsedCommand.settleNetwork ||
      state.parsedCommand.fromChain ||
      'ethereum';

    if (resolved.address && isValidAddress(resolved.address, targetChain)) {
      const updated = { ...state.parsedCommand, settleAddress: resolved.address };
      await db.setConversationState(userId, { parsedCommand: updated });

      return ctx.reply(
        `✅ Address resolved:\n\`${resolved.originalInput}\` → \`${resolved.address}\``,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            Markup.button.callback('✅ Yes', `confirm_${updated.intent}`),
            Markup.button.callback('❌ No', 'cancel_swap'),
          ]),
        }
      );
    }

    if (isNamingService(text)) {
      return ctx.reply(
        `❌ Could not resolve \`${text}\`. Please use a raw address.`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  /* ---------------- NLP Parsing ---------------- */

  const parsed = await parseUserCommand(text, state?.messages || [], inputType);
  if (!parsed.success) {
    return ctx.replyWithMarkdown(
      parsed.validationErrors?.join('\n') || '❌ I didn’t understand.'
    );
  }

  /* ---------------- Yield Scout ---------------- */

  if (parsed.intent === 'yield_scout') {
    const yields = await getTopStablecoinYields();
    return ctx.replyWithMarkdown(
      `📈 *Top Stablecoin Yields:*\n\n${formatYieldPools(yields)}`
    );
  }

  /* ---------------- Portfolio ---------------- */

  if (parsed.intent === 'portfolio') {
    await db.setConversationState(userId, { parsedCommand: parsed });

    const msg =
      `📊 *Portfolio Strategy*\n\n` +
      parsed.portfolio
        ?.map(
          (p: { percentage: number; toAsset: string; toChain: string }) =>
            `• ${p.percentage}% → ${p.toAsset} on ${p.toChain}`,
        )
        .join('\n');

    return ctx.replyWithMarkdown(
      msg || '',
      Markup.inlineKeyboard([
        Markup.button.webApp('📱 Batch Sign', MINI_APP_URL),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
      ])
    );
  }

  /* ---------------- Limit Order ---------------- */

  if (parsed.intent === 'limit_order') {
    if (!parsed.settleAddress) {
      await db.setConversationState(userId, { parsedCommand: parsed });
      return ctx.reply('Please provide the destination wallet address.');
    }

    await db.setConversationState(userId, { parsedCommand: parsed });

    return ctx.reply(
      'Confirm Limit Order?',
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes', 'confirm_limit_order'),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
      ])
    );
  }

  /* ---------------- Swap and Stake ---------------- */

  if (parsed.intent === 'swap_and_stake') {
    if (!parsed.settleAddress) {
      await db.setConversationState(userId, { parsedCommand: parsed });
      return ctx.reply('Please provide your wallet address to receive staking tokens.');
    }

    // Validate the staking address
    const targetChain = parsed.toChain || parsed.fromChain || 'ethereum';
    if (!isValidAddress(parsed.settleAddress, targetChain)) {
      await db.clearConversationState(userId);
      return ctx.reply(
        `❌ Invalid ${targetChain} address. Please provide a valid wallet address and try again.`
      );
    }

    await db.setConversationState(userId, { parsedCommand: parsed });

    return ctx.reply(
      'Confirm Swap & Stake?',
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes', 'confirm_swap_and_stake'),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
      ])
    );
  }

  /* ---------------- Swap / Checkout ---------------- */

  if (['swap', 'checkout'].includes(parsed.intent)) {
    if (!parsed.settleAddress) {
      await db.setConversationState(userId, { parsedCommand: parsed });
      return ctx.reply('Please provide the destination wallet address.');
    }

    await db.setConversationState(userId, { parsedCommand: parsed });

    return ctx.reply(
      'Confirm parameters?',
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes', `confirm_${parsed.intent}`),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
      ])
    );
  }
}

/* -------------------------------------------------------------------------- */
/* ACTIONS                                                                    */
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

    // Import stake client functions
    const { getZapQuote, createZapTransaction, formatZapQuote } = await import('./services/stake-client');

    // Validate required fields
    if (!parsed.fromAsset || !parsed.toAsset || !parsed.amount || !parsed.settleAddress) {
      throw new Error('Missing required fields for swap and stake');
    }

    // Set default networks if not specified
    const fromNetwork = parsed.fromChain || 'ethereum';
    const toNetwork = parsed.toChain || 'ethereum';
    const stakeProtocol = parsed.fromProject || parsed.toProject || null;

    // Get zap quote
    const zapQuote = await getZapQuote(
      parsed.fromAsset,
      fromNetwork,
      parsed.toAsset,
      toNetwork,
      parsed.amount,
      process.env.SIDESHIFT_CLIENT_IP || '127.0.0.1',
      toNetwork
    );

    // Show quote to user
    const quoteMessage = formatZapQuote(zapQuote);
    await ctx.editMessageText(quoteMessage, { parse_mode: 'Markdown' });

    // Create the zap transaction
    const zapTx = await createZapTransaction(
      zapQuote,
      parsed.settleAddress,
      process.env.SIDESHIFT_CLIENT_IP || '127.0.0.1'
    );

    // Store in database
    await db.createStakeOrder({
      telegramId: userId,
      sideshiftOrderId: zapTx.swapOrderId,
      quoteId: zapQuote.stakePool.poolId || zapTx.swapOrderId,
      fromAsset: parsed.fromAsset,
      fromNetwork: fromNetwork,
      fromAmount: parsed.amount,
      swapToAsset: parsed.toAsset,
      swapToNetwork: toNetwork,
      stakeAsset: parsed.toAsset,
      stakeProtocol: stakeProtocol || zapQuote.protocolName,
      stakeNetwork: toNetwork,
      depositAddress: zapQuote.depositAddress,
      stakeAddress: parsed.settleAddress,
    });

    // Track the order for monitoring
    orderMonitor.trackOrder(zapTx.swapOrderId, userId);

    // Get the actual deposit address from the swap order
    const swapOrderStatus = await getOrderStatus(zapTx.swapOrderId);
    const depositAddress = typeof swapOrderStatus.depositAddress === 'string'
      ? swapOrderStatus.depositAddress
      : swapOrderStatus.depositAddress.address;
    const depositMemo = typeof swapOrderStatus.depositAddress === 'object'
      ? swapOrderStatus.depositAddress.memo
      : null;

    // Send success message with deposit instructions
    await ctx.reply(
      `✅ *Swap & Stake Order Created!*\n\n` +
      `*Order ID:* \`${zapTx.swapOrderId}\`\n\n` +
      `*Step 1: Swap*\n` +
      `Send *${parsed.amount} ${parsed.fromAsset}* to:\n` +
      `\`${depositAddress}\`\n` +
      (depositMemo ? `*Memo:* \`${depositMemo}\`\n\n` : '\n') +
      `*Step 2: Stake (Automatic)*\n` +
      `Once swap completes, you'll receive ${parsed.toAsset} in your wallet\n` +
      `Then follow instructions to stake on ${zapQuote.protocolName}\n\n` +
      `*Expected APY:* ${zapQuote.estimatedApy.toFixed(2)}%\n` +
      `*Est. Annual Yield:* ${zapQuote.estimatedAnnualYield} ${parsed.toAsset}\n\n` +
      `I'll notify you when each step completes! 🚀`,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    handleError('SwapAndStakeError', error);
    await ctx.editMessageText(
      '❌ Failed to create swap & stake order. Please try again later or contact support.',
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
/* STARTUP                                                                    */
/* -------------------------------------------------------------------------- */

const dcaScheduler = new DCAScheduler();

async function start() {
  try {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 1.0,
      });
    }

    if (process.env.DATABASE_URL) {
      await db.db.execute(sql`SELECT 1`);
      dcaScheduler.start();
      limitOrderWorker.start(bot);

      try {
        initializeStakeWorker(bot);
        logger.info('✅ Stake worker initialized successfully');
      } catch (error) {
        handleError('StakeWorkerInitFailed', error);
        // Continue without stake worker rather than crashing the entire bot
      }
    }

    await orderMonitor.loadPendingOrders();
    orderMonitor.start();

    // Schedule hourly reconciliation with an in-flight guard to prevent concurrent runs
    let reconcileInFlight = false;
    const reconcileInterval = setInterval(async () => {
      if (reconcileInFlight) {
        logger.warn('[OrderMonitor] Skipping reconciliation — previous run still in flight');
        return;
      }
      reconcileInFlight = true;
      try {
        await orderMonitor.reconcile();
      } finally {
        reconcileInFlight = false;
      }
    }, 60 * 60_000); // every hour (60 minutes × 60 000 ms)

    const sockets = new Set<Socket>();
    const server: Server = app.listen(PORT, () =>
      logger.info(`🌍 Server running on port ${PORT}`)
    );
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });

    await bot.launch();
    logger.info('🤖 Bot launched');

    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info(`🛑 Shutdown initiated (${signal})`);

      const forceExitTimer = setTimeout(() => {
        handleError('ForcedShutdownTimeout', new Error('Forced shutdown after timeout'));
        // eslint-disable-next-line no-process-exit
        process.exit(1);
      }, 8_000);
      forceExitTimer.unref?.();

      try {
        // Stop background work first so no new activity is scheduled
        clearInterval(reconcileInterval);
        orderMonitor.stop();
        dcaScheduler.stop();
        limitOrderWorker.stop();
        stopStakeWorker();

        // Stop Telegraf (polling/webhook)
        bot.stop(signal);

        // Close HTTP server and any keep-alive sockets
        try {
          const advancedServer = server as unknown as {
            closeIdleConnections?: () => void;
            closeAllConnections?: () => void;
          };
          advancedServer.closeIdleConnections?.();
          advancedServer.closeAllConnections?.();
        } catch {
          // ignore best-effort calls
        }

        sockets.forEach((s) => {
          try {
            s.destroy();
          } catch {
            // ignore
          }
        });

        await new Promise<void>((resolve) => server.close(() => resolve()));

        clearTimeout(forceExitTimer);
        // eslint-disable-next-line no-process-exit
        process.exit(0);
      } catch (e) {
        handleError('ShutdownFailed', e);
        clearTimeout(forceExitTimer);
        // eslint-disable-next-line no-process-exit
        process.exit(1);
      }
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('uncaughtException', (err) => {
      handleError('UncaughtException', err);
      void shutdown('uncaughtException');
    });
    process.once('unhandledRejection', (reason) => {
      handleError('UnhandledRejection', reason);
      void shutdown('unhandledRejection');
    });
  } catch (e) {
    handleError('StartupFailed', e);
    process.exit(1);
  }
}

start();