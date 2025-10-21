import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';
import qrcode from 'qrcode';
import { parseUserCommand } from './services/groq-client';
import { createCheckout } from './services/sideshift-client'; // UPDATED
import * as db from './services/database';

dotenv.config();

// --- Basic Bot Setup ---
const bot = new Telegraf(process.env.BOT_TOKEN || '');
let signClient: SignClient;
let tempTelegramId: number | null = null;

// --- WalletConnect v2.0 Initialization ---
async function initializeWalletConnect() {
  console.log("Initializing WalletConnect v2.0...");
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

  signClient.on("session_connect", ({ session }: { session: SessionTypes.Struct }) => {
    console.log("WalletConnect session connected:", session);
    const address = session.namespaces.eip155.accounts[0].split(':')[2];
    if (tempTelegramId) {
      db.setUserWalletAndSession(tempTelegramId, address, session.topic);
      bot.telegram.sendMessage(tempTelegramId, `✅ Wallet connected! Your address is: ${address}`);
      tempTelegramId = null;
    }
  });
  console.log("WalletConnect v2.0 initialized successfully!");

  signClient.on("session_delete", ({ id, topic }: { id: number; topic: string }) => {
    console.log("WalletConnect session deleted:", id, topic);
    // This logic is simple; a more robust implementation would
    // query the DB for the user with this 'topic' and clear them.
    // For now, we'll rely on the /disconnect command.
  });
}

initializeWalletConnect().catch(err => console.error("Failed to initialize WalletConnect", err));

// --- Bot Commands ---

bot.start((ctx) => {
  ctx.reply('Welcome to SwapSmith Bot! 🤖');
  ctx.reply("Use /connect to connect your wallet (this sets your receiving address).\nUse /disconnect to disconnect your wallet.\nUse /history to see your past 10 checkouts.\n\nThen, tell me what you want to *receive*, like 'I want 50 USDC on Polygon'");
});

