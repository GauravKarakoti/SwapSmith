import { Telegraf, Markup } from 'telegraf';
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
  return pattern.test(address.trim());
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
    "🤖 *Welcome to SwapSmith!*\n\n" +
      "Voice-Activated Crypto Trading Assistant.\n\n" +
      "📜 *Commands*\n" +
      "/yield – Top yields\n" +
      "/history – Orders\n" +
      "/checkouts – Payment links\n" +
      "/dca_list – DCA schedules\n\n" +
      "💡 *Try:* Swap $50 of USDC for ETH every Monday",
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.url('🌐 Visit Website', 'https://swap-smith.vercel.app'),
      ]),
    }
  );
});

// ------------------ TEXT ------------------

bot.on(message('text'), async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  await handleTextMessage(ctx, ctx.message.text, 'text');
});

// ------------------ VOICE ------------------

bot.on(message('voice'), async (ctx) => {
  const userId = ctx.from.id;
  await ctx.reply('👂 Listening...');

  const tempDir = os.tmpdir();
  const oga = path.join(tempDir, `${userId}.oga`);
  const mp3 = path.join(tempDir, `${userId}.mp3`);

  try {
    const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const audio = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    fs.writeFileSync(oga, Buffer.from(audio.data));

    await new Promise<void>((res, rej) =>
      exec(`ffmpeg -i "${oga}" "${mp3}" -y`, (e) => (e ? rej(e) : res()))
    );

    const text = await transcribeAudio(mp3);
    await handleTextMessage(ctx, text, 'voice');
  } catch {
    ctx.reply("Couldn't understand audio.");
  } finally {
    if (fs.existsSync(oga)) fs.unlinkSync(oga);
    if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
  }
});

// ------------------ CORE HANDLER ------------------

async function handleTextMessage(
  ctx: any,
  text: string,
  inputType: 'text' | 'voice'
) {
  const userId = ctx.from.id;
  const state = await db.getConversationState(userId);

  // Address collection
  if (state?.parsedCommand && !state.parsedCommand.settleAddress) {
    const resolved = await resolveAddress(userId, text.trim());
    const chain =
      state.parsedCommand.toChain ??
      state.parsedCommand.fromChain ??
      undefined;

    if (resolved.address && isValidAddress(resolved.address, chain)) {
      await db.setConversationState(userId, {
        parsedCommand: { ...state.parsedCommand, settleAddress: resolved.address },
      });

      return ctx.reply(
        `✅ Address resolved:\n\`${resolved.address}\`\n\nProceed?`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            Markup.button.callback('✅ Yes', 'confirm_swap'),
            Markup.button.callback('❌ Cancel', 'cancel_swap'),
          ]),
        }
      );
    }

    return ctx.reply('❌ Invalid address. Try again or /clear');
  }

  const parsed = await parseUserCommand(text, state?.messages || [], inputType);

  if (!parsed.success) {
    return ctx.reply(parsed.validationErrors.join('\n'));
  }

  // Yield scout
  if (parsed.intent === 'yield_scout') {
    const yields = await getTopStablecoinYields();
    return ctx.replyWithMarkdown(yields);
  }

  // Portfolio
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

  ctx.editMessageText('✅ Order created. Sign transaction.', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      Markup.button.webApp(
        '📱 Sign Transaction',
        `${MINI_APP_URL}?to=${order.depositAddress}`
      ),
    ]),
  });
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