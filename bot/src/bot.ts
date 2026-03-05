import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import rateLimit from 'telegraf-ratelimit';

import dotenv from 'dotenv';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { spawn } from 'child_process';
import express from 'express';
import cors from 'cors';

import { transcribeAudio } from './services/groq-client';
import logger, { Sentry, handleError } from './services/logger';
import { getOrderStatus } from './services/sideshift-client';
import { getTopStablecoinYields, formatYieldPools } from './services/yield-client';
import * as db from './services/database';
import { resolveAddress, isNamingService } from './services/address-resolver';
import { OrderMonitor } from './services/order-monitor';
import { isValidAddress } from './config/address-patterns';

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
    keyGenerator: (ctx: Context) => ctx.from?.id?.toString() || 'unknown',
    onLimitExceeded: async (ctx: Context) => {
      await ctx.reply('⚠️ Too many requests. Please slow down.');
    },
  })
);

const app = express();

const allowedOrigins = [
  MINI_APP_URL,
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(
  cors({
    origin: function (origin: any, callback: any) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(
          new Error(
            'The CORS policy for this site does not allow access from the specified Origin.'
          ),
          false
        );
      }

      return callback(null, true);
    },
  })
);

app.use(express.json());

/* -------------------------------------------------------------------------- */
/* COMMANDS                                                                   */
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
/* MESSAGE HANDLERS                                                           */
/* -------------------------------------------------------------------------- */

bot.on(message('text'), async (ctx) => {
  if (!ctx.message.text.startsWith('/')) {
    await ctx.reply('Message processed.');
  }
});

/* -------------------------------------------------------------------------- */
/* START BOT                                                                  */
/* -------------------------------------------------------------------------- */

bot.launch();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});