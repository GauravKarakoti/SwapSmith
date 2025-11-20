import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
// --- MODIFIED: Removed WalletConnect imports ---
import { parseUserCommand, transcribeAudio } from './services/groq-client';
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

// --- Configuration ---
const MINI_APP_URL = process.env.MINI_APP_URL;

// --- Basic Bot Setup ---
const bot = new Telegraf(process.env.BOT_TOKEN || '');

// --- NEW: Warn if ffmpeg is not installed ---
try {
    execSync('ffmpeg -version');
    console.log('✅ ffmpeg is installed. Voice messages enabled.');
} catch (error) {
    console.warn('⚠️ ffmpeg not found. Voice messages will fail. Please install ffmpeg.');
}
// --- END NEW ---

// --- Bot Commands ---

bot.start((ctx) => {
  ctx.reply(
    "🤖 *Welcome to SwapSmith!*\n\n" +
    "I am your Voice-Activated Crypto Trading Assistant.\n" +
    "I use SideShift.ai for swaps and a Mini App for secure signing.\n\n" +
    "📜 *Commands:*\n" +
    "/history - See past orders\n" +
    "/checkouts - See payment links\n" +
    "/status [id] - Check order status\n" +
    "/clear - Reset conversation\n\n" +
    "🗣️ *Try saying:*\n" +
    "_'Swap 0.1 ETH on Ethereum for USDC on BSC'_",
    { parse_mode: 'Markdown' }
  );
});

// --- /history Command (for Swaps) ---
bot.command('history', (ctx) => {
    const userId = ctx.from.id;
    const orders = db.getUserHistory(userId);

    if (orders.length === 0) {
        return ctx.reply("You have no order history yet.");
    }

    let message = "Your last 10 orders:\n\n";
    orders.forEach((order) => {
        message += `*Order ${order.sideshift_order_id}* (${order.status})\n`;
        message += `  *Send:* ${order.from_amount} ${order.from_asset} (${order.from_network})\n`;
        message += `  *Rcv:* ~${order.settle_amount} ${order.to_asset} (${order.to_network})\n`;
        message += `  *To:* \`${order.deposit_address}\`\n`;
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
    const args = ctx.message.text.split(' ');
    let orderIdToCheck: string | null = args[1];

    try {
        if (!orderIdToCheck) {
            const lastOrder = db.getLatestUserOrder(userId);
            if (!lastOrder) {
                return ctx.reply("You have no order history to check. Send a swap first.");
            }
            orderIdToCheck = lastOrder.sideshift_order_id;
            await ctx.reply(`Checking status of your latest order: \`${orderIdToCheck}\``);
        }

        await ctx.reply(`⏳ Checking status...`);
        const status = await getOrderStatus(orderIdToCheck);

        // Update status in our DB
        db.updateOrderStatus(orderIdToCheck, status.status);

        let message = `*Order Status: ${status.id}*\n\n`;
        message += `  *Status:* \`${status.status.toUpperCase()}\`\n`;
        message += `  *Send:* ${status.depositAmount || '?'} ${status.depositCoin} (${status.depositNetwork})\n`;
        message += `  *Receive:* ${status.settleAmount || '?'} ${status.settleCoin} (${status.settleNetwork})\n`;
        message += `  *Deposit Address:* \`${status.depositAddress}\`\n`;
        message += `  *Created:* ${new Date(status.createdAt).toLocaleString()}\n`;

        ctx.replyWithMarkdown(message);

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.reply(`Sorry, couldn't get status. Error: ${errorMessage}`);
    }
});
// --- END NEW ---

// --- NEW: /checkouts Command (for Payments) ---
bot.command('checkouts', (ctx) => {
    const userId = ctx.from.id;
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
    });

    ctx.replyWithMarkdown(message, { link_preview_options: { is_disabled: true } });
});
// --- END NEW ---

// --- NEW: /clear Command ---
bot.command('clear', (ctx) => {
    db.clearConversationState(ctx.from.id);
    ctx.reply('✅ Conversation history cleared.');
});
// --- END NEW ---

// --- Main Message Handler ---

bot.on(message('text'), async (ctx) => {
  if (ctx.message.text.startsWith('/')) return; 
  await handleTextMessage(ctx, ctx.message.text);
});

bot.on(message('voice'), async (ctx) => {
    // --- MODIFIED: Removed wallet connection check ---
    const userId = ctx.from.id;

    await ctx.reply('🤖 Got voice message. Transcribing...');

    try {
        const file_id = ctx.message.voice.file_id;
        const fileLink = await ctx.telegram.getFileLink(file_id);
        
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const ogaBuffer = Buffer.from(response.data);

        const ogaPath = path.join(__dirname, `temp_${userId}.oga`);
        const mp3Path = path.join(__dirname, `temp_${userId}.mp3`);

        fs.writeFileSync(ogaPath, ogaBuffer);
        execSync(`ffmpeg -i ${ogaPath} ${mp3Path} -y`);

        const transcribedText = await transcribeAudio(mp3Path);
        await ctx.reply(`🗣️ I heard: "${transcribedText}"\n\nProcessing...`);
        
        await handleTextMessage(ctx, transcribedText);

        fs.unlinkSync(ogaPath);
        fs.unlinkSync(mp3Path);

    } catch (error) {
        console.error("Voice processing error:", error);
        ctx.reply("Sorry, I couldn't understand that voice message.");
    }
});

