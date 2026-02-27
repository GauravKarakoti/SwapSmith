import { Telegraf, Markup, Context, Update } from 'telegraf';
import { message } from 'telegraf/filters';
import rateLimit from 'telegraf-ratelimit';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { spawn } from 'child_process';
import express from 'express';
import { sql } from 'drizzle-orm';

import { transcribeAudio } from './services/groq-client';
import logger, { Sentry } from './services/logger';
import {
  getOrderStatus,
  createOrder,
  createCheckout,
} from './services/sideshift-client';
import {
  getTopStablecoinYields,
  formatYieldPools,
} from './services/yield-client';
import * as db from './services/database';
import { DCAScheduler } from './services/dca-scheduler';
import {
  resolveAddress,
  isNamingService,
} from './services/address-resolver';
import { limitOrderWorker } from './workers/limitOrderWorker';
import { trailingStopWorker } from './workers/trailing-stop';
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

/* -------------------------------------------------------------------------- */
/* RATE LIMITING                                                              */
/* -------------------------------------------------------------------------- */

const limit = rateLimit({
  window: 60000,
  limit: 20,
  keyGenerator: (ctx: Context) =>
    ctx.from?.id.toString() || 'unknown',
  onLimitExceeded: async (ctx: Context) => {
    await ctx.reply(
      '⚠️ Too many requests! Please slow down (20/min).'
    );
  },
});

bot.use(limit);

const app = express();
app.use(express.json());

/* -------------------------------------------------------------------------- */
/* ORDER MONITOR                                                              */
/* -------------------------------------------------------------------------- */

const orderMonitor = new OrderMonitor({
  getOrderStatus,
  updateOrderStatus: db.updateOrderStatus,
  getPendingOrders: db.getPendingOrders,
  onStatusChange: async (
    telegramId,
    orderId,
    oldStatus,
    newStatus,
    details
  ) => {
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
      logger.error('OrderUpdateNotifyFailed', e);
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
    ctx.replyWithMarkdown(
      `📈 *Top Stablecoin Yields:*\n\n${formatYieldPools(
        yields
      )}`
    );
  } catch {
    ctx.reply('❌ Failed to fetch yields.');
  }
});

