import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
// Correctly import the SignClient and necessary types
import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';
import qrcode from 'qrcode';
import { parseUserCommand } from './services/groq-client';
import { createQuote, createOrder } from './services/sideshift-client';
import * as db from './services/database';

dotenv.config();

// --- Basic Bot Setup ---
const bot = new Telegraf(process.env.BOT_TOKEN || '');
// This declaration will now work correctly
let signClient: SignClient;
let tempTelegramId: number | null = null;

// --- WalletConnect v2.0 Initialization ---
async function initializeWalletConnect() {
  if (!process.env.WALLETCONNECT_PROJECT_ID) {
    throw new Error("WALLETCONNECT_PROJECT_ID is not set in the .env file.");
  }
  signClient = await SignClient.init({
    projectId: process.env.WALLETCONNECT_PROJECT_ID,
    metadata: {
      name: "SwapSmith Bot",
      description: "SwapSmith Bot for Telegram",
      url: "https://t.me/SwapSmithBot",
      icons: ["https://prd-akindo-private.s3.us-west-1.amazonaws.com/products/icons/MzjLGdOOqIA4ZGnr_medium.png"],
    },
  });

  // --- Event Listener for Successful Connection with proper types ---
  signClient.on("session_connect", ({ session }: { session: SessionTypes.Struct }) => {
    console.log("WalletConnect session connected:", session);
    const address = session.namespaces.eip155.accounts[0].split(':')[2];
    if (tempTelegramId) {
      db.setUserWalletAddress(tempTelegramId, address);
      bot.telegram.sendMessage(tempTelegramId, `✅ Wallet connected! Your address is: ${address}`);
      tempTelegramId = null; 
    }
  });

  // --- (Optional) Event Listener for Session Deletion with proper types ---
  signClient.on("session_delete", ({ id, topic }: { id: number; topic: string }) => {
    console.log("WalletConnect session deleted:", id, topic);
  });
}

initializeWalletConnect().catch(err => console.error("Failed to initialize WalletConnect", err));

// --- Bot Commands (No changes from here on) ---

bot.start((ctx) => {
  ctx.reply('Welcome to SwapSmith Bot! 🤖');
  ctx.reply("Use /connect to connect your wallet.\n\nThen, tell me what you want to swap, like 'Swap 0.1 ETH on Ethereum for USDC on BSC'");
});

bot.command('connect', async (ctx) => {
  tempTelegramId = ctx.from.id;

  try {
    const { uri, approval } = await signClient.connect({
        requiredNamespaces: {
            eip155: {
                methods: [
                    "eth_sendTransaction",
                    "personal_sign"
                ],
                chains: ["eip155:1"], // Example: Ethereum Mainnet
                events: [
                    "chainChanged",
                    "accountsChanged"
                ],
            },
        },
    });

    if (uri) {
      const qrCodeDataURL = await qrcode.toDataURL(uri);
      await ctx.replyWithPhoto(
        { source: Buffer.from(qrCodeDataURL.split(",")[1], 'base64') },
        { caption: 'Scan this QR code with a WalletConnect-compatible wallet (v2) to connect.' }
      );

      // Wait for the session to be established
      const session = await approval();
      console.log("Session established:", session);
    }
  } catch (err) {
    console.error('Failed to connect or generate QR code', err);
    ctx.reply('Sorry, I couldn\'t generate the connection QR code. Please try again.');
  }
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

  if (userInput.startsWith('/')) return;

  const user = db.getUser(userId);
  if (!user || !user.wallet_address) {
      return ctx.reply('Please connect your wallet first using the /connect command.');
  }

  try {
    const parsedCommand = await parseUserCommand(userInput);

    if (!parsedCommand.success || !parsedCommand.fromAsset || !parsedCommand.toAsset || !parsedCommand.amount) {
      return ctx.reply(`I couldn't understand that. ${parsedCommand.validationErrors?.join(', ')}`);
    }

    db.setConversationState(userId, { parsedCommand });
    
    const confirmationMessage = `You want to swap *${parsedCommand.amount} ${parsedCommand.fromAsset}* for *${parsedCommand.toAsset}*. Correct?`;

    ctx.replyWithMarkdown(confirmationMessage, Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes, get quote', 'confirm_swap'),
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

        if (quote.error || !quote.id) {
            return ctx.editMessageText(`Error getting quote: ${quote.error?.message || 'Unknown error'}`);
        }

        db.setConversationState(userId, { ...state, id: quote.id });
        
        const quoteMessage = 
`Here is your quote:
- You send: *${quote.depositAmount} ${quote.depositCoin}*
- You receive: *${quote.settleAmount} ${quote.settleCoin}*

Your receiving address is: \`${user.wallet_address}\``;

        ctx.editMessageText(quoteMessage, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('✅ Place Order', 'place_order'),
                Markup.button.callback('❌ Cancel', 'cancel_swap'),
            ])
        });

    } catch (error) {
        console.error(error);
        ctx.editMessageText('Sorry, I was unable to get a quote. Please try again.');
    }
});

bot.action('place_order', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    const user = db.getUser(userId);

    if (!state || !state.id || !user || !user.wallet_address) {
        return ctx.answerCbQuery('Something went wrong. Please start over.');
    }

    try {
        await ctx.answerCbQuery('Placing your order...');
        const order = await createOrder(state.id, user.wallet_address, user.wallet_address);

        const orderMessage = 
`✅ Order placed!

Please send *${state.parsedCommand.amount} ${state.parsedCommand.fromAsset}* to the following address:

\`${order.depositAddress}\`

${order.depositAddress.memo ? `With this memo/tag: \`${order.depositAddress.memo}\`` : ''}`;

        ctx.editMessageText(orderMessage, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error(error);
        ctx.editMessageText('Sorry, I was unable to place your order. Please try again.');
    } finally {
        db.clearConversationState(userId);
    }
});

bot.action('cancel_swap', (ctx) => {
    db.clearConversationState(ctx.from.id);
    ctx.editMessageText('Swap canceled.');
});


bot.launch();

console.log('Bot is running with WalletConnect v2.0...');