async function handleTextMessage(ctx: any, text: string) {
  const userId = ctx.from.id;

  try {
    const state = db.getConversationState(userId);
    const history = state?.messages || [];
    
    // Send typing indicator
    await ctx.sendChatAction('typing');
    
    const parsedCommand = await parseUserCommand(text, history);

    if (!parsedCommand.success) {
      const errors = parsedCommand.validationErrors?.join(', ') || 'I just couldn\'t understand.';
      
      const newHistory = [
          ...history,
          { role: 'user', content: text },
          { role: 'assistant', content: errors }
      ];
      db.setConversationState(userId, { messages: newHistory });

      return ctx.reply(`I'm sorry, I need more info.\n\n*Issue:* ${errors}\n\nPlease rephrase or add details.`);
    }
    
    // --- FIX: Check for missing destination address logic ---
    const destinationAddress = parsedCommand.settleAddress;
    
    if (parsedCommand.intent === 'swap') {
        
        // If we don't have a destination address, we MUST ask for it.
        if (!destinationAddress) {
             const newHistory = [
                ...history,
                { role: 'user', content: text },
                { role: 'assistant', content: `I need to know where to send the ${parsedCommand.toAsset}. Please reply with your ${parsedCommand.toChain} address.` }
            ];
            db.setConversationState(userId, { messages: newHistory });
            
            return ctx.reply(`📬 I need a destination address.\n\nPlease reply with the *${parsedCommand.toChain || 'receiving'}* address where you want to receive the ${parsedCommand.toAsset}.`);
        }

        db.setConversationState(userId, { parsedCommand });
        const fromChain = parsedCommand.fromChain || 'Unknown';
        const toChain = parsedCommand.toChain || 'Unknown';

        const confirmationMessage = `Please confirm your swap:

        ➡️ *Send:* ${parsedCommand.amount} ${parsedCommand.fromAsset} (on *${fromChain}*)
        ⬅️ *Receive:* ${parsedCommand.toAsset} (on *${toChain}*)
        📬 *To:* \`${destinationAddress}\`

        Is this correct?`;

        ctx.replyWithMarkdown(confirmationMessage, Markup.inlineKeyboard([
            Markup.button.callback('✅ Yes, Get Quote', 'confirm_swap'),
            Markup.button.callback('❌ Cancel', 'cancel_swap'),
        ]));

    } else if (parsedCommand.intent === 'checkout') {
        const { settleAsset, settleNetwork, settleAmount } = parsedCommand;
        
        // For checkouts, settleAddress is usually "my wallet", but since we are headless, we must require it.
        if (!destinationAddress) {
             const newHistory = [
                ...history,
                { role: 'user', content: text },
                { role: 'assistant', content: `I need to know where the payment should settle. Please reply with your ${settleNetwork} address.` }
            ];
            db.setConversationState(userId, { messages: newHistory });
            return ctx.reply(`📬 I need a destination address.\n\nPlease reply with the *${settleNetwork}* address where you want to receive the funds.`);
        }

        db.setConversationState(userId, { parsedCommand, checkoutAddress: destinationAddress });

        const confirmationMessage = `Please confirm your checkout:

        💰 *You Receive:* ${settleAmount} ${settleAsset} (on *${settleNetwork}*)
        📬 *To Address:* \`${destinationAddress}\`

        Is this correct?`;

        ctx.replyWithMarkdown(confirmationMessage, Markup.inlineKeyboard([
            Markup.button.callback('✅ Create Link', 'confirm_checkout'),
            Markup.button.callback('❌ Cancel', 'cancel_swap'),
        ]));
    } else {
        return ctx.reply("I understood the words, but not the intent. Please try rephrasing.");
    }

  } catch (error) {
    console.error(error);
    ctx.reply("Sorry, something went wrong.");
  }
}

// --- Button Handlers ---

bot.action('confirm_swap', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);

    if (!state || !state.parsedCommand || state.parsedCommand.intent !== 'swap') {
        return ctx.answerCbQuery('Session expired. Start over.');
    }

    try {
        await ctx.answerCbQuery('Fetching quote...');
        const quote = await createQuote(
            state.parsedCommand.fromAsset!,
            state.parsedCommand.fromChain!,
            state.parsedCommand.toAsset!,
            state.parsedCommand.toChain!,
            state.parsedCommand.amount!,
            '1.1.1.1'
        );

        if (quote.error || !quote.id) {
            return ctx.editMessageText(`Error getting quote: ${quote.error?.message || 'Unknown error'}`);
        }

        // Save quote info
        const newState = { 
            ...state, 
            quoteId: quote.id, 
            settleAmount: quote.settleAmount 
        };
        db.setConversationState(userId, newState);

        const quoteMessage =
          `Here's your quote:

          ➡️ *You Send:* \`${quote.depositAmount} ${quote.depositCoin}\`
          ⬅️ *You Receive:* \`${quote.settleAmount} ${quote.settleCoin}\`

          This quote is valid for a limited time. Ready to sign?`;

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
        ctx.editMessageText(`Error: ${errorMessage}`);
    }
});

