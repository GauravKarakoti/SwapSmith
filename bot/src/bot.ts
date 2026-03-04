import { Telegraf, Context } from 'telegraf';
import rateLimit from 'telegraf-ratelimit';

// Define the limit configuration
// Fixes ts(2345): removed 'next' and added explicit type 'Context'
const limitConfig = {
  window: 3000,
  limit: 1,
  onLimitExceeded: (ctx: Context) => {
    ctx.reply('Slow down! Please wait a moment before sending another message.');
  }
};

// Fixes ts(2580): 'process' requires @types/node
// Added fallback '' to ensure it's always a string
const bot = new Telegraf(process.env.BOT_TOKEN || '');

// Apply the rate limit middleware first
bot.use(rateLimit(limitConfig));

// Fixes ts(7006): Explicitly defining ': Context' for parameters
bot.start((ctx: Context) => ctx.reply('Welcome!'));

bot.on('text', (ctx: Context) => {
  // Your processing logic here
  ctx.reply('Message processed.');
});

bot.launch();
