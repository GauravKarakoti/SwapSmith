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
import { createQuote, createOrder, getOrderStatus } from './services/sideshift-client';
import { getTopStablecoinYields, getTopYieldPools } from './services/yield-client';
import * as db from './services/database';
import { DCAScheduler } from './services/dca-scheduler';
import { resolveAddress, isNamingService } from './services/address-resolver';
import { ADDRESS_PATTERNS } from './config/address-patterns';
import { limitOrderWorker } from './workers/limitOrderWorker';
import { OrderMonitor } from './services/order-monitor';
import { parseUserCommand } from './services/parseUserCommand'; // Import corrected function

/* -------------------------------------------------------------------------- */
/* GLOBAL SETUP                                 */
/* -------------------------------------------------------------------------- */

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://swapsmithminiapp.netlify.app/';
const PORT = Number(process.env.PORT || 3000);

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

const DEFAULT_EVM_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/* -------------------------------------------------------------------------- */
/* HELPERS                                  */
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
/* ORDER MONITOR                                */
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

    await bot.telegram.sendMessage(telegramId, msg, { parse_mode: 'Markdown' });
  },
});

/* -------------------------------------------------------------------------- */
/* COMMANDS                                 */
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
  const yields = await getTopStablecoinYields();
  ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields*\n\n${yields}`);
});

bot.command('clear', async (ctx) => {
  if (ctx.from) {
      await db.clearConversationState(ctx.from.id);
      ctx.reply('🗑️ Conversation cleared');
  }
});

/* -------------------------------------------------------------------------- */
/* MESSAGE HANDLERS                              */
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
    const res = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
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
/* CORE HANDLER                                 */
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
    state.parsedCommand.intent && // Check intent exists
    ['swap', 'checkout', 'portfolio'].includes(state.parsedCommand.intent)
  ) {
    const resolved = await resolveAddress(userId, text.trim());
    const targetChain =
      state.parsedCommand.toChain ||
      state.parsedCommand.settleNetwork ||
      state.parsedCommand.fromChain;

    if (resolved.address && isValidAddress(resolved.address, targetChain)) {
      const updated = { ...state.parsedCommand, settleAddress: resolved.address };
      await db.setConversationState(userId, { parsedCommand: updated });

      await ctx.reply(
        `✅ Address resolved:\n\`${resolved.originalInput}\` → \`${resolved.address}\``,
        { parse_mode: 'Markdown' }
      );

      return ctx.reply(
        'Ready to proceed?',
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Yes', `confirm_${updated.intent}`),
          Markup.button.callback('❌ No', 'cancel_swap'),
        ])
      );
    }

    if (isNamingService(text)) {
      return ctx.reply(
        `❌ Could not resolve \`${text}\`. Please check the domain or try a raw address.`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  /* ---------------- NLP Parsing ---------------- */

  const parsed = await parseUserCommand(text, state?.messages || [], inputType);

  if (!parsed.success) {
    // Cast to any to access validationErrors or use type guard
    const errors = (parsed as any).validationErrors?.join('\n') || '❌ I didn’t understand.';
    return ctx.replyWithMarkdown(errors);
  }

  /* ---------------- Yield Scout ---------------- */

  if (parsed.intent === 'yield_scout') {
    const yields = await getTopStablecoinYields();
    return ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields*\n\n${yields}`);
  }

  /* ---------------- Swap / Checkout ---------------- */

  if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
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
/* ACTIONS                                  */
/* -------------------------------------------------------------------------- */

bot.action('confirm_swap', async (ctx) => {
  if (!ctx.from) return;
  const state = await db.getConversationState(ctx.from.id);
  if (!state?.parsedCommand) return;

<<<<<<< HEAD
<<<<<<< HEAD
    try {
        await ctx.answerCbQuery('Fetching quote...');

        // Use default params or what we have in state
        const q = await createQuote(
            state.parsedCommand.fromAsset!,
            state.parsedCommand.fromChain!,
            state.parsedCommand.toAsset || state.parsedCommand.settleAsset!, // Handle both swap/checkout keys
            state.parsedCommand.toChain || state.parsedCommand.settleNetwork!,
            state.parsedCommand.amount!
        );
=======
=======
>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd
  const q = await createQuote(
    state.parsedCommand.fromAsset,
    state.parsedCommand.fromChain,
    state.parsedCommand.toAsset,
    state.parsedCommand.toChain,
    state.parsedCommand.amount
  );
<<<<<<< HEAD
>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd

  await db.setConversationState(ctx.from.id, { ...state, quoteId: q.id });

<<<<<<< HEAD
        const confirmText =
            `🔄 *Quote Received*\n\n` +
            `➡️ Send: ${q.depositAmount} ${q.depositCoin}\n` +
            `⬅️ Receive: ~${q.settleAmount} ${q.settleCoin}\n` +
            `⏱️ Rate: 1 ${q.depositCoin} ≈ ${q.rate} ${q.settleCoin}`;

        ctx.editMessageText(
            confirmText,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    Markup.button.callback('✅ Place Order', 'place_order'),
                    Markup.button.callback('❌ Cancel', 'cancel_swap')
                ])
            }
        );
    } catch (e) {
        console.error(e);
        ctx.reply('❌ Failed to get a quote. Please try again.');
=======
=======

  await db.setConversationState(ctx.from.id, { ...state, quoteId: q.id });

>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd
  await ctx.editMessageText(
    `🔄 *Quote*\nSend: ${q.depositAmount} ${q.depositCoin}\nReceive: ~${q.settleAmount} ${q.settleCoin}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.callback('🚀 Place Order', 'place_order'),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
      ]),
<<<<<<< HEAD
>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd
=======
>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd
    }
  );
});

