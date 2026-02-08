import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { parseUserCommand, transcribeAudio } from './services/groq-client';
import { createQuote, createOrder, createCheckout, getOrderStatus } from './services/sideshift-client';
import { getTopStablecoinYields, getTopYieldPools } from './services/yield-client';
import * as db from './services/database';
import { ethers } from 'ethers';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import express from 'express';
import { chainIdMap } from './config/chains';
import { handleError } from './services/logger';
import { tokenResolver } from './services/token-resolver';

dotenv.config();
const MINI_APP_URL = process.env.MINI_APP_URL!;
const bot = new Telegraf(process.env.BOT_TOKEN!);

// --- ADDRESS VALIDATION PATTERNS ---
const ADDRESS_PATTERNS: Record<string, RegExp> = {
  // EVM chains
  ethereum: /^0x[a-fA-F0-9]{40}$/,
  base: /^0x[a-fA-F0-9]{40}$/,
  arbitrum: /^0x[a-fA-F0-9]{40}$/,
  polygon: /^0x[a-fA-F0-9]{40}$/,
  bsc: /^0x[a-fA-F0-9]{40}$/,
  optimism: /^0x[a-fA-F0-9]{40}$/,
  avalanche: /^0x[a-fA-F0-9]{40}$/,
  fantom: /^0x[a-fA-F0-9]{40}$/,
  cronos: /^0x[a-fA-F0-9]{40}$/,
  moonbeam: /^0x[a-fA-F0-9]{40}$/,
  moonriver: /^0x[a-fA-F0-9]{40}$/,
  celo: /^0x[a-fA-F0-9]{40}$/,
  gnosis: /^0x[a-fA-F0-9]{40}$/,
  harmony: /^0x[a-fA-F0-9]{40}$/,
  metis: /^0x[a-fA-F0-9]{40}$/,
  aurora: /^0x[a-fA-F0-9]{40}$/,
  kava: /^0x[a-fA-F0-9]{40}$/,
  evmos: /^0x[a-fA-F0-9]{40}$/,
  boba: /^0x[a-fA-F0-9]{40}$/,
  okc: /^0x[a-fA-F0-9]{40}$/,
  heco: /^0x[a-fA-F0-9]{40}$/,
  iotex: /^0x[a-fA-F0-9]{40}$/,
  klaytn: /^0x[a-fA-F0-9]{40}$/,
  conflux: /^0x[a-fA-F0-9]{40}$/,
  astar: /^0x[a-fA-F0-9]{40}$/,
  shiden: /^0x[a-fA-F0-9]{40}$/,
  telos: /^0x[a-fA-F0-9]{40}$/,
  fuse: /^0x[a-fA-F0-9]{40}$/,
  velas: /^0x[a-fA-F0-9]{40}$/,
  thundercore: /^0x[a-fA-F0-9]{40}$/,
  xdc: /^xdc[a-fA-F0-9]{40}$/,
  nahmii: /^0x[a-fA-F0-9]{40}$/,
  callisto: /^0x[a-fA-F0-9]{40}$/,
  smartbch: /^0x[a-fA-F0-9]{40}$/,
  energyweb: /^0x[a-fA-F0-9]{40}$/,
  theta: /^0x[a-fA-F0-9]{40}$/,
  flare: /^0x[a-fA-F0-9]{40}$/,
  songbird: /^0x[a-fA-F0-9]{40}$/,
  coston: /^0x[a-fA-F0-9]{40}$/,
  coston2: /^0x[a-fA-F0-9]{40}$/,
  rei: /^0x[a-fA-F0-9]{40}$/,
  kekchain: /^0x[a-fA-F0-9]{40}$/,
  tomochain: /^0x[a-fA-F0-9]{40}$/,
  bitgert: /^0x[a-fA-F0-9]{40}$/,
  clover: /^0x[a-fA-F0-9]{40}$/,
  defichain: /^0x[a-fA-F0-9]{40}$/,
  findora: /^0x[a-fA-F0-9]{40}$/,
  gatechain: /^0x[a-fA-F0-9]{40}$/,
  meter: /^0x[a-fA-F0-9]{40}$/,
  nova: /^0x[a-fA-F0-9]{40}$/,
  syscoin: /^0x[a-fA-F0-9]{40}$/,
  zksync: /^0x[a-fA-F0-9]{40}$/,
  polygonzkevm: /^0x[a-fA-F0-9]{40}$/,
  linea: /^0x[a-fA-F0-9]{40}$/,
  mantle: /^0x[a-fA-F0-9]{40}$/,
  scroll: /^0x[a-fA-F0-9]{40}$/,
  taiko: /^0x[a-fA-F0-9]{40}$/,
  bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  polkadot: /^1[a-zA-Z0-9]{47}$/,
  cardano: /^addr1[a-z0-9]{98}$|^Ae2tdPwUPEZ[a-zA-Z0-9]{50}$/,
  monero: /^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/,
  litecoin: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
  dogecoin: /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{24,33}$/,
  dash: /^X[1-9A-HJ-NP-Za-km-z]{33}$/,
  zcash: /^t1[a-zA-Z0-9]{33}$|^t3[a-zA-Z0-9]{33}$/,
  ripple: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  stellar: /^G[A-Z0-9]{55}$/,
  cosmos: /^cosmos1[a-z0-9]{38}$/,
  osmosis: /^osmo1[a-z0-9]{38}$/,
  terra: /^terra1[a-z0-9]{38}$/,
  tron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  tezos: /^tz[1-3][a-zA-Z0-9]{33}$/,
  algorand: /^[A-Z0-9]{58}$/,
  near: /^[a-z0-9_-]{2,64}\.near$|^[a-fA-F0-9]{64}$/,
  flow: /^0x[a-fA-F0-9]{16}$/,
  hedera: /^0\.0\.\d+$/,
  elrond: /^erd1[a-z0-9]{58}$/,
  kusama: /^[A-Z0-9]{47}$/,
  rsk: /^0x[a-fA-F0-9]{40}$/,
  waves: /^3P[a-zA-Z0-9]{33}$/,
  zilliqa: /^zil1[a-z0-9]{38}$/,
};

