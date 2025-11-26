import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { parseUserCommand, transcribeAudio } from './services/groq-client';
import { createQuote, createOrder, createCheckout, getOrderStatus } from './services/sideshift-client';
import { getTopStablecoinYields } from './services/yield-client'; 
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

// --- FFMPEG CHECK ---
try {
    execSync('ffmpeg -version');
    console.log('✅ ffmpeg is installed. Voice messages enabled.');
} catch (error) {
    console.warn('⚠️ ffmpeg not found. Voice messages will fail. Please install ffmpeg.');
}

// --- ERC20 CONFIGURATION ---
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)"
];

// Map of common tokens -> Address & Decimals
const TOKEN_MAP: Record<string, Record<string, { address: string, decimals: number }>> = {
  ethereum: {
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
    WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 }
  },
  base: {
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 }
  },
  arbitrum: {
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 }
  },
  polygon: {
    USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 }
  },
  bsc: {
    USDC: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
    USDT: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 }
  }
};

// --- COMMANDS ---

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

bot.command('history', (ctx) => {
    const userId = ctx.from.id;
    const orders = db.getUserHistory(userId);

    if (orders.length === 0) return ctx.reply("You have no order history yet.");

    let message = "Your last 10 orders:\n\n";
    orders.forEach((order) => {
        message += `*Order ${order.sideshift_order_id}* (${order.status})\n`;
        message += `  *Send:* ${order.from_amount} ${order.from_asset} (${order.from_network})\n`;
        message += `  *Rcv:* ~${order.settle_amount} ${order.to_asset} (${order.to_network})\n`;
        message += `  *To:* \`${order.deposit_address}\`\n`;
        if (order.tx_hash) message += `  *TxHash:* \`${order.tx_hash.substring(0, 10)}...\`\n`;
        message += `  *Date:* ${new Date(order.created_at).toLocaleString()}\n\n`;
    });
    ctx.replyWithMarkdown(message);
});

bot.command('status', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    let orderIdToCheck: string | null = args[1];

    try {
        if (!orderIdToCheck) {
            const lastOrder = db.getLatestUserOrder(userId);
            if (!lastOrder) return ctx.reply("You have no order history to check. Send a swap first.");
            orderIdToCheck = lastOrder.sideshift_order_id;
            await ctx.reply(`Checking status of your latest order: \`${orderIdToCheck}\``);
        }

        await ctx.reply(`⏳ Checking status...`);
        const status = await getOrderStatus(orderIdToCheck);
        db.updateOrderStatus(orderIdToCheck, status.status);

        let message = `*Order Status: ${status.id}*\n\n`;
        message += `  *Status:* \`${status.status.toUpperCase()}\`\n`;
        message += `  *Send:* ${status.depositAmount || '?'} ${status.depositCoin} (${status.depositNetwork})\n`;
        message += `  *Receive:* ${status.settleAmount || '?'} ${status.settleCoin} (${status.settleNetwork})\n`;
        message += `  *Created:* ${new Date(status.createdAt).toLocaleString()}\n`;

        ctx.replyWithMarkdown(message);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.reply(`Sorry, couldn't get status. Error: ${errorMessage}`);
    }
});

bot.command('checkouts', (ctx) => {
    const userId = ctx.from.id;
    const checkouts = db.getUserCheckouts(userId);
    if (checkouts.length === 0) return ctx.reply("You have no checkout history yet.");

    let message = "Your last 10 checkouts (payment links):\n\n";
    checkouts.forEach((checkout) => {
        const paymentUrl = `https://pay.sideshift.ai/checkout/${checkout.checkout_id}`;
        message += `*Checkout ${checkout.id}* (${checkout.status})\n`;
        message += `  *Receive:* ${checkout.settle_amount} ${checkout.settle_asset} (${checkout.settle_network})\n`;
        message += `  *Link:* [Pay Here](${paymentUrl})\n`;
    });
    ctx.replyWithMarkdown(message, { link_preview_options: { is_disabled: true } });
});

bot.command('clear', (ctx) => {
    db.clearConversationState(ctx.from.id);
    ctx.reply('✅ Conversation history cleared.');
});

// --- MESSAGE HANDLERS ---

bot.on(message('text'), async (ctx) => {
  if (ctx.message.text.startsWith('/')) return; 
  await handleTextMessage(ctx, ctx.message.text, 'text');
});

bot.on(message('voice'), async (ctx) => {
    const userId = ctx.from.id;
    await ctx.reply('Pd_👂 Listening...'); 

    try {
        const file_id = ctx.message.voice.file_id;
        const fileLink = await ctx.telegram.getFileLink(file_id);
        
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const ogaPath = path.join(__dirname, `temp_${userId}.oga`);
        const mp3Path = path.join(__dirname, `temp_${userId}.mp3`);
        fs.writeFileSync(ogaPath, Buffer.from(response.data));
        execSync(`ffmpeg -i ${ogaPath} ${mp3Path} -y`);

        const transcribedText = await transcribeAudio(mp3Path);
        await handleTextMessage(ctx, transcribedText, 'voice');

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

  if (parsed.intent === 'yield_scout') {
      const yields = await getTopStablecoinYields();
      return ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
  }

  if (parsed.intent === 'portfolio') {
      db.setConversationState(userId, { parsedCommand: parsed });
      let msg = `📊 *Portfolio Strategy Detected*\nInput: ${parsed.amount} ${parsed.fromAsset} (${parsed.fromChain})\n\n*Allocation Plan:*\n`;
      parsed.portfolio?.forEach(item => { msg += `• ${item.percentage}% → ${item.toAsset} on ${item.toChain}\n`; });
      return ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
          Markup.button.callback('✅ Execute Strategy', 'confirm_portfolio'),
          Markup.button.callback('❌ Cancel', 'cancel_swap')
      ]));
  }

  if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
      if (!parsed.settleAddress) return ctx.reply(`Please reply with the destination address.`);
      db.setConversationState(userId, { parsedCommand: parsed });
      ctx.reply("Confirm Swap...", Markup.inlineKeyboard([
          Markup.button.callback('✅ Yes', 'confirm_swap'), 
          Markup.button.callback('❌ No', 'cancel_swap')
      ]));
  }

  if (inputType === 'voice' && parsed.success) await ctx.reply(`🗣️ ${parsed.parsedMessage}`); 
}

