import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';
import qrcode from 'qrcode';
// --- MODIFIED: Import new groq function and more types ---
import { parseUserCommand, transcribeAudio } from './services/groq-client';
// --- MODIFIED: Import new sideshift functions ---
import { createQuote, createOrder, createCheckout, getOrderStatus } from './services/sideshift-client';
import * as db from './services/database';
import { ethers } from 'ethers';

// --- NEW: Imports for Voice Processing ---
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
// --- END NEW ---

// --- NEW: Import for Render deployment ---
import express from 'express';
// --- END NEW ---

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

// --- NEW: Warn if ffmpeg is not installed ---
try {
    execSync('ffmpeg -version');
    console.log('ffmpeg is installed. Voice messages enabled.');
} catch (error) {
    console.warn('ffmpeg not found. Voice messages will fail. Please install ffmpeg.');
}
// --- END NEW ---

initializeWalletConnect().catch(err => console.error("Failed to initialize WalletConnect", err));

// --- Bot Commands ---

bot.start((ctx) => {
  ctx.reply('Welcome to SwapSmith Bot! 🤖');
  // --- MODIFIED: Updated start message to include /clear ---
  ctx.reply("Use /connect to connect your wallet.\nUse /disconnect to disconnect your wallet.\nUse /history to see your past 10 orders.\nUse /checkouts to see your past 10 payment links.\nUse /status [order_id] to check an order.\nUse /clear to reset our conversation history (if I get confused).\n\nThen, tell me what you want to swap, like 'Swap 0.1 ETH on Ethereum for USDC on BSC' or 'I need to receive 50 USDC on Polygon' or 'Send 20 USDC on BSC to 0x...'.\n\nYou can also send a voice message!");
  // --- END MODIFIED ---
});

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
        // --- MODIFIED: Show SideShift Order ID ---
        message += `*Order ${order.sideshift_order_id}* (${order.status})\n`;
        message += `  *Send:* ${order.from_amount} ${order.from_asset} (${order.from_network})\n`;
        message += `  *Rcv:* ~${order.settle_amount} ${order.to_asset} (${order.to_network})\n`;
        message += `  *To:* \`${order.deposit_address}\`\n`;
        // --- NEW: Show TX Hash if it exists ---
        if (order.tx_hash) {
            message += `  *TxHash:* \`${order.tx_hash.substring(0, 10)}...\`\n`;
        }
        message += `  *Date:* ${new Date(order.created_at).toLocaleString()}\n\n`;
    });

    ctx.replyWithMarkdown(message);
});

// --- NEW: /status Command (for Tracking) ---
bot.command('status', async (ctx) => {
    const userId = ctx.from.id;
    const user = db.getUser(userId);
    if (!user) {
        return ctx.reply('Please /connect your wallet first.');
    }

    const args = ctx.message.text.split(' ');
    let orderIdToCheck: string | null = args[1]; // Get 'abc-123' from '/status abc-123'

    try {
        if (!orderIdToCheck) {
            // No ID provided, get the user's latest order
            const lastOrder = db.getLatestUserOrder(userId);
            if (!lastOrder) {
                return ctx.reply("You have no order history to check. Send a swap first.");
            }
            orderIdToCheck = lastOrder.sideshift_order_id;
            await ctx.reply(`No Order ID provided. Checking status of your latest order: \`${orderIdToCheck}\``);
        }

        await ctx.reply(`⏳ Checking status for order \`${orderIdToCheck}\`...`);
        
        const status = await getOrderStatus(orderIdToCheck);

        // Update status in our DB
        db.updateOrderStatus(orderIdToCheck, status.status);

        let message = `*Order Status: ${status.id}*\n\n`;
        message += `  *Status:* \`${status.status.toUpperCase()}\`\n`;
        message += `  *Send:* ${status.depositAmount || '?'} ${status.depositCoin} (${status.depositNetwork})\n`;
        message += `  *Receive:* ${status.settleAmount || '?'} ${status.settleCoin} (${status.settleNetwork})\n`;
        message += `  *Deposit Address:* \`${status.depositAddress}\`\n`;
        if (status.settleHash) {
            message += `  *Settle Tx:* \`${status.settleHash}\`\n`;
        }
        if (status.depositHash) {
            message += `  *Deposit Tx:* \`${status.depositHash}\`\n`;
        }
        message += `  *Created:* ${new Date(status.createdAt).toLocaleString()}\n`;
        message += `  *Updated:* ${new Date(status.updatedAt).toLocaleString()}\n`;

        ctx.replyWithMarkdown(message);

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.reply(`Sorry, I couldn't get the status. \nError: ${errorMessage}`);
    }
});
// --- END NEW ---


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
        message += `  *To Address:* \`${checkout.settle_address}\`\n`; // <-- Show the destination address
        message += `  *Link:* [Pay Here](${paymentUrl})\n`;
        message += `  *Date:* ${new Date(checkout.created_at).toLocaleString()}\n\n`;
    });

    // --- FIX: Replaced disable_web_page_preview ---
    ctx.replyWithMarkdown(message, { link_preview_options: { is_disabled: true } });
});
// --- END NEW ---