function isValidAddress(address: string, chain?: string): boolean {
  if (!address) return false;
  const targetChain = chain?.toLowerCase() || 'ethereum';
  const pattern = ADDRESS_PATTERNS[targetChain] || ADDRESS_PATTERNS.ethereum;
  return pattern.test(address.trim());
}

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

async function logAnalytics(ctx: any, errorType: string, details: any) {
    await handleError(errorType, details, ctx, true);
}

// --- COMMANDS ---

bot.start((ctx) => {
    ctx.reply(
        "🤖 *Welcome to SwapSmith!*\n\n" +
        "I am your Voice-Activated Crypto Trading Assistant.\n" +
        "I use SideShift.ai for swaps and a Mini App for secure signing.\n\n" +
        "📜 *Commands:*\n" +
        "/website - Open Web App\n" +
        "/yield - See top yield opportunities\n" +
        "/history - See past orders\n" +
        "/checkouts - See payment links\n" +
        "/status [id] - Check order status\n" +
        "/clear - Reset conversation\n\n" +
        "💡 *Tip:* Check out our web interface for a graphical experience!",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.url('🌐 Visit Website', "https://swap-smith.vercel.app/")
            ])
        }
    );
});

bot.command('history', async (ctx) => {
    const userId = ctx.from.id;
    const orders = await db.getUserHistory(userId);

    if (orders.length === 0) return ctx.reply("You have no order history yet.");

    let message = "Your last 10 orders:\n\n";
    orders.forEach((order) => {
        message += `*Order ${order.sideshiftOrderId}* (${order.status})\n`;
        message += `  *Send:* ${order.fromAmount} ${order.fromAsset} (${order.fromNetwork})\n`;
        message += `  *Rcv:* ~${order.settleAmount} ${order.toAsset} (${order.toNetwork})\n`;
        message += `  *To:* \`${order.depositAddress}\`\n`;
        if (order.txHash) message += `  *TxHash:* \`${order.txHash.substring(0, 10)}...\`\n`;
        message += `  *Date:* ${new Date(order.createdAt as Date).toLocaleString()}\n\n`;
    });
    ctx.replyWithMarkdown(message);
});