// --- ACTION HANDLERS ---

bot.action('confirm_portfolio', async (ctx) => {
    // ... (Portfolio logic remains similar, ideally apply the same params fix here if used)
    ctx.reply("Portfolio execution not fully implemented in this snippet.");
});

bot.action('confirm_swap', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    if (!state?.parsedCommand || state.parsedCommand.intent !== 'swap') return ctx.answerCbQuery('Session expired.');

    try {
        await ctx.answerCbQuery('Fetching quote...');
        const quote = await createQuote(
            state.parsedCommand.fromAsset!, state.parsedCommand.fromChain!,
            state.parsedCommand.toAsset!, state.parsedCommand.toChain!,
            state.parsedCommand.amount!, '1.1.1.1'
        );

        if (quote.error) return ctx.editMessageText(`Error: ${quote.error.message}`);

        db.setConversationState(userId, { ...state, quoteId: quote.id, settleAmount: quote.settleAmount });
        const quoteMessage = `Here's your quote:\n\n➡️ *Send:* \`${quote.depositAmount} ${quote.depositCoin}\`\n⬅️ *Receive:* \`${quote.settleAmount} ${quote.settleCoin}\`\n\nReady?`;

        ctx.editMessageText(quoteMessage, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('✅ Place Order', 'place_order'),
                Markup.button.callback('❌ Cancel', 'cancel_swap'),
            ])
        });
    } catch (error) {
        ctx.editMessageText(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
});

bot.action('place_order', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    if (!state?.quoteId || !state.parsedCommand) return ctx.answerCbQuery('Session expired.');

    try {
        await ctx.answerCbQuery('Setting up order...');
        const destinationAddress = state.parsedCommand.settleAddress!;
        const order = await createOrder(state.quoteId, destinationAddress, destinationAddress);
        if (!order.id) throw new Error("Failed to create order");

        db.createOrderEntry(userId, state.parsedCommand, order, state.settleAmount, state.quoteId);

        const { amount, fromChain, fromAsset } = state.parsedCommand;
        
        // --- ERC20 Logic ---
        const rawDepositAddress = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress.address;
        const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress.memo : null;

        const chainKey = fromChain?.toLowerCase() || 'ethereum';
        const assetKey = fromAsset?.toUpperCase() || 'ETH';
        const tokenData = TOKEN_MAP[chainKey]?.[assetKey];

        let txTo = rawDepositAddress;
        let txValueHex = '0x0';
        let txData = '0x';

        try {
            if (tokenData) {
                // ERC20 Token
                txTo = tokenData.address;
                txValueHex = '0x0'; // Value is 0 for tokens
                const amountBigInt = ethers.parseUnits(amount!.toString(), tokenData.decimals);
                const iface = new ethers.Interface(ERC20_ABI);
                txData = iface.encodeFunctionData("transfer", [rawDepositAddress, amountBigInt]);
            } else {
                // Native Asset
                txTo = rawDepositAddress;
                const amountBigInt = ethers.parseUnits(amount!.toString(), 18);
                txValueHex = '0x' + amountBigInt.toString(16);
                if (depositMemo) txData = ethers.hexlify(ethers.toUtf8Bytes(depositMemo));
            }
        } catch (err) {
            return ctx.editMessageText(`Tx construction error: ${err instanceof Error ? err.message : 'Unknown'}`);
        }

        const chainIdMap: { [key: string]: string } = {
            'ethereum': '1', 'bsc': '56', 'polygon': '137', 'arbitrum': '42161', 'base': '8453'
        };

        const params = new URLSearchParams({
            to: txTo,
            value: txValueHex,
            data: txData,
            chainId: chainIdMap[fromChain?.toLowerCase() || 'ethereum'] || '1',
            token: assetKey,
            chain: fromChain || 'Ethereum',
            amount: amount!.toString() // <--- FIX: Pass explicit amount for UI
        });

        const webAppUrl = `${MINI_APP_URL}?${params.toString()}`;

        ctx.editMessageText(`✅ *Order Created!* (ID: \`${order.id}\`)\n\nClick below to sign.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.webApp('📱 Sign Transaction', webAppUrl),
                Markup.button.callback('❌ Close', 'cancel_swap')
            ])
        });

    } catch (error) {
        ctx.editMessageText(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
app.listen(process.env.PORT || 3000, () => console.log(`Express server live`));
bot.launch();
console.log('🤖 Bot is running...');