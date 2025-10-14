import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { parseUserCommand, ParsedCommand } from './services/groq-client';
import { createQuote } from './services/sideshift-client';
import * as db from './services/database'; // Import the database service

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN || '');

// --- Bot Commands ---

bot.start((ctx) => {
  ctx.reply('Welcome to SwapSmith Bot! 🤖');
  ctx.reply("Use /setwallet YOUR_WALLET_ADDRESS to save your address.\n\nThen, tell me what you want to swap, like 'Swap 0.1 ETH on Ethereum for USDC on BSC'");
});

bot.command('setwallet', (ctx) => {
    const walletAddress = ctx.message.text.split(' ')[1];
    if (!walletAddress) {
        return ctx.reply('Please provide a wallet address. Usage: /setwallet YOUR_WALLET_ADDRESS');
    }
    db.setUserWalletAddress(ctx.from.id, walletAddress);
    ctx.reply('✅ Your wallet address has been saved!');
});


// --- Main Message Handler ---

bot.on(message('text'), async (ctx) => {
  const userInput = ctx.message.text;
  const userId = ctx.from.id;

  // Ignore commands
  if (userInput.startsWith('/')) return;

  const user = db.getUser(userId);
  if (!user || !user.wallet_address) {
      return ctx.reply('Please set your wallet address first using the /setwallet command.');
  }

  try {
    const parsedCommand = await parseUserCommand(userInput);

    if (!parsedCommand.success || !parsedCommand.fromAsset || !parsedCommand.toAsset || !parsedCommand.amount) {
      return ctx.reply(`I couldn't understand that. ${parsedCommand.validationErrors?.join(', ')}`);
    }

    db.setConversationState(userId, { parsedCommand });
    
    const confirmationMessage = `You want to swap *${parsedCommand.amount} ${parsedCommand.fromAsset}* for *${parsedCommand.toAsset}*. Correct?`;

    ctx.replyWithMarkdown(confirmationMessage, Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes, proceed', 'confirm_swap'),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
    ]));

  } catch (error) {
    console.error(error);
    ctx.reply('Sorry, something went wrong. Please try again.');
  }
});


// --- Button Handlers ---

bot.action('confirm_swap', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    const user = db.getUser(userId);

    if (!state || !state.parsedCommand || !user || !user.wallet_address) {
        return ctx.answerCbQuery('Something went wrong. Please start over.');
    }
    
    try {
        await ctx.answerCbQuery('Fetching your quote...');
        const quote = await createQuote(
            state.parsedCommand.fromAsset,
            state.parsedCommand.fromChain,
            state.parsedCommand.toAsset,
            state.parsedCommand.toChain,
            state.parsedCommand.amount,
            '1.1.1.1' 
        );

        if (quote.error) {
            return ctx.editMessageText(`Error getting quote: ${quote.error.message}`);
        }
        
        const quoteMessage = 
`Here is your quote:
- You send: *${quote.depositAmount} ${quote.depositCoin}*
- You receive: *${quote.settleAmount} ${quote.settleCoin}*

Please sign the contract on your wallet to proceed.
${quote.memo ? `With this memo/tag: \`${quote.memo}\`` : ''}

Your receiving address is: \`${user.wallet_address}\``;

        ctx.editMessageText(quoteMessage, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error(error);
        ctx.editMessageText('Sorry, I was unable to get a quote. Please try again.');
    } finally {
        db.clearConversationState(userId);
    }
});


bot.action('cancel_swap', (ctx) => {
    db.clearConversationState(ctx.from.id);
    ctx.editMessageText('Swap canceled.');
});


bot.launch();

console.log('Bot is running...');