bot.command('status', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    let orderIdToCheck: string | null = args[1];

    try {
        if (!orderIdToCheck) {
            const lastOrder = await db.getLatestUserOrder(userId);
            if (!lastOrder) return ctx.reply("You have no order history to check. Send a swap first.");
            orderIdToCheck = lastOrder.sideshiftOrderId;
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

bot.command('checkouts', async (ctx) => {
    const userId = ctx.from.id;
    const checkouts = await db.getUserCheckouts(userId);
    if (checkouts.length === 0) return ctx.reply("You have no checkout history yet.");

    let message = "Your last 10 checkouts (payment links):\n\n";
    checkouts.forEach((checkout) => {
        const paymentUrl = `https://pay.sideshift.ai/checkout/${checkout.checkoutId}`;
        message += `*Checkout ${checkout.id}* (${checkout.status})\n`;
        message += `  *Receive:* ${checkout.settleAmount} ${checkout.settleAsset} (${checkout.settleNetwork})\n`;
        message += `  *Link:* [Pay Here](${paymentUrl})\n`;
    });
    ctx.replyWithMarkdown(message, { link_preview_options: { is_disabled: true } });
});

bot.command('clear', (ctx) => {
    db.clearConversationState(ctx.from.id);
    ctx.reply('✅ Conversation history cleared.');
});

bot.command('website', (ctx) => {
    ctx.reply(
        "🌐 *SwapSmith Web Interface*\n\nClick the button below to access the full graphical interface.",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.url('🚀 Open Website', "https://swap-smith.vercel.app/")
            ])
        }
    );
});

bot.command('yield', async (ctx) => {
    await ctx.reply('📈 Fetching top yield opportunities...');
    const yields = await getTopStablecoinYields();
    ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
});

bot.command('add_address', async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ').slice(1);

  if (args.length < 3) {
    return ctx.reply("Usage: /add_address <nickname> <address> <chain>\nExample: /add_address mywallet 0x123... ethereum");
  }

  const [nickname, address, chain] = args;

  try {
    await db.addAddressBookEntry(userId, nickname, address, chain);
    ctx.reply(`✅ Added "${nickname}" → \`${address}\` on ${chain}`, { parse_mode: 'Markdown' });
  } catch (error) {
    ctx.reply("❌ Failed to add address. It might already exist.");
  }
});

bot.command('list_addresses', async (ctx) => {
  const userId = ctx.from.id;
  const addresses = await db.getAddressBookEntries(userId);

  if (addresses.length === 0) {
    return ctx.reply("You have no saved addresses. Use /add_address to add some.");
  }

  let message = "📖 *Your Address Book:*\n\n";
  addresses.forEach((entry) => {
    message += `• **${entry.nickname}**: \`${entry.address}\` (${entry.chain})\n`;
  });

  ctx.replyWithMarkdown(message);
});

// --- MESSAGE HANDLERS ---

bot.on(message('text'), async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    await handleTextMessage(ctx, ctx.message.text, 'text');
});