bot.action('place_order', async (ctx) => {
<<<<<<< HEAD
<<<<<<< HEAD
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);

    if (!state?.quoteId || !state.parsedCommand?.settleAddress) {
        return ctx.answerCbQuery('Session missing required data. Start over.');
    }
=======
  if (!ctx.from) return;
  const state = await db.getConversationState(ctx.from.id);
  if (!state?.quoteId || !state.parsedCommand?.settleAddress) return;
>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd
=======
  if (!ctx.from) return;
  const state = await db.getConversationState(ctx.from.id);
  if (!state?.quoteId || !state.parsedCommand?.settleAddress) return;
>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd

  const order = await createOrder(
    state.quoteId,
    state.parsedCommand.settleAddress,
    state.parsedCommand.settleAddress
  );

  await db.createOrderEntry(
    ctx.from.id,
    state.parsedCommand,
    order,
    order.settleAmount,
    state.quoteId
  );

  await ctx.editMessageText(
    `✅ Order Created\n\nSend ${order.depositAmount} ${order.depositCoin} to:\n\`${order.depositAddress}\``,
    { parse_mode: 'Markdown' }
  );

<<<<<<< HEAD
<<<<<<< HEAD
            if (!checkout || !checkout.id) throw new Error("API Error");

            try { db.createCheckoutEntry(userId, checkout); } catch (e) { console.error(e); }

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

        } else {
            // --- Standard Swap Flow ---
            const order = await createOrder(state.quoteId, settleAddress, settleAddress); // refundAddress = settleAddress for simplicity
            if (!order.id) throw new Error("Failed to create order");

            db.createOrderEntry(userId, state.parsedCommand, order, order.settleAmount, state.quoteId);

            const msg =
                `✅ *Order Created!* (ID: \`${order.id}\`)\n\n` +
                `To complete the swap, please send funds to the address below:\n\n` +
                `🏦 *Deposit:* \`${(order.depositAddress as { address: string; memo: string; }).address || order.depositAddress}\`\n` +
                `💰 *Amount:* ${order.depositAmount} ${order.depositCoin}\n` +
                ((order.depositAddress as { address: string; memo: string; }).memo ? `📝 *Memo:* \`${(order.depositAddress as { address: string; memo: string; }).memo || ''}\`\n` : '') +
                `\n_Destination: ${settleAddress}_`;

            ctx.editMessageText(msg, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        console.error(error);
        ctx.editMessageText(`❌ Error creating order.`);
    } finally {
        db.clearConversationState(userId);
    }
=======
  await db.clearConversationState(ctx.from.id);
>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd
=======
  await db.clearConversationState(ctx.from.id);
>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd
});

bot.action('cancel_swap', async (ctx) => {
  if (!ctx.from) return;
  await db.clearConversationState(ctx.from.id);
  ctx.editMessageText('❌ Cancelled');
});

/* -------------------------------------------------------------------------- */
/* STARTUP                                   */
/* -------------------------------------------------------------------------- */
<<<<<<< HEAD

<<<<<<< HEAD
// --- Global State ---
let isReady = false;

// --- Server & Startup ---

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_, res) => {
    res.send('SwapSmith Alive');
});

app.get('/health', (_, res) => {
    if (isReady) {
        res.status(200).json({ status: 'ok' });
    } else {
        res.status(503).json({ status: 'starting' });
    }
});

app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));

(async () => {
    try {
        await orderMonitor.loadPendingOrders();
        orderMonitor.start();
        console.log('👀 Order Monitor started');

        await bot.launch();
        console.log('🤖 Bot launched successfully');

        isReady = true;
    } catch (e) {
        console.error('⚠️ Failed to start:', e);
        process.exit(1);
    }
})();
// Enable graceful stop
process.once('SIGINT', () => {
    isReady = false;
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    isReady = false;
    bot.stop('SIGTERM');
});
=======
const dcaScheduler = new DCAScheduler();

=======

const dcaScheduler = new DCAScheduler();

>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd
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

<<<<<<< HEAD
start();
>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd
=======
start();
>>>>>>> c5d084631228a04f2746db4475bc9a9b158820fd
