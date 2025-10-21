import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';
import qrcode from 'qrcode';
import { parseUserCommand } from './services/groq-client';
// --- MODIFIED: Import new checkout functions ---
import { createQuote, createOrder, createCheckout } from './services/sideshift-client';
import * as db from './services/database';
// --- END MODIFIED ---
import { ethers } from 'ethers';

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
  // --- MODIFIED: Updated start message ---
  ctx.reply("Use /connect to connect your wallet.\nUse /disconnect to disconnect your wallet.\nUse /history to see your past 10 orders.\nUse /checkouts to see your past 10 payment links.\n\nThen, tell me what you want to swap, like 'Swap 0.1 ETH on Ethereum for USDC on BSC' or 'I need to receive 50 USDC on Polygon'");
  // --- END MODIFIED ---
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


// --- /history Command (for Swaps) ---
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

    let message = "Your last 10 orders:\n\n";
    orders.forEach((order) => {
        message += `*Order ${order.id}* (${order.status})\n`;
        message += `  *Send:* ${order.from_amount} ${order.from_asset} (${order.from_network})\n`;
        message += `  *Rcv:* ~${order.settle_amount} ${order.to_asset} (${order.to_network})\n`;
        message += `  *To:* \`${order.deposit_address}\`\n`;
        message += `  *Date:* ${new Date(order.created_at).toLocaleString()}\n\n`;
    });

    ctx.replyWithMarkdown(message);
});

// --- NEW: /checkouts Command (for Payments) ---
bot.command('checkouts', (ctx) => {
    const userId = ctx.from.id;
    const user = db.getUser(userId);

    if (!user) {
        return ctx.reply('Please /connect your wallet first.');
    }

    const checkouts = db.getUserCheckouts(userId);

    if (checkouts.length === 0) {
        return ctx.reply("You have no checkout history yet.");
    }

    let message = "Your last 10 checkouts (payment links):\n\n";
    checkouts.forEach((checkout) => {
        const paymentUrl = `https://pay.sideshift.ai/checkout/${checkout.checkout_id}`;
        message += `*Checkout ${checkout.id}* (${checkout.status})\n`;
        message += `  *Receive:* ${checkout.settle_amount} ${checkout.settle_asset} (${checkout.settle_network})\n`;
        message += `  *Link:* [Pay Here](${paymentUrl})\n`;
        message += `  *Date:* ${new Date(checkout.created_at).toLocaleString()}\n\n`;
    });

    // --- FIX: Replaced disable_web_page_preview ---
    ctx.replyWithMarkdown(message, { link_preview_options: { is_disabled: true } });
});
// --- END NEW ---


// --- Main Message Handler ---
bot.on(message('text'), async (ctx) => {
  const userInput = ctx.message.text;
  const userId = ctx.from.id;

  if (userInput.startsWith('/')) return;

  const user = db.getUser(userId);
  if (!user || !user.wallet_address || !user.session_topic) {
      return ctx.reply('Please connect your wallet first using the /connect command.');
  }

  try {
    const parsedCommand = await parseUserCommand(userInput);

    // --- UX IMPROVEMENT: Better error message ---
    if (!parsedCommand.success) {
      const errors = parsedCommand.validationErrors?.join(', ') || 'I just couldn\'t understand.';
      return ctx.reply(`I'm sorry, I had trouble with that request.\n\n*Error:* ${errors}\n\nPlease try rephrasing your command.`);
    }
    
    db.setConversationState(userId, { parsedCommand });

    // --- NEW: Route based on intent ---
    if (parsedCommand.intent === 'swap') {
        const fromChain = parsedCommand.fromChain || 'Unknown';
        const toChain = parsedCommand.toChain || 'Unknown';

        const confirmationMessage = `Please confirm your swap:

        ➡️ *Send:* ${parsedCommand.amount} ${parsedCommand.fromAsset} (on *${fromChain}*)
        ⬅️ *Receive:* ${parsedCommand.toAsset} (on *${toChain}*)

        Is this 100% correct?`;

        ctx.replyWithMarkdown(confirmationMessage, Markup.inlineKeyboard([
            Markup.button.callback('✅ Yes, get quote', 'confirm_swap'),
            Markup.button.callback('❌ Start Over', 'cancel_swap'),
        ]));

    } else if (parsedCommand.intent === 'checkout') {
        const { settleAsset, settleNetwork, settleAmount } = parsedCommand;
        
        const confirmationMessage = `Please confirm your checkout:

        💰 *You Receive:* ${settleAmount} ${settleAsset} (on *${settleNetwork}*)
        📬 *To Address:* \`${user.wallet_address}\`

        I will generate a payment link for this. Is this correct?`;

        ctx.replyWithMarkdown(confirmationMessage, Markup.inlineKeyboard([
            Markup.button.callback('✅ Yes, create link', 'confirm_checkout'),
            Markup.button.callback('❌ Start Over', 'cancel_swap'),
        ]));
    } else {
        return ctx.reply("I understood your words, but not the intent. Please try rephrasing.");
    }
    // --- END NEW ---

  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    ctx.reply(`Sorry, something went wrong. Please try again. \nError: ${errorMessage}`);
  }
});