bot.on(message('voice'), async (ctx) => {
    const userId = ctx.from.id;
    await ctx.reply('👂 Listening...');

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
    const state = await db.getConversationState(userId);

    if (state?.parsedCommand && (state.parsedCommand.intent === 'swap' || state.parsedCommand.intent === 'checkout') && !state.parsedCommand.settleAddress) {
        const potentialAddress = text.trim();
        const targetChain = state.parsedCommand.toChain || state.parsedCommand.settleNetwork;

        if (isValidAddress(potentialAddress, targetChain)) {
            const updatedCommand = { ...state.parsedCommand, settleAddress: potentialAddress };
            await db.setConversationState(userId, { parsedCommand: updatedCommand });
            await ctx.reply(`Address received: \`${potentialAddress}\``, { parse_mode: 'Markdown' });

            const confirmAction = updatedCommand.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap';
            return ctx.reply("Ready to proceed?", Markup.inlineKeyboard([
                Markup.button.callback('✅ Yes', confirmAction),
                Markup.button.callback('❌ No', 'cancel_swap')
            ]));
        } else {
            const chainHint = targetChain ? ` for ${targetChain}` : '';
            return ctx.reply(`That doesn't look like a valid wallet address${chainHint}. Please provide a valid address or /clear to cancel.`);
        }
    }

    const history = state?.messages || [];
    await ctx.sendChatAction('typing');
    const parsed = await parseUserCommand(text, history, inputType);

    if (!parsed.success && parsed.intent !== 'yield_scout') {
        await logAnalytics(ctx, 'ValidationError', { input: text, error: parsed.validationErrors.join(", ") });
        let errorMessage = `⚠️ ${parsed.validationErrors.join(", ") || "I didn't understand."}`;
        if (parsed.confidence < 50) {
            errorMessage += "\n\n💡 *Suggestion:* Try rephrasing your command. For example:\n- Instead of 'swap to BTC or USDC', say 'swap to BTC'";
        }
        return ctx.replyWithMarkdown(errorMessage);
    }

    if (parsed.intent === 'yield_scout') {
        const yields = await getTopStablecoinYields();
        return ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
    }

    if (parsed.intent === 'yield_deposit') {
        const pools = await getTopYieldPools();
        const matchingPool = pools.find(p => p.symbol === parsed.fromAsset?.toUpperCase());
        if (!matchingPool) return ctx.reply(`Sorry, no suitable yield pool found for ${parsed.fromAsset}. Try /yield.`);

        if (parsed.fromChain?.toLowerCase() !== matchingPool.chain.toLowerCase()) {
            const bridgeCommand = {
                intent: 'swap',
                fromAsset: parsed.fromAsset,
                fromChain: parsed.fromChain,
                toAsset: parsed.fromAsset,
                toChain: matchingPool.chain.toLowerCase(),
                amount: parsed.amount,
                settleAddress: null
            };
            await db.setConversationState(userId, { parsedCommand: bridgeCommand });
            return ctx.reply(`To deposit to yield on ${matchingPool.chain}, we need to bridge first. Please provide your wallet address on ${matchingPool.chain}.`);
        } else {
            const depositCommand = {
                intent: 'swap',
                fromAsset: parsed.fromAsset,
                fromChain: parsed.fromChain,
                toAsset: matchingPool.symbol,
                toChain: matchingPool.chain,
                amount: parsed.amount,
                settleAddress: null
            };
            await db.setConversationState(userId, { parsedCommand: depositCommand });
            return ctx.reply(`Ready to deposit ${parsed.amount} ${parsed.fromAsset} to yield on ${matchingPool.chain} via ${matchingPool.project}. Please provide your address.`);
        }
    }

    if (parsed.intent === 'portfolio') {
        await db.setConversationState(userId, { parsedCommand: parsed });
        let msg = `📊 *Portfolio Strategy Detected*\nInput: ${parsed.amount} ${parsed.fromAsset}\n\n*Allocation Plan:*\n`;
        parsed.portfolio?.forEach(item => { msg += `• ${item.percentage}% → ${item.toAsset} on ${item.toChain}\n`; });

        const params = new URLSearchParams({
            mode: 'portfolio',
            data: JSON.stringify(parsed.portfolio),
            amount: parsed.amount?.toString() || '0',
            token: parsed.fromAsset || '',
            chain: parsed.fromChain || ''
        });

        return ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            Markup.button.webApp('📱 Batch Sign', `${MINI_APP_URL}?${params.toString()}`),
            Markup.button.callback('❌ Cancel', 'cancel_swap')
        ]));
    }

    if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
        if (!parsed.settleAddress) {
            await db.setConversationState(userId, { parsedCommand: parsed });
            return ctx.reply(`Okay, I see you want to ${parsed.intent}. Please provide the destination address.`);
        }

        await db.setConversationState(userId, { parsedCommand: parsed });
        const confirmAction = parsed.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap';
        ctx.reply("Confirm...", Markup.inlineKeyboard([
            Markup.button.callback('✅ Yes', confirmAction),
            Markup.button.callback('❌ No', 'cancel_swap')
        ]));
    }

    if (inputType === 'voice' && parsed.success) await ctx.reply(`🗣️ ${parsed.parsedMessage}`);
}

