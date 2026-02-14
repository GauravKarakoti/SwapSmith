"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const filters_1 = require("telegraf/filters");
const dotenv_1 = __importDefault(require("dotenv"));
const groq_client_1 = require("./services/groq-client");
const sideshift_client_1 = require("./services/sideshift-client");
const yield_client_1 = require("./services/yield-client");
const db = __importStar(require("./services/database"));
const limitOrderWorker_1 = require("./workers/limitOrderWorker");
const dcaWorker_1 = require("./workers/dcaWorker");
const parseLimitOrder_1 = require("./utils/parseLimitOrder");
const network_1 = require("./utils/network");
const auth_1 = require("./utils/auth");
const portfolio_1 = require("./handlers/portfolio");
const ethers_1 = require("ethers");
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const express_1 = __importDefault(require("express"));
dotenv_1.default.config();
const MINI_APP_URL = process.env.MINI_APP_URL;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const bot = new telegraf_1.Telegraf(process.env.BOT_TOKEN);
// Start Limit Order Worker
(0, limitOrderWorker_1.startLimitOrderWorker)(bot);
(0, dcaWorker_1.startDcaWorker)(bot);
// --- FFMPEG CHECK ---
try {
    (0, child_process_1.execSync)('ffmpeg -version');
    console.log('✅ ffmpeg is installed. Voice messages enabled.');
}
catch (error) {
    console.warn('⚠️ ffmpeg not found. Voice messages will fail. Please install ffmpeg.');
}
// --- ERC20 CONFIGURATION ---
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)"
];
// Map of common tokens -> Address & Decimals
const TOKEN_MAP = {
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
async function logAnalytics(ctx, errorType, details) {
    console.error(`[Analytics] ${errorType}:`, details);
    if (ADMIN_CHAT_ID) {
        const msg = `⚠️ *Analytics Alert*\n\n*Type:* ${errorType}\n*User:* ${ctx.from?.id}\n*Input:* "${details.input}"\n*Error:* ${details.error}`;
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' }).catch(e => console.error("Failed to send admin log", e));
    }
}
// --- COMMANDS ---
bot.start((ctx) => {
    ctx.reply("🤖 *Welcome to SwapSmith!*\n\n" +
        "I am your Voice-Activated Crypto Trading Assistant.\n" +
        "I use SideShift.ai for swaps and a Mini App for secure signing.\n\n" +
        "📜 *Commands:*\n" +
        "/website - Open Web App\n" +
        "/history - See past orders\n" +
        "/checkouts - See payment links\n" +
        "/status [id] - Check order status\n" +
        "/clear - Reset conversation\n\n" +
        "💡 *Tip:* Check out our web interface for a graphical experience!", {
        parse_mode: 'Markdown',
        ...telegraf_1.Markup.inlineKeyboard([
            telegraf_1.Markup.button.url('🌐 Visit Website', "https://swap-smith.vercel.app/")
        ])
    });
});
bot.command('history', async (ctx) => {
    const userId = ctx.from.id;
    const orders = await db.getUserHistory(userId);
    if (orders.length === 0)
        return ctx.reply("You have no order history yet.");
    let message = "Your last 10 orders:\n\n";
    orders.forEach((order) => {
        message += `*Order ${order.sideshiftOrderId}* (${order.status})\n`;
        message += `  *Send:* ${order.fromAmount} ${order.fromAsset} (${order.fromNetwork})\n`;
        message += `  *Rcv:* ~${order.settleAmount} ${order.toAsset} (${order.toNetwork})\n`;
        message += `  *To:* \`${order.depositAddress}\`\n`;
        if (order.txHash)
            message += `  *TxHash:* \`${order.txHash.substring(0, 10)}...\`\n`;
        message += `  *Date:* ${new Date(order.createdAt).toLocaleString()}\n\n`;
    });
    ctx.replyWithMarkdown(message);
});
bot.command('status', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    let orderIdToCheck = args[1];
    try {
        if (!orderIdToCheck) {
            const lastOrder = await db.getLatestUserOrder(userId);
            if (!lastOrder)
                return ctx.reply("You have no order history to check. Send a swap first.");
            orderIdToCheck = lastOrder.sideshiftOrderId;
            await ctx.reply(`Checking status of your latest order: \`${orderIdToCheck}\``);
        }
        await ctx.reply(`⏳ Checking status...`);
        const status = await (0, sideshift_client_1.getOrderStatus)(orderIdToCheck);
        db.updateOrderStatus(orderIdToCheck, status.status);
        let message = `*Order Status: ${status.id}*\n\n`;
        message += `  *Status:* \`${status.status.toUpperCase()}\`\n`;
        message += `  *Send:* ${status.depositAmount || '?'} ${status.depositCoin} (${status.depositNetwork})\n`;
        message += `  *Receive:* ${status.settleAmount || '?'} ${status.settleCoin} (${status.settleNetwork})\n`;
        message += `  *Created:* ${new Date(status.createdAt).toLocaleString()}\n`;
        ctx.replyWithMarkdown(message);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.reply(`Sorry, couldn't get status. Error: ${errorMessage}`);
    }
});
bot.command('checkouts', async (ctx) => {
    const userId = ctx.from.id;
    const checkouts = await db.getUserCheckouts(userId);
    if (checkouts.length === 0)
        return ctx.reply("You have no checkout history yet.");
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
    ctx.reply("🌐 *SwapSmith Web Interface*\n\nClick the button below to access the full graphical interface.", {
        parse_mode: 'Markdown',
        ...telegraf_1.Markup.inlineKeyboard([
            telegraf_1.Markup.button.url('🚀 Open Website', "https://swap-smith.vercel.app/")
        ])
    });
});
// --- MESSAGE HANDLERS ---
bot.on((0, filters_1.message)('text'), async (ctx) => {
    if (ctx.message.text.startsWith('/'))
        return;
    await handleTextMessage(ctx, ctx.message.text, 'text');
});
bot.on((0, filters_1.message)('voice'), async (ctx) => {
    const userId = ctx.from.id;
    await ctx.reply('👂 Listening...');
    try {
        const file_id = ctx.message.voice.file_id;
        const fileLink = await ctx.telegram.getFileLink(file_id);
        const response = await axios_1.default.get(fileLink.href, { responseType: 'arraybuffer' });
        const ogaPath = path_1.default.join(__dirname, `temp_${userId}.oga`);
        const mp3Path = path_1.default.join(__dirname, `temp_${userId}.mp3`);
        fs_1.default.writeFileSync(ogaPath, Buffer.from(response.data));
        (0, child_process_1.execSync)(`ffmpeg -i ${ogaPath} ${mp3Path} -y`);
        const transcribedText = await (0, groq_client_1.transcribeAudio)(mp3Path);
        await handleTextMessage(ctx, transcribedText, 'voice');
        fs_1.default.unlinkSync(ogaPath);
        fs_1.default.unlinkSync(mp3Path);
    }
    catch (error) {
        console.error("Voice error:", error);
        ctx.reply("Sorry, I couldn't hear that clearly. Please try again.");
    }
});
async function handleTextMessage(ctx, text, inputType = 'text') {
    const userId = ctx.from.id;
    // NEW: Check for limit order pattern first
    const limitOrder = (0, parseLimitOrder_1.parseLimitOrder)(text);
    if (limitOrder.success) {
        await db.setConversationState(userId, {
            intent: 'limit_order',
            data: limitOrder,
            step: 'awaiting_address'
        });
        return ctx.reply(`👍 I understood: Swap ${limitOrder.amount} ${limitOrder.fromAsset} for ${limitOrder.toAsset} ` +
            `if ${limitOrder.conditionAsset || limitOrder.toAsset} is ${limitOrder.conditionType} $${limitOrder.targetPrice}.\n\n` +
            `Please enter the destination ${limitOrder.toAsset} wallet address:`);
    }
    const state = await db.getConversationState(userId);
    // Check if we are in 'limit_order' flow
    if (state?.intent === 'limit_order' && state.step === 'awaiting_address') {
        const address = text.trim();
        if (address.length < 10)
            return ctx.reply("Address too short. Please try again or /clear.");
        const orderData = state.data;
        const fromNetwork = (0, network_1.inferNetwork)(orderData.fromAsset);
        const toNetwork = (0, network_1.inferNetwork)(orderData.toAsset);
        await db.createLimitOrder({
            telegramId: userId,
            fromAsset: orderData.fromAsset,
            toAsset: orderData.toAsset,
            fromNetwork: fromNetwork,
            toNetwork: toNetwork,
            amount: orderData.amount,
            conditionAsset: orderData.conditionAsset || orderData.toAsset,
            conditionType: orderData.conditionType,
            targetPrice: orderData.targetPrice,
            settleAddress: address
        });
        await db.clearConversationState(userId);
        return ctx.reply(`✅ Limit Order Created! I'll watch the price for you.`);
    }
    // 1. Check for pending address input
    if (state?.parsedCommand && (state.parsedCommand.intent === 'swap' || state.parsedCommand.intent === 'checkout') && !state.parsedCommand.settleAddress) {
        const potentialAddress = text.trim();
        // Basic address validation (can be improved)
        if (potentialAddress.length > 25) { // Arbitrary length check for now
            const updatedCommand = { ...state.parsedCommand, settleAddress: potentialAddress };
            await db.setConversationState(userId, { parsedCommand: updatedCommand });
            await ctx.reply(`Address received: \`${potentialAddress}\``, { parse_mode: 'Markdown' });
            // Re-trigger the confirmation logic with the complete command
            const confirmAction = updatedCommand.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap';
            return ctx.reply("Ready to proceed?", telegraf_1.Markup.inlineKeyboard([
                telegraf_1.Markup.button.callback('✅ Yes', confirmAction),
                telegraf_1.Markup.button.callback('❌ No', 'cancel_swap')
            ]));
        }
        else {
            return ctx.reply("That doesn't look like a valid address. Please try again or /clear to cancel.");
        }
    }
    const history = state?.messages || [];
    await ctx.sendChatAction('typing');
    const parsed = await (0, groq_client_1.parseUserCommand)(text, history, inputType);
    if (!parsed.success && parsed.intent !== 'yield_scout') {
        await logAnalytics(ctx, 'ValidationError', { input: text, error: parsed.validationErrors.join(", ") });
        return ctx.reply(`⚠️ ${parsed.validationErrors.join(", ") || "I didn't understand."}`);
    }
    if (parsed.intent === 'yield_scout') {
        const yields = await (0, yield_client_1.getTopStablecoinYields)();
        return ctx.replyWithMarkdown(`📈 *Top Stablecoin Yields:*\n\n${yields}`);
    }
    if (parsed.intent === 'portfolio') {
        await db.setConversationState(userId, { parsedCommand: parsed });
        let msg = `📊 *Portfolio Strategy Detected*\nInput: ${parsed.amount} ${parsed.fromAsset} (${parsed.fromChain})\n\n*Allocation Plan:*\n`;
        parsed.portfolio?.forEach(item => { msg += `• ${item.percentage}% → ${item.toAsset} on ${item.toChain}\n`; });
        const params = new URLSearchParams({
            mode: 'portfolio',
            data: JSON.stringify(parsed.portfolio),
            amount: parsed.amount?.toString() || '0',
            token: parsed.fromAsset || '',
            chain: parsed.fromChain || ''
        });
        const webAppUrl = `${MINI_APP_URL}?${params.toString()}`;
        return ctx.replyWithMarkdown(msg, telegraf_1.Markup.inlineKeyboard([
            telegraf_1.Markup.button.webApp('📱 Batch Sign (Frontend)', webAppUrl),
            telegraf_1.Markup.button.callback('🤖 Execute via Bot', 'confirm_portfolio'),
            telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_swap')
        ]));
    }
    if (parsed.intent === 'swap' || parsed.intent === 'checkout') {
        // 2. Handle missing address
        if (!parsed.settleAddress) {
            // Store partial state
            await db.setConversationState(userId, { parsedCommand: parsed });
            return ctx.reply(`Okay, I see you want to ${parsed.intent}. Please provide the destination/wallet address.`);
        }
        await db.setConversationState(userId, { parsedCommand: parsed });
        const confirmAction = parsed.intent === 'checkout' ? 'confirm_checkout' : 'confirm_swap';
        ctx.reply("Confirm...", telegraf_1.Markup.inlineKeyboard([
            telegraf_1.Markup.button.callback('✅ Yes', confirmAction),
            telegraf_1.Markup.button.callback('❌ No', 'cancel_swap')
        ]));
    }
    if (inputType === 'voice' && parsed.success)
        await ctx.reply(`🗣️ ${parsed.parsedMessage}`);
}
// --- ACTION HANDLERS ---
bot.action('confirm_portfolio', portfolio_1.confirmPortfolioHandler);
bot.action('confirm_swap', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.parsedCommand || state.parsedCommand.intent !== 'swap')
        return ctx.answerCbQuery('Session expired.');
    try {
        await ctx.answerCbQuery('Fetching quote...');
        const quote = await (0, sideshift_client_1.createQuote)(state.parsedCommand.fromAsset, state.parsedCommand.fromChain, state.parsedCommand.toAsset, state.parsedCommand.toChain, state.parsedCommand.amount, '1.1.1.1');
        if (quote.error)
            return ctx.editMessageText(`Error: ${quote.error.message}`);
        db.setConversationState(userId, { ...state, quoteId: quote.id, settleAmount: quote.settleAmount });
        const quoteMessage = `Here's your quote:\n\n➡️ *Send:* \`${quote.depositAmount} ${quote.depositCoin}\`\n⬅️ *Receive:* \`${quote.settleAmount} ${quote.settleCoin}\`\n\nReady?`;
        ctx.editMessageText(quoteMessage, {
            parse_mode: 'Markdown',
            ...telegraf_1.Markup.inlineKeyboard([
                telegraf_1.Markup.button.callback('✅ Place Order', 'place_order'),
                telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_swap'),
            ])
        });
    }
    catch (error) {
        ctx.editMessageText(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
});
bot.action('place_order', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state?.quoteId || !state.parsedCommand)
        return ctx.answerCbQuery('Session expired.');
    try {
        await ctx.answerCbQuery('Setting up order...');
        const destinationAddress = state.parsedCommand.settleAddress;
        const order = await (0, sideshift_client_1.createOrder)(state.quoteId, destinationAddress, destinationAddress);
        if (!order.id)
            throw new Error("Failed to create order");
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
                const amountBigInt = ethers_1.ethers.parseUnits(amount.toString(), tokenData.decimals);
                const iface = new ethers_1.ethers.Interface(ERC20_ABI);
                txData = iface.encodeFunctionData("transfer", [rawDepositAddress, amountBigInt]);
            }
            else {
                // Native Asset
                txTo = rawDepositAddress;
                const amountBigInt = ethers_1.ethers.parseUnits(amount.toString(), 18);
                txValueHex = '0x' + amountBigInt.toString(16);
                if (depositMemo)
                    txData = ethers_1.ethers.hexlify(ethers_1.ethers.toUtf8Bytes(depositMemo));
            }
        }
        catch (err) {
            return ctx.editMessageText(`Tx construction error: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
        const chainIdMap = {
            'ethereum': '1', 'bsc': '56', 'polygon': '137', 'arbitrum': '42161', 'base': '8453'
        };
        const params = new URLSearchParams({
            to: txTo,
            value: txValueHex,
            data: txData,
            chainId: chainIdMap[fromChain?.toLowerCase() || 'ethereum'] || '1',
            token: assetKey,
            chain: fromChain || 'Ethereum',
            amount: amount.toString()
        });
        const webAppUrl = `${MINI_APP_URL}?${params.toString()}`;
        const QV = `✅ *Order Created!* (ID: \`${order.id}\`)\n\n` +
            `To complete the swap, please sign the transaction in your wallet.\n\n` +
            `1. Click the button below.\n` +
            `2. Connect your wallet (MetaMask, etc).\n` +
            `3. Confirm the transaction.\n\n` +
            `_Destination: ${destinationAddress}_`;
        ctx.editMessageText(QV, {
            parse_mode: 'Markdown',
            ...telegraf_1.Markup.inlineKeyboard([
                telegraf_1.Markup.button.webApp('📱 Sign Transaction', webAppUrl),
                telegraf_1.Markup.button.callback('❌ Close', 'cancel_swap')
            ])
        });
    }
    catch (error) {
        ctx.editMessageText(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// --- Button Handler for Checkouts ---
bot.action('confirm_checkout', async (ctx) => {
    const userId = ctx.from.id;
    const state = await db.getConversationState(userId);
    if (!state || !state.parsedCommand || state.parsedCommand.intent !== 'checkout') {
        return ctx.answerCbQuery('Start over.');
    }
    try {
        await ctx.answerCbQuery('Creating link...');
        const { settleAsset, settleNetwork, settleAmount, settleAddress } = state.parsedCommand;
        const checkout = await (0, sideshift_client_1.createCheckout)(settleAsset, settleNetwork, settleAmount, settleAddress, '1.1.1.1');
        if (!checkout || !checkout.id)
            throw new Error("API Error");
        try {
            db.createCheckoutEntry(userId, checkout);
        }
        catch (e) {
            console.error(e);
        }
        const paymentUrl = `https://pay.sideshift.ai/checkout/${checkout.id}`;
        const checkoutMessage = `✅ *Checkout Link Created!*\n\n` +
            `💰 *Receive:* ${checkout.settleAmount} ${checkout.settleCoin}\n` +
            `📬 *Address:* \`${checkout.settleAddress}\`\n\n` +
            `[Pay Here](${paymentUrl})`;
        ctx.editMessageText(checkoutMessage, {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true }
        });
    }
    catch (error) {
        console.error(error);
        ctx.editMessageText(`Error creating link.`);
    }
    finally {
        db.clearConversationState(userId);
    }
});
bot.action('cancel_swap', (ctx) => {
    db.clearConversationState(ctx.from.id);
    ctx.editMessageText('❌ Cancelled.');
});
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
app.get('/', (req, res) => res.send('SwapSmith Alive'));
app.get('/api/dca', async (req, res) => {
    const initData = req.headers.authorization;
    if (!initData)
        return res.status(401).json({ error: 'Unauthorized' });
    const user = (0, auth_1.validateWebAppData)(initData, process.env.BOT_TOKEN);
    if (!user)
        return res.status(401).json({ error: 'Invalid initData' });
    try {
        const plans = await db.getUserDcaPlans(user.id);
        res.json(plans);
    }
    catch (e) {
        res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
    }
});
app.post('/api/dca', async (req, res) => {
    const initData = req.headers.authorization;
    if (!initData)
        return res.status(401).json({ error: 'Unauthorized' });
    const user = (0, auth_1.validateWebAppData)(initData, process.env.BOT_TOKEN);
    if (!user)
        return res.status(401).json({ error: 'Invalid initData' });
    try {
        const plan = req.body;
        // Basic validation
        if (!plan.amount || !plan.frequencyDays) {
            return res.status(400).json({ error: "Missing fields" });
        }
        const newPlan = await db.createDcaPlan({
            telegramId: user.id,
            fromAsset: plan.fromAsset,
            toAsset: plan.toAsset,
            fromNetwork: plan.fromNetwork || 'ethereum',
            toNetwork: plan.toNetwork || 'bitcoin',
            amount: plan.amount,
            frequencyDays: plan.frequencyDays,
            settleAddress: plan.settleAddress,
            status: 'active',
            nextRun: new Date(Date.now() + plan.frequencyDays * 24 * 60 * 60 * 1000)
        });
        res.json(newPlan);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
    }
});
app.listen(process.env.PORT || 3000, () => console.log(`Express server live`));
bot.launch();
console.log('🤖 Bot is running...');
