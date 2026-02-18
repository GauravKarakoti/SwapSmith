import { Telegraf, Markup, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { exec } from 'child_process';
import express from 'express';
import { sql } from 'drizzle-orm';

// Services
import { transcribeAudio } from './services/groq-client';
import logger from './services/logger';
import {
  createQuote,
  createOrder,
  getOrderStatus,
} from './services/sideshift-client';
import {
  getTopStablecoinYields,
  getTopYieldPools,
} from './services/yield-client';
import * as db from './services/database';
import { DCAScheduler } from './services/dca-scheduler';
import { resolveAddress, isNamingService } from './services/address-resolver';
import { ADDRESS_PATTERNS } from './config/address-patterns';
import { limitOrderWorker } from './workers/limitOrderWorker';
import { OrderMonitor } from './services/order-monitor';

/* -------------------------------------------------------------------------- */
/*                               GLOBAL SETUP                                 */
/* -------------------------------------------------------------------------- */

dotenv.config();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
let isReady = false;

const bot = new Telegraf(process.env.BOT_TOKEN!);
const MINI_APP_URL = process.env.MINI_APP_URL!;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const DEFAULT_EVM_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function isValidAddress(address: string, chain?: string): boolean {
  if (!address) return false;
  const normalized = chain
    ? chain.toLowerCase().replace(/[^a-z]/g, '')
    : 'ethereum';
  const pattern = ADDRESS_PATTERNS[normalized] || DEFAULT_EVM_PATTERN;
  return pattern.test(address.trim());
}

/* -------------------------------------------------------------------------- */
/*                               ORDER MONITOR                                */
/* -------------------------------------------------------------------------- */

const orderMonitor = new OrderMonitor({
  getOrderStatus,
  updateOrderStatus: db.updateOrderStatus,
  getPendingOrders: db.getPendingOrders,
  onStatusChange: async (telegramId, orderId, oldStatus, newStatus, details) => {
    const emoji: Record<string, string> = {
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
      `${emoji[newStatus] || '🔔'} *Order Update*\n\n` +
      `*Order:* \`${orderId}\`\n` +
      `*Status:* ${oldStatus} → *${newStatus.toUpperCase()}*\n` +
      (details?.depositAmount
        ? `*Sent:* ${details.depositAmount} ${details.depositCoin}\n`
        : '') +
      (details?.settleAmount
        ? `*Received:* ${details.settleAmount} ${details.settleCoin}\n`
        : '');

    try {
      await bot.telegram.sendMessage(telegramId, msg, {
        parse_mode: 'Markdown',
      });
    } catch (e) {
      logger.error('Order update notify failed', e);
    }
  },
});

/* -------------------------------------------------------------------------- */
/*                                   COMMANDS                                 */
/* -------------------------------------------------------------------------- */

bot.start((ctx) => {
  ctx.reply(
    `🤖 *Welcome to SwapSmith!*\n\nVoice-enabled crypto trading assistant.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.url('🌐 Open Web App', MINI_APP_URL),
      ]),
    }
  );
});

bot.command('yield', async (ctx) => {
  const yields = await getTopStablecoinYields();
  ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields*\n\n${yields}`);
});

bot.command('clear', async (ctx) => {
  await db.clearConversationState(ctx.from!.id);
  ctx.reply('🗑️ Conversation cleared');
});

/* -------------------------------------------------------------------------- */
/*                              MESSAGE HANDLERS                              */
/* -------------------------------------------------------------------------- */

bot.on(message('text'), async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  await handleTextMessage(ctx, ctx.message.text);
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

    await new Promise<void>((resolve, reject) =>
      exec(`ffmpeg -i "${oga}" "${mp3}" -y`, (e) =>
        e ? reject(e) : resolve()
      )
    );

    const text = await transcribeAudio(mp3);
    await handleTextMessage(ctx, text, 'voice');
  } finally {
    fs.existsSync(oga) && fs.unlinkSync(oga);
    fs.existsSync(mp3) && fs.unlinkSync(mp3);
  }
});

/* -------------------------------------------------------------------------- */
/*                               CORE HANDLER                                 */
/* -------------------------------------------------------------------------- */