// --- ACTION HANDLERS ---

bot.action('confirm_swap', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
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
        
        ctx.editMessageText(`➡️ *Send:* \`${quote.depositAmount} ${quote.depositCoin}\`\n⬅️ *Receive:* \`${quote.settleAmount} ${quote.settleCoin}\`\n\nReady?`, {
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
    const state = await db.getConversationState(userId);
    if (!state?.quoteId || !state.parsedCommand) return ctx.answerCbQuery('Session expired.');

    try {
        await ctx.answerCbQuery('Setting up order...');
        const destinationAddress = state.parsedCommand.settleAddress!;
        const order = await createOrder(state.quoteId, destinationAddress, destinationAddress);
        if (!order.id) throw new Error("Failed to create order");

        db.createOrderEntry(userId, state.parsedCommand, order, state.settleAmount, state.quoteId);

        const { amount, fromChain, fromAsset } = state.parsedCommand;
        const rawDepositAddress = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress.address;
        const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress.memo : null;

        const chainKey = fromChain?.toLowerCase() || 'ethereum';
        const assetKey = fromAsset?.toUpperCase() || 'ETH';
        
        // Use dynamic token resolver instead of hardcoded TOKEN_MAP
        const tokenData = await tokenResolver.getTokenInfo(assetKey, chainKey);

        let txTo = rawDepositAddress, txValueHex = '0x0', txData = '0x';

        if (tokenData) {
            // This is an ERC20 token - construct transfer transaction
            txTo = tokenData.address;
            const amountBigInt = ethers.parseUnits(amount!.toString(), tokenData.decimals);
            const iface = new ethers.Interface(ERC20_ABI);
            txData = iface.encodeFunctionData("transfer", [rawDepositAddress, amountBigInt]);
        } else {
            // This is a native token (ETH, AVAX, BNB, etc.) - send value directly
            const amountBigInt = ethers.parseUnits(amount!.toString(), 18);
            txValueHex = '0x' + amountBigInt.toString(16);
            if (depositMemo) txData = ethers.hexlify(ethers.toUtf8Bytes(depositMemo));
        }

        const params = new URLSearchParams({
            to: txTo, value: txValueHex, data: txData,
            chainId: chainIdMap[chainKey] || '1',
            token: assetKey, amount: amount!.toString()
        });

        ctx.editMessageText(`✅ *Order Created!*\nTo complete the swap, sign in your wallet.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.webApp('📱 Sign Transaction', `${MINI_APP_URL}?${params.toString()}`),
                Markup.button.callback('❌ Close', 'cancel_swap')
            ])
        });
    } catch (error) {
        ctx.editMessageText(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});

bot.action('confirm_checkout', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.parsedCommand || state.parsedCommand.intent !== 'checkout') return ctx.answerCbQuery('Start over.');

    try {
        await ctx.answerCbQuery('Creating link...');
        const { settleAsset, settleNetwork, settleAmount, settleAddress } = state.parsedCommand;
        const checkout = await createCheckout(settleAsset!, settleNetwork!, settleAmount!, settleAddress!, '1.1.1.1');
        if (!checkout?.id) throw new Error("API Error");

        db.createCheckoutEntry(userId, checkout);
        ctx.editMessageText(`✅ *Checkout Link Created!*\n💰 *Receive:* ${checkout.settleAmount} ${checkout.settleCoin}\n[Pay Here](https://pay.sideshift.ai/checkout/${checkout.id})`, {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true }
        });
    } catch (error) {
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