import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { parseUserCommand, transcribeAudio } from './services/groq-client';
import { createQuote, createOrder, createCheckout, getOrderStatus } from './services/sideshift-client';
import { getTopStablecoinYields } from './services/yield-client'; // Import Yield Client
import * as db from './services/database';
import { ethers } from 'ethers';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import express from 'express';

dotenv.config();
const MINI_APP_URL = process.env.MINI_APP_URL;
const bot = new Telegraf(process.env.BOT_TOKEN || '');

// ---ZW: Warn if ffmpeg is not installed ---
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

bot.on(message('text'), async (ctx) => {
  if (ctx.message.text.startsWith('/')) return; 
  await handleTextMessage(ctx, ctx.message.text, 'text');
});

bot.on(message('voice'), async (ctx) => {
    const userId = ctx.from.id;
    await ctx.reply('Pd_👂 Listening...'); // "Processing" indicator

    try {
        const file_id = ctx.message.voice.file_id;
        const fileLink = await ctx.telegram.getFileLink(file_id);
        
        // 1. Download & Convert
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const ogaPath = path.join(__dirname, `temp_${userId}.oga`);
        const mp3Path = path.join(__dirname, `temp_${userId}.mp3`);
        fs.writeFileSync(ogaPath, Buffer.from(response.data));
        execSync(`ffmpeg -i ${ogaPath} ${mp3Path} -y`);

        // 2. Transcribe
        const transcribedText = await transcribeAudio(mp3Path);
        
        // 3. Process with Voice Context
        // Pass 'voice' as the 3rd argument to activate the Voice Mode prompt
        await handleTextMessage(ctx, transcribedText, 'voice');

        // Cleanup
        fs.unlinkSync(ogaPath);
        fs.unlinkSync(mp3Path);

    } catch (error) {
        console.error("Voice error:", error);
        ctx.reply("Sorry, I couldn't hear that clearly. Please try again.");
    }
});

async function handleTextMessage(ctx: any, text: string, inputType: 'text' | 'voice' = 'text') {
  const userId = ctx.from.id;
  const state = db.getConversationState(userId);
  const history = state?.messages || [];

  await ctx.sendChatAction('typing');
  const parsed = await parseUserCommand(text, history, inputType);
  if (!parsed.success && parsed.intent !== 'yield_scout') {
      return ctx.reply(`⚠️ ${parsed.validationErrors.join(", ") || "I didn't understand."}`);
  }

  // --- 1. HANDLE YIELD SCOUT ---
  if (parsed.intent === 'yield_scout') {
      const yields = await getTopStablecoinYields();
      return ctx.replyWithMarkdown(
          `📈 *Top Stablecoin Yields (Real-time):*\n\n${yields}\n\n` +
          `_Want to invest? Just say "Swap 100 USDC to USDC on Base"_`
      );
  }

  // --- 2. HANDLE PORTFOLIO (COMPOSABILITY) ---
  if (parsed.intent === 'portfolio') {
      db.setConversationState(userId, { parsedCommand: parsed });
      
      let msg = `📊 *Portfolio Strategy Detected*\n\n`;
      msg += `Input: ${parsed.amount} ${parsed.fromAsset} (${parsed.fromChain})\n\n`;
      msg += `*Allocation Plan:*\n`;
      
      parsed.portfolio?.forEach(item => {
          msg += `• ${item.percentage}% → ${item.toAsset} on ${item.toChain}\n`;
      });

      msg += `\nGenerate quotes for this portfolio?`;

      return ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
          Markup.button.callback('✅ Execute Strategy', 'confirm_portfolio'),
          Markup.button.callback('❌ Cancel', 'cancel_swap')
      ]));
  }

  // --- 3. EXISTING SWAP/CHECKOUT LOGIC ---
  if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
      // (Keep existing logic for destination address check etc.)
      const destinationAddress = parsed.settleAddress;
      if (!destinationAddress) {
           // ... (Existing address prompt logic)
           return ctx.reply(`Please reply with the destination address.`);
      }
      // ... (Rest of existing logic)
      db.setConversationState(userId, { parsedCommand: parsed });
      // ... (Send confirmation buttons)
      ctx.reply("Confirm Swap...", Markup.inlineKeyboard([
          Markup.button.callback('✅ Yes', 'confirm_swap'), 
          Markup.button.callback('❌ No', 'cancel_swap')
      ]));
  }

  if (inputType === 'voice' && parsed.success) {
      // If voice, we might send the parsedMessage (which Groq optimized for speech) 
      // instead of a generic template.
      await ctx.reply(`🗣️ ${parsed.parsedMessage}`); 
  }
}

// --- PORTFOLIO EXECUTION HANDLER ---
bot.action('confirm_portfolio', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    const cmd = state.parsedCommand;

    if (!cmd || cmd.intent !== 'portfolio') return ctx.reply("Session expired.");

    await ctx.editMessageText("🔄 fetching quotes for your portfolio...");

    try {
        // We need an address to settle. For demo, we ask/assume one or use a dummy if not strictly enforced by SideShift yet (they need valid addr).
        // For this snippet, let's assume the user provided it in context or we prompt (omitted for brevity).
        const dummyAddr = "0x000000000000000000000000000000000000dead"; // Placeholder

        let buttons = [];
        let summary = "✅ *Quotes Generated:*\n\n";

        // Loop through portfolio items and generate quotes
        for (const item of cmd.portfolio!) {
            const splitAmount = (cmd.amount! * (item.percentage / 100));
            
            const quote = await createQuote(
                cmd.fromAsset!, cmd.fromChain!, 
                item.toAsset, item.toChain, 
                splitAmount, '1.1.1.1'
            );

            // Create Order
            const order = await createOrder(quote.id!, dummyAddr, dummyAddr); // Use real addr in prod
            
            // Build Mini App URL
            const parsedAmountHex = '0x' + ethers.parseUnits(splitAmount.toString(), 18).toString(16);
            const params = new URLSearchParams({
                to: order.depositAddress as string,
                value: parsedAmountHex,
                chainId: '8453', // Example: Base (Map dynamically in prod)
                token: cmd.fromAsset!,
                chain: cmd.fromChain!
            });

            summary += `🔹 ${item.percentage}%: ${splitAmount} ${cmd.fromAsset} → ${quote.settleAmount} ${item.toAsset}\n`;
            buttons.push([Markup.button.webApp(`✍️ Sign ${item.toAsset} Tx`, `${MINI_APP_URL}?${params.toString()}`)]);
        }

        ctx.replyWithMarkdown(summary, Markup.inlineKeyboard(buttons));

    } catch (e) {
        console.error(e);
        ctx.reply("Error executing portfolio strategy.");
    }
});

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
            chainId: chainId,
            // --- ADDED TOKEN AND CHAIN INFO ---
            token: state.parsedCommand.fromAsset || 'ETH',
            chain: fromChain || 'Ethereum'
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

const app = express();
app.get('/', (req, res) => res.send('SwapSmith Alive'));
app.listen(process.env.PORT || 3000, () => {
    console.log(`Express server live`);
});
bot.launch();
console.log('🤖 Bot is running (Mini App Mode)...');