async function handleTextMessage(
  ctx: Context,
  text: string,
  inputType: 'text' | 'voice' = 'text'
) {
  if (!ctx.from) return;

  const userId = ctx.from.id;
  const state = await db.getConversationState(userId);

  /* ---------------- Address Resolution Flow ---------------- */

  if (state?.parsedCommand && !state.parsedCommand.settleAddress) {
    const resolved = await resolveAddress(userId, text.trim());

    if (
      resolved.address &&
      isValidAddress(resolved.address, state.parsedCommand.toChain)
    ) {
      const updated = {
        ...state.parsedCommand,
        settleAddress: resolved.address,
      };

      await db.setConversationState(userId, { parsedCommand: updated });

      await ctx.reply(
        `✅ Address resolved:\n\`${resolved.originalInput}\` → \`${resolved.address}\``,
        { parse_mode: 'Markdown' }
      );

      return ctx.reply(
        'Ready to proceed?',
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Yes', 'confirm_swap'),
          Markup.button.callback('❌ Cancel', 'cancel_swap'),
        ])
      );
    }

    if (isNamingService(text)) {
      return ctx.reply(
        `❌ Could not resolve \`${text}\`.\nTry ENS, Lens, Unstoppable Domains, or a raw address.`,
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

  if (parsed.intent === 'yield_scout') {
    const yields = await getTopStablecoinYields();
    return ctx.replyWithMarkdown(yields);
  }

  if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
    if (!parsed.settleAddress) {
      await db.setConversationState(userId, { parsedCommand: parsed });
      return ctx.reply(
        'Please provide the destination wallet address.'
      );
    }

    await db.setConversationState(userId, { parsedCommand: parsed });

    return ctx.reply(
      'Confirm parameters?',
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes', 'confirm_swap'),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
      ])
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                   ACTIONS                                  */
/* -------------------------------------------------------------------------- */

bot.action('confirm_swap', async (ctx) => {
  const state = await db.getConversationState(ctx.from!.id);
  if (!state?.parsedCommand) return;

  const q = await createQuote(
    state.parsedCommand.fromAsset,
    state.parsedCommand.fromChain,
    state.parsedCommand.toAsset,
    state.parsedCommand.toChain,
    state.parsedCommand.amount
  );

  await db.setConversationState(ctx.from!.id, {
    ...state,
    quoteId: q.id,
  });

  ctx.editMessageText(
    `🔄 *Quote*\nSend: ${q.depositAmount} ${q.depositCoin}\nReceive: ~${q.settleAmount} ${q.settleCoin}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.callback('🚀 Place Order', 'place_order'),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
      ]),
    }
  );
});

bot.action('place_order', async (ctx) => {
  const state = await db.getConversationState(ctx.from!.id);
  if (!state?.quoteId || !state.parsedCommand?.settleAddress) return;

  const order = await createOrder(
    state.quoteId,
    state.parsedCommand.settleAddress,
    state.parsedCommand.settleAddress
  );

  await db.createOrderEntry(
    ctx.from!.id,
    state.parsedCommand,
    order,
    order.settleAmount,
    state.quoteId
  );

  await ctx.editMessageText(
    `✅ Order Created\n\nSend ${order.depositAmount} ${order.depositCoin} to:\n\`${order.depositAddress}\``,
    { parse_mode: 'Markdown' }
  );

  await db.clearConversationState(ctx.from!.id);
});

bot.action('cancel_swap', async (ctx) => {
  await db.clearConversationState(ctx.from!.id);
  ctx.editMessageText('❌ Cancelled');
});

/* -------------------------------------------------------------------------- */
/*                                  STARTUP                                   */
/* -------------------------------------------------------------------------- */

const dcaScheduler = new DCAScheduler();

async function parseUserCommand(
  _text: string,
  _history: any[],
  _inputType: 'text' | 'voice'
) {
  // Replace with real NLP
  return {
    success: true,
    intent: 'swap',
    fromAsset: 'ETH',
    fromChain: 'ethereum',
    toAsset: 'BTC',
    toChain: 'bitcoin',
    amount: 1,
    settleAddress: null,
  };
}

async function start() {
  try {
    if (process.env.DATABASE_URL) {
      await db.db.execute(sql`SELECT 1`);
      dcaScheduler.start();
      limitOrderWorker.start(bot);
    }

    await orderMonitor.loadPendingOrders();
    orderMonitor.start();

    const server = app.listen(PORT, () =>
      logger.info(`🌍 Server running on ${PORT}`)
    );

    await bot.launch();
    isReady = true;

    const shutdown = () => {
      dcaScheduler.stop();
      limitOrderWorker.stop();
      orderMonitor.stop();
      bot.stop();
      server.close(() => process.exit(0));
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (e) {
    logger.error('Startup failed', e);
    process.exit(1);
  }
}

start();