// --- NEW: /clear Command (for resetting context) ---
bot.command('clear', (ctx) => {
    const userId = ctx.from.id;
    db.clearConversationState(userId);
    ctx.reply('✅ Your conversation history has been cleared. \n\nI will no longer remember the context of our previous messages. You can start a new swap.');
});
// --- END NEW ---


// --- Main Message Handler ---
// --- MODIFIED: Refactored text handler to support voice ---
bot.on(message('text'), async (ctx) => {
  if (ctx.message.text.startsWith('/')) return; // Ignore commands
  await handleTextMessage(ctx, ctx.message.text);
});

bot.on(message('voice'), async (ctx) => {
    const userId = ctx.from.id;
    const user = db.getUser(userId);
    if (!user || !user.wallet_address || !user.session_topic) {
        return ctx.reply('Please connect your wallet first using the /connect command.');
    }

    await ctx.reply('🤖 Got your voice message. Transcribing...');

    try {
        // --- FIX: Get file_id from message and use getFileLink directly ---
        const file_id = ctx.message.voice.file_id;
        const fileLink = await ctx.telegram.getFileLink(file_id);
        // --- END FIX ---
        
        // Download the .oga file
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const ogaBuffer = Buffer.from(response.data);

        // Define temp file paths
        const ogaPath = path.join(__dirname, `temp_${userId}.oga`);
        const mp3Path = path.join(__dirname, `temp_${userId}.mp3`);

        // Save .oga, convert to .mp3
        fs.writeFileSync(ogaPath, ogaBuffer);
        execSync(`ffmpeg -i ${ogaPath} ${mp3Path} -y`);

        // Transcribe .mp3
        const transcribedText = await transcribeAudio(mp3Path);
        await ctx.reply(`I heard: "${transcribedText}"\n\nProcessing...`);
        
        // Handle the transcribed text
        await handleTextMessage(ctx, transcribedText);

        // Clean up temp files
        fs.unlinkSync(ogaPath);
        fs.unlinkSync(mp3Path);

    } catch (error) {
        console.error("Voice processing error:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.reply(`Sorry, I had trouble understanding your voice message. Please try again. \nError: ${errorMessage}`);
    }
});

async function handleTextMessage(ctx: any, text: string) {
  const userId = ctx.from.id;

  const user = db.getUser(userId);
  if (!user || !user.wallet_address || !user.session_topic) {
      return ctx.reply('Please connect your wallet first using the /connect command.');
  }

  try {
    // --- MODIFIED: Pass conversation history to parser ---
    const state = db.getConversationState(userId);
    const history = state?.messages || [];
    const parsedCommand = await parseUserCommand(text, history);
    // --- END MODIFIED ---

    // --- UX IMPROVEMENT: Handle ambiguity and follow-up questions ---
    if (!parsedCommand.success) {
      const errors = parsedCommand.validationErrors?.join(', ') || 'I just couldn\'t understand.';
      
      // Save context for follow-up
      const newHistory = [
          ...history,
          { role: 'user', content: text },
          { role: 'assistant', content: errors }
      ];
      db.setConversationState(userId, { messages: newHistory });

      return ctx.reply(`I'm sorry, I had trouble with that request.\n\n*Error:* ${errors}\n\nPlease try rephrasing or provide the missing info.`);
    }
    
    // --- Route based on intent ---
    if (parsedCommand.intent === 'swap') {
        // --- MODIFIED: Save full successful command to state ---
        db.setConversationState(userId, { parsedCommand }); // Save state for swap
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
        // --- MODIFICATION: Use specified address or fallback to user's wallet ---
        const { settleAsset, settleNetwork, settleAmount } = parsedCommand;
        const destinationAddress = parsedCommand.settleAddress || user.wallet_address;

        // Save the final address to state for the button handler
        // --- MODIFIED: Save full successful command to state ---
        db.setConversationState(userId, { parsedCommand, checkoutAddress: destinationAddress });

        const confirmationMessage = `Please confirm your checkout:

        💰 *You Receive:* ${settleAmount} ${settleAsset} (on *${settleNetwork}*)
        📬 *To Address:* \`${destinationAddress}\`

        I will generate a payment link for this. Is this correct?`;
        // --- END MODIFICATION ---

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
}
// --- END NEW ---


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

        console.log('Order placed:', order);
        const { amount, fromAsset, fromChain } = state.parsedCommand;
        const address = order.depositAddress;
        const memo = order.depositAddress.memo;

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
              `✅ Order Placed! (ID: \`${order.id}\`)

              This chain isn't supported for automatic sending from your wallet.
              Please send your funds *manually* to complete the swap:

              *Amount:* \`${amount} ${fromAsset}\`
              *Address:* \`${address}\`
              ${memo ? `*Memo/Tag:* \`${memo}\`` : ''}

              ⚠️ *Send the exact amount to this address.*
              
              You can check this order's status with \`/status ${order.id}\`.`;
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
            parsedAmountHex = '0x' + ethers.parseUnits(amount!.toString(), 18).toString(16) // Assume 18 decimals
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

        // --- NEW: Enhanced Confirmation with Safety Check ---
        // Save transaction to state for final confirmation
        const newState = { ...state, transaction, chainId, sideshiftOrderId: order.id };
        db.setConversationState(userId, newState);
        console.log("Transaction:", transaction);

        const confirmationMessage = `
        ✅ Order Placed! (ID: \`${order.id}\`)
        
        Please confirm the transaction details below before sending to your wallet:

        *Chain:* ${fromChain} (ID: ${chainId})
        *To:* \`${transaction.to}\`
        *Amount:* ${amount} ${fromAsset}
        *Value (Hex):* \`${transaction.value}\`
        *Data:* \`${transaction.data}\`
        ${memo ? `*Memo:* \`${memo}\`` : ''}

        ⚠️ *Double-check this information!*
        Is this 100% correct?
        `;

        ctx.editMessageText(confirmationMessage, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('✅ Yes, Send to Wallet', 'confirm_send_tx'),
                Markup.button.callback('❌ Cancel Swap', 'cancel_swap'),
            ])
        });
        // --- END NEW ---

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        
        // --- MODIFICATION START ---
        if (errorMessage.includes("No matching key. session:")) {
            ctx.editMessageText('Your wallet session has expired. Please reconnect your wallet using /connect and try again.');
        } else {
            ctx.editMessageText(`Sorry, I was unable to place your order. Please try again. \nError: ${errorMessage}`);
        }
        // --- MODIFICATION END ---
        
        db.clearConversationState(userId); // Clear state on error
    }
});

// --- NEW: Handler for the final transaction confirmation ---
bot.action('confirm_send_tx', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    const user = db.getUser(userId);

    if (!state || !state.transaction || !state.chainId || !state.sideshiftOrderId || !user || !user.session_topic) {
        return ctx.answerCbQuery('Session expired. Please start over.');
    }

    try {
        await ctx.answerCbQuery('Sending request to your wallet...');

        const { transaction, chainId, sideshiftOrderId } = state;

        const txHash: string = await signClient.request({
            topic: user.session_topic,
            chainId: `eip155:${chainId}`,
            request: {
                method: 'eth_sendTransaction',
                params: [transaction],
            },
        });

        console.log('Transaction request sent, hash:', txHash);

        // Save the tx hash to the database
        db.setOrderTxHash(sideshiftOrderId, txHash);

        const orderMessage =
          `✅ Transaction request sent to your wallet!
          
          *Order ID:* \`${sideshiftOrderId}\`
          *Tx Hash:* \`${txHash}\`

          Please approve the transaction in your wallet.
          
          You can check the status any time with:
          \`/status ${sideshiftOrderId}\``;

        ctx.editMessageText(orderMessage, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        
        // --- MODIFICATION START ---
        if (errorMessage.includes("No matching key. session:")) {
            ctx.editMessageText('Your wallet session has expired. Please reconnect your wallet using /connect and try again.');
        } else {
            ctx.editMessageText(`Sorry, I was unable to send the transaction request. Please try again. \nError: ${errorMessage}`);
        }
        // --- MODIFICATION END ---

    } finally {
        db.clearConversationState(userId);
    }
});
// --- END NEW ---