// --- Button Handlers ---
bot.action('confirm_swap', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    const user = db.getUser(userId);

    if (!state || !state.parsedCommand || state.parsedCommand.intent !== 'swap' || !user || !user.wallet_address) {
        return ctx.answerCbQuery('Something went wrong. Please start over.');
    }

    try {
        await ctx.answerCbQuery('Fetching your quote...');
        const quote = await createQuote(
            state.parsedCommand.fromAsset!,
            state.parsedCommand.fromChain!,
            state.parsedCommand.toAsset!,
            state.parsedCommand.toChain!,
            state.parsedCommand.amount!,
            '1.1.1.1' // Using a placeholder IP
        );

        if (quote.error || !quote.id) {
            return ctx.editMessageText(`Error getting quote: ${quote.error?.message || 'Unknown error'}`);
        }
        console.log('Received quote:', quote);

        // --- ORDER LOG IMPROVEMENT: Save quoteId and settleAmount to state ---
        const newState = { 
            ...state, 
            quoteId: quote.id, 
            settleAmount: quote.settleAmount 
        };
        db.setConversationState(userId, newState);
        console.log('Updated state with quote info:', db.getConversationState(userId));

        const quoteMessage =
          `Here's your quote:

          ➡️ *You Send:*
          \`${quote.depositAmount} ${quote.depositCoin}\`

          ⬅️ *You Receive:*
          \`${quote.settleAmount} ${quote.settleCoin}\`

          *Your receiving address:*
          \`${user.wallet_address}\`

          This quote is valid for a limited time.
          `;

        ctx.editMessageText(quoteMessage, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('✅ Place Order', 'place_order'),
                Markup.button.callback('❌ Cancel', 'cancel_swap'),
            ])
        });

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.editMessageText(`Sorry, I was unable to get a quote. Please try again. \nError: ${errorMessage}`);
    }
});