bot.command('clear', async (ctx) => {
  if (!ctx.from) return;
  await db.clearConversationState(ctx.from.id);
  ctx.reply('🗑️ Conversation cleared');
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

  const oga = path.join(os.tmpdir(), `${Date.now()}.oga`);
  const mp3 = oga.replace('.oga', '.mp3');

  try {
    const res = await axios.get(fileLink.href, {
      responseType: 'arraybuffer',
    });
    fs.writeFileSync(oga, res.data);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ['-i', oga, mp3, '-y']);
      ffmpeg.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(`FFmpeg exited with ${code}`)
            )
      );
      ffmpeg.on('error', reject);
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
  ctx: Context<Update>,
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
    ['swap', 'checkout', 'portfolio', 'limit_order', 'trailing_stop'].includes(
      state.parsedCommand.intent
    )
  ) {
    const resolved = await resolveAddress(
      userId,
      text.trim()
    );

    const targetChain =
      state.parsedCommand.toChain ||
      state.parsedCommand.settleNetwork ||
      state.parsedCommand.fromChain ||
      'ethereum';

    if (
      resolved.address &&
      isValidAddress(resolved.address, targetChain)
    ) {
      const updated = {
        ...state.parsedCommand,
        settleAddress: resolved.address,
      };

      await db.setConversationState(userId, {
        parsedCommand: updated,
      });

      return ctx.reply(
        `✅ Address resolved:\n\`${resolved.originalInput}\` → \`${resolved.address}\``,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            Markup.button.callback(
              '✅ Yes',
              `confirm_${updated.intent}`
            ),
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

  const parsed = await parseUserCommand(
    text,
    state?.messages || [],
    inputType
  );

  if (!parsed.success) {
    return ctx.replyWithMarkdown(
      (parsed as any).validationErrors?.join('\n') ||
        '❌ I didn’t understand.'
    );
  }

  /* ---------------- Yield Scout ---------------- */

  if (parsed.intent === 'yield_scout') {
    const yields = await getTopStablecoinYields();
    return ctx.replyWithMarkdown(
      `📈 *Top Stablecoin Yields:*\n\n${formatYieldPools(
        yields
      )}`
    );
  }

  /* ---------------- Portfolio ---------------- */

  if (parsed.intent === 'portfolio') {
    await db.setConversationState(userId, {
      parsedCommand: parsed,
    });

    let msg = `📊 *Portfolio Strategy*\n\n`;
    parsed.portfolio?.forEach((p: any) => {
      msg += `• ${p.percentage}% → ${p.toAsset} on ${p.toChain}\n`;
    });

    return ctx.replyWithMarkdown(
      msg,
      Markup.inlineKeyboard([
        Markup.button.webApp('📱 Batch Sign', MINI_APP_URL),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
      ])
    );
  }

  /* ---------------- Trailing Stop ---------------- */

  if (parsed.intent === 'trailing_stop') {
    if (!parsed.settleAddress) {
      await db.setConversationState(userId, {
        parsedCommand: parsed,
      });
      return ctx.reply(
        'Please provide the destination wallet address.'
      );
    }

    await db.setConversationState(userId, {
      parsedCommand: parsed,
    });

    return ctx.reply(
      'Confirm trailing stop?',
      Markup.inlineKeyboard([
        Markup.button.callback(
          '✅ Confirm',
          'confirm_trailing_stop'
        ),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
      ])
    );
  }

  /* ---------------- Limit Order ---------------- */

  if (parsed.intent === 'limit_order') {
    if (!parsed.settleAddress) {
      await db.setConversationState(userId, {
        parsedCommand: parsed,
      });
      return ctx.reply(
        'Please provide the destination wallet address.'
      );
    }
  }

  /* ---------------- Swap / Checkout ---------------- */

  if (['swap', 'checkout'].includes(parsed.intent)) {
    if (!parsed.settleAddress) {
      await db.setConversationState(userId, {
        parsedCommand: parsed,
      });
      return ctx.reply(
        'Please provide the destination wallet address.'
      );
    }

    await db.setConversationState(userId, {
      parsedCommand: parsed,
    });

    return ctx.reply(
      'Confirm parameters?',
      Markup.inlineKeyboard([
        Markup.button.callback(
          '✅ Yes',
          `confirm_${parsed.intent}`
        ),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
      ])
    );
  }
}

/* -------------------------------------------------------------------------- */
/* ACTIONS                                                                    */
/* -------------------------------------------------------------------------- */

bot.action('confirm_trailing_stop', async (ctx) => {
  const userId = ctx.from.id;
  const state = await db.getConversationState(userId);

  if (
    !state?.parsedCommand ||
    state.parsedCommand.intent !== 'trailing_stop'
  ) {
    return ctx.answerCbQuery('Session expired.');
  }

  const {
    fromAsset,
    toAsset,
    amount,
    trailingPercentage,
    settleAddress,
  } = state.parsedCommand;

  try {
    const order =
      await trailingStopWorker.createTrailingStopOrder({
        telegramId: userId,
        fromAsset: fromAsset!,
        fromNetwork: 'ethereum',
        toAsset: toAsset!,
        toNetwork: 'ethereum',
        fromAmount: amount.toString(),
        trailingPercentage,
        settleAddress: settleAddress!,
      });

    await ctx.editMessageText(
      `✅ *Trailing Stop Order Created!*\n\n*Order ID:* \`${order.id}\``,
      { parse_mode: 'Markdown' }
    );
  } finally {
    await db.clearConversationState(userId);
  }
});

bot.action('cancel_swap', async (ctx) => {
  if (!ctx.from) return;
  await db.clearConversationState(ctx.from.id);
  ctx.editMessageText('❌ Cancelled');
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
      trailingStopWorker.start(bot);
    }

    await orderMonitor.loadPendingOrders();
    orderMonitor.start();

    const server = app.listen(PORT, () =>
      logger.info(`🌍 Server running on ${PORT}`)
    );

    await bot.launch();
    logger.info('🤖 Bot launched');

    const shutdown = (signal: string) => {
      dcaScheduler.stop();
      limitOrderWorker.stop();
      trailingStopWorker.stop();
      orderMonitor.stop();
      bot.stop(signal);
      server.close(() => process.exit(0));
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  } catch (e) {
    logger.error('StartupFailed', e);
    process.exit(1);
  }
}

start();