// --- NEW: Button Handler for Checkouts ---
bot.action('confirm_checkout', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    const user = db.getUser(userId);

    // --- MODIFICATION: Update guard to check for checkoutAddress ---
    if (!state || !state.parsedCommand || state.parsedCommand.intent !== 'checkout' || !user || !state.checkoutAddress) {
        return ctx.answerCbQuery('Something went wrong. Please start over.');
    }
    // --- END MODIFICATION ---

    try {
        await ctx.answerCbQuery('Creating your payment link...');
        const { settleAsset, settleNetwork, settleAmount } = state.parsedCommand;
        // --- MODIFICATION: Get final address from state ---
        const finalSettleAddress = state.checkoutAddress;
        // --- END MODIFICATION ---

        const checkout = await createCheckout(
            settleAsset!,
            settleNetwork!,
            settleAmount!,
            finalSettleAddress,
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
          📬 *To Address:* \`${checkout.settleAddress}\`
          
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
    ctx.editMessageText('Swap canceled. \n\nPlease type your request again.');
});

// --- NEW: Express Server for Render Health Check ---
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is alive!');
});

app.listen(port, () => {
    console.log(`Express server listening on port ${port} for Render health checks.`);
});
// --- END NEW ---

bot.launch();

console.log('Bot is running with WalletConnect v2.0...');