// ... ( /connect command remains the same ) ...
bot.command('connect', async (ctx) => {
  const user = db.getUser(ctx.from.id);
  if (user && user.wallet_address && user.session_topic) {
      try {
        const isConnected = signClient.session.getAll().some(s => s.topic === user.session_topic);
        if (isConnected) {
          return ctx.reply(`You are already connected with address: ${user.wallet_address}`);
        }
      } catch (e) {
         console.warn("Could not check session, proceeding with reconnect.", e)
      }
  }

  tempTelegramId = ctx.from.id;
  try {
    const { uri, approval } = await signClient.connect({
        requiredNamespaces: {
            eip155: {
                methods: [
                    "eth_sendTransaction",
                    "personal_sign"
                ],
                chains: ["eip155:1"], // Requesting Ethereum mainnet by default
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
      const session = await approval();
      console.log("Session established:", session);
    }
  } catch (err) {
    console.error('Failed to connect or generate QR code', err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    ctx.reply(`Sorry, I couldn't generate the connection QR code. Please try again. \nError: ${errorMessage}`);
  }
});

bot.command('disconnect', async (ctx) => {
    const userId = ctx.from.id;
    const user = db.getUser(userId);
    if (user && user.session_topic) {
        try {
            await signClient.disconnect({
                topic: user.session_topic,
                reason: { code: 6000, message: "User disconnected" },
            });
        } catch (error) {
            console.error("Error disconnecting wallet:", error);
        }
    }
    db.clearUserWallet(userId);
    ctx.reply('Wallet disconnected.');
});


// --- UPDATED: /history Command ---
bot.command('history', (ctx) => {
    const userId = ctx.from.id;
    const user = db.getUser(userId);

    if (!user) {
        return ctx.reply('Please /connect your wallet first.');
    }

    const orders = db.getUserHistory(userId);

    if (orders.length === 0) {
        return ctx.reply("You have no order history yet.");
    }

    let message = "Your last 10 checkouts:\n\n";
    orders.forEach((order) => {
        message += `*Checkout ${order.id}* (${order.status})\n`;
        message += `  *Receive:* ${order.settle_amount} ${order.settle_asset} (${order.settle_network})\n`;
        message += `  *Checkout ID:* \`${order.checkout_id}\`\n`;
        message += `  *Date:* ${new Date(order.created_at).toLocaleString()}\n\n`;
    });

    ctx.replyWithMarkdown(message);
});


// --- Main Message Handler ---
bot.on(message('text'), async (ctx) => {
  const userInput = ctx.message.text;
  const userId = ctx.from.id;

  if (userInput.startsWith('/')) return;

  const user = db.getUser(userId);
  if (!user || !user.wallet_address || !user.session_topic) {
      return ctx.reply('Please connect your wallet first using the /connect command. Your connected wallet address will be used as the receiving address.');
  }

  try {
    const parsedCommand = await parseUserCommand(userInput);

    // --- UX IMPROVEMENT: Better error message ---
    if (!parsedCommand.success || !parsedCommand.settleAsset || !parsedCommand.settleNetwork || !parsedCommand.settleAmount) {
      const errors = parsedCommand.validationErrors?.join(', ') || 'I just couldn\'t understand.';
      return ctx.reply(`I'm sorry, I had trouble with that request.\n\n*Error:* ${errors}\n\nPlease try rephrasing, focusing on what you want to receive (e.g., 'I want 50 USDC on bsc').`);
    }
    
    db.setConversationState(userId, { parsedCommand });

    const confirmationMessage = `Please confirm your checkout:

    ➡️ *You Receive:* ${parsedCommand.settleAmount} ${parsedCommand.settleAsset}
    ➡️ *On Network:* ${parsedCommand.settleNetwork}
    ➡️ *To Address:* \`${user.wallet_address}\`

    Is this 100% correct?`;

    // --- UX IMPROVEMENT: Clearer buttons ---
    ctx.replyWithMarkdown(confirmationMessage, Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes, create payment link', 'confirm_checkout'), // Renamed
        Markup.button.callback('❌ Start Over', 'cancel_swap'), 
    ]));

  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    ctx.reply(`Sorry, something went wrong. Please try again. \nError: ${errorMessage}`);
  }
});


// --- Button Handlers ---
// --- UPDATED: This action now creates the checkout and sends the link ---
bot.action('confirm_checkout', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    const user = db.getUser(userId);

    if (!state || !state.parsedCommand || !user || !user.wallet_address) {
        return ctx.answerCbQuery('Something went wrong. Please start over.');
    }

    try {
        await ctx.answerCbQuery('Creating your payment link...');
        
        const { settleAsset, settleNetwork, settleAmount } = state.parsedCommand;

        const checkout = await createCheckout(
            settleAsset,
            settleNetwork,
            settleAmount.toString(),
            user.wallet_address,
            '1.1.1.1' // Using a placeholder IP as before
            // TODO: Add memo logic if needed
        );
        
        console.log('Received checkout response:', checkout);

        if (checkout.error || !checkout.id) {
            return ctx.editMessageText(`Error creating checkout: ${checkout.error?.message || 'Unknown error'}`);
        }

        // --- Log the order to the DB ---
        try {
            db.createOrderEntry(
                userId, 
                state.parsedCommand, 
                checkout
            );
        } catch (dbError) {
            console.error("Failed to log order to database:", dbError);
            // Don't fail the whole transaction, but log the error
        }

        const checkoutUrl = `https://pay.sideshift.ai/checkout/${checkout.id}`;

        const checkoutMessage =
          `✅ Checkout Created! (ID: ${checkout.id})

          Click the link below to go to the payment page. You can send any supported crypto to complete the order.

          *You will receive:*
          \`${checkout.settleAmount} ${checkout.settleCoin}\`

          *To your address:*
          \`${checkout.settleAddress}\`
          
          You can check this order later with /history.`;

        ctx.editMessageText(checkoutMessage, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.url('Go to Payment Page ➡️', checkoutUrl),
            ])
        });

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.editMessageText(`Sorry, I was unable to create your checkout. Please try again. \nError: ${errorMessage}`);
    } finally {
        db.clearConversationState(userId);
    }
});

// --- REMOVED: 'place_order' action is no longer needed. ---
// The 'confirm_checkout' action now handles everything.

bot.action('cancel_swap', (ctx) => {
    db.clearConversationState(ctx.from.id);
    // --- UX IMPROVEMENT: Guide user on next step ---
    ctx.editMessageText('Swap canceled. \n\nPlease type your request again (e.g., "I want 50 USDC on Polygon").');
});


bot.launch();

console.log('Bot is running with SideShift Pay (Checkout) integration...');