bot.action('place_order', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    const user = db.getUser(userId);
    console.log('Current state:', state);

    // --- ORDER LOG IMPROVEMENT: Updated guard to check for new state properties ---
    if (!state || !state.quoteId || !state.settleAmount || !user || !user.wallet_address || !state.parsedCommand || state.parsedCommand.intent !== 'swap' || !user.session_topic) {
        return ctx.answerCbQuery('Something went wrong. Please start over.');
    }

    try {
        await ctx.answerCbQuery('Placing your order...');
        const order = await createOrder(state.quoteId, user.wallet_address, user.wallet_address);

        if (!order || !order.depositAddress || !order.id) {
            return ctx.editMessageText(`Error placing order: Unknown error`);
        }

        // --- ORDER LOG IMPROVEMENT: Log the order to the DB ---
        try {
            db.createOrderEntry(
                userId, 
                state.parsedCommand, 
                order, 
                state.settleAmount, 
                state.quoteId
            );
        } catch (dbError) {
            console.error("Failed to log order to database:", dbError);
            // Don't fail the whole transaction, but log the error
        }


        const { amount, fromAsset, fromChain } = state.parsedCommand;
        const { address, memo } = order.depositAddress;

        const chainIdMap: { [key: string]: string } = {
            'ethereum': '1',
            'bsc': '56',
            'polygon': '137',
            'arbitrum': '42161',
            'avalanche': '43114',
            'optimism': '10',
            'base': '8453',
        };
        const chainId = fromChain ? chainIdMap[fromChain.toLowerCase()] : undefined;

        if (!chainId) {
             const orderMessage =
              `✅ Order Placed! (ID: ${order.id})

              This chain isn't supported for automatic sending from your wallet.
              Please send your funds *manually* to complete the swap:

              *Amount:* \`${amount} ${fromAsset}\`
              *Address:* \`${address}\`
              ${memo ? `*Memo/Tag:* \`${memo}\`` : ''}

              ⚠️ *Send the exact amount to this address.*
              
              You can check this order later with /history.`;
             ctx.editMessageText(orderMessage, { parse_mode: 'Markdown' });
             db.clearConversationState(userId);
             return
        }
        
        // This logic assumes the 'amount' is in standard units (e.g., Ether, not Wei)
        // This is a simplification and might fail for tokens with different decimals.
        // A robust solution would fetch token decimals.
        // For now, we'll assume ETH-like parsing.
        let parsedAmountHex;
        try {
            // A more robust way would be to check `fromAsset` for 'ETH' vs a token
            // For now, `ethers.parseEther` is a stand-in for "convert to base units"
            parsedAmountHex = '0x' + ethers.parseEther(amount!.toString()).toString(16)
        } catch (e) {
             console.error("Error parsing amount, defaulting to 0:", e);
             parsedAmountHex = '0x0';
        }

        console.log(`Preparing to send transaction on chain ID ${chainId} to address ${address} with amount ${parsedAmountHex}`);

        const transaction = {
            from: user.wallet_address,
            to: address,
            value: parsedAmountHex, // This is likely ONLY correct for native assets like ETH
            data: memo ? ethers.hexlify(ethers.toUtf8Bytes(memo)) : '0x',
            // TODO: For ERC20 tokens, 'to' would be the token contract, 'value' would be '0x0',
            // and 'data' would be an 'approve' or 'transfer' call.
            // This implementation will ONLY work correctly for NATIVE asset swaps (e.g., ETH on Ethereum).
        };
        
        const session = signClient.session.get(user.session_topic);
        console.log('Retrieved session:', session);
        if(!session) {
            return ctx.editMessageText('Could not find active WalletConnect session. Please reconnect.');
        }

        await signClient.request({
            topic: user.session_topic,
            chainId: `eip155:${chainId}`,
            request: {
                method: 'eth_sendTransaction',
                params: [transaction],
            },
        });
        console.log('Transaction request sent:', transaction);

        const orderMessage =
          `✅ Order Placed! (ID: ${order.id})

          A transaction request was sent to your wallet.

          Please approve the transaction to send:
          *Amount:* \`${amount} ${fromAsset}\`
          *To:* \`${address}\`
          ${memo ? `*Memo:* \`${memo}\`` : ''}
          
          You can check this order later with /history.`;

        ctx.editMessageText(orderMessage, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.editMessageText(`Sorry, I was unable to place your order or send the transaction request. Please try again. \nError: ${errorMessage}`);
    } finally {
        db.clearConversationState(userId);
    }
});

// --- NEW: Button Handler for Checkouts ---
bot.action('confirm_checkout', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    const user = db.getUser(userId);

    if (!state || !state.parsedCommand || state.parsedCommand.intent !== 'checkout' || !user || !user.wallet_address) {
        return ctx.answerCbQuery('Something went wrong. Please start over.');
    }

    try {
        await ctx.answerCbQuery('Creating your payment link...');
        const { settleAsset, settleNetwork, settleAmount } = state.parsedCommand;

        const checkout = await createCheckout(
            settleAsset!,
            settleNetwork!,
            settleAmount!,
            user.wallet_address,
            '1.1.1.1' // Placeholder IP
        );

        if (!checkout || !checkout.id) {
            return ctx.editMessageText('Error creating checkout: Unknown error');
        }

        // Log to new checkouts table
        try {
            db.createCheckoutEntry(userId, checkout);
        } catch (dbError) {
            console.error("Failed to log checkout to database:", dbError);
            // Don't fail the whole transaction, but log the error
        }

        const paymentUrl = `https://pay.sideshift.ai/checkout/${checkout.id}`;

        const checkoutMessage =
          `✅ Checkout Link Created!

          You can send this link to anyone to receive your payment:
          
          💰 *Receiving:* ${checkout.settleAmount} ${checkout.settleCoin} (on *${checkout.settleNetwork}*)
          📬 *To Your Address:* \`${checkout.settleAddress}\`
          
          *Payment Link:*
          ${paymentUrl}
          
          You can check this link later with /checkouts.`;

        // --- FIX: Replaced disable_web_page_preview ---
        ctx.editMessageText(checkoutMessage, { 
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true } 
        });

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.editMessageText(`Sorry, I was unable to create your checkout link. Please try again. \nError: ${errorMessage}`);
    } finally {
        db.clearConversationState(userId);
    }
});
// --- END NEW ---


bot.action('cancel_swap', (ctx) => {
    db.clearConversationState(ctx.from.id);
    // --- UX IMPROVEMENT: Guide user on next step ---
    ctx.editMessageText('Swap canceled. \n\nPlease type your swap request again.');
});


bot.launch();

console.log('Bot is running with WalletConnect v2.0...');