bot.action('place_order', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);

    if (!state || !state.quoteId || !state.settleAmount || !state.parsedCommand) {
        return ctx.answerCbQuery('Session expired.');
    }

    try {
        await ctx.answerCbQuery('Setting up order...');
        
        // --- FIX: Use the REAL destination address from the state ---
        const destinationAddress = state.parsedCommand.settleAddress;

        if (!destinationAddress) {
             return ctx.editMessageText(`Error: Destination address is missing. Please start over and provide an address.`);
        }
        
        // We pass the destinationAddress to createOrder so SideShift knows where to send the funds later
        const order = await createOrder(state.quoteId, destinationAddress, destinationAddress);

        if (!order || !order.depositAddress || !order.id) {
            return ctx.editMessageText(`Error placing order with SideShift.`);
        }

        // Log order
        try {
            db.createOrderEntry(userId, state.parsedCommand, order, state.settleAmount, state.quoteId);
        } catch (e) { console.error("DB Error", e); }

        const { amount, fromChain } = state.parsedCommand;
        const depositAddress = typeof order.depositAddress === 'string' 
            ? order.depositAddress 
            : order.depositAddress.address;
            
        const memo = typeof order.depositAddress === 'object' 
            ? order.depositAddress.memo 
            : null;

        // --- MINI APP MECHANIC ---
        // Construct the URL for the Mini App to handle the signing
        
        // 1. Convert amount to atomic units (assuming 18 decimals for simplicity in this demo)
        let parsedAmountHex = '0x0';
        try {
            parsedAmountHex = '0x' + ethers.parseUnits(amount!.toString(), 18).toString(16);
        } catch (e) { console.error(e); }

        // 2. Get Chain ID
        const chainIdMap: { [key: string]: string } = {
            'ethereum': '1', 'bsc': '56', 'polygon': '137',
            'arbitrum': '42161', 'avalanche': '43114', 'optimism': '10', 'base': '8453'
        };
        const chainId = fromChain ? chainIdMap[fromChain.toLowerCase()] : '1';

        // 3. Build URL params
        const params = new URLSearchParams({
            to: depositAddress,
            value: parsedAmountHex,
            data: memo ? ethers.hexlify(ethers.toUtf8Bytes(memo)) : '0x', // Simple memo handling
            chainId: chainId
        });

        const webAppUrl = `${MINI_APP_URL}?${params.toString()}`;

        const QV = 
        `✅ *Order Created!* (ID: \`${order.id}\`)\n\n` +
          `To complete the swap, please sign the transaction in your wallet.\n\n` +
          `1. Click the button below.\n` +
          `2. Connect your wallet (MetaMask, etc).\n` +
          `3. Confirm the transaction.\n\n` +
          `_Destination: ${destinationAddress}_`;

        ctx.editMessageText(QV, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.webApp('📱 Sign Transaction', webAppUrl),
                Markup.button.callback('❌ Close', 'cancel_swap')
            ])
        });

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        ctx.editMessageText(`Failed to create order: ${errorMessage}`);
    }
});

// --- Button Handler for Checkouts ---
bot.action('confirm_checkout', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);

    if (!state || !state.parsedCommand || state.parsedCommand.intent !== 'checkout') {
        return ctx.answerCbQuery('Start over.');
    }

    try {
        await ctx.answerCbQuery('Creating link...');
        const { settleAsset, settleNetwork, settleAmount } = state.parsedCommand;
        // For checkout, we used checkoutAddress in state
        const finalSettleAddress = state.checkoutAddress || state.parsedCommand.settleAddress;

        const checkout = await createCheckout(
            settleAsset!, settleNetwork!, settleAmount!, finalSettleAddress, '1.1.1.1'
        );

        if (!checkout || !checkout.id) throw new Error("API Error");

        try {
            db.createCheckoutEntry(userId, checkout);
        } catch (e) { console.error(e); }

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

    } catch (error) {
        console.error(error);
        ctx.editMessageText(`Error creating link.`);
    } finally {
        db.clearConversationState(userId);
    }
});


bot.action('cancel_swap', (ctx) => {
    db.clearConversationState(ctx.from.id);
    ctx.editMessageText('❌ Cancelled.');
});

// --- Express Server for Render ---
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => { res.send('SwapSmith Bot Alive'); });

app.listen(port, () => {
    console.log(`Express server listening on port ${port}`);
});

bot.launch();
console.log('🤖 Bot is running (Mini App Mode)...');