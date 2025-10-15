import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';
import qrcode from 'qrcode';
import { parseUserCommand } from './services/groq-client';
import { createQuote, createOrder } from './services/sideshift-client';
import * as db from './services/database';
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
      db.setUserWalletAddress(tempTelegramId, address);
      const state = db.getConversationState(tempTelegramId) || {};
      db.setConversationState(tempTelegramId, { ...state, sessionTopic: session.topic });
      console.log("State in start:",db.getConversationState(tempTelegramId))
      bot.telegram.sendMessage(tempTelegramId, `✅ Wallet connected! Your address is: ${address}`);
      tempTelegramId = null;
    }
  });
  console.log("WalletConnect v2.0 initialized successfully!");

  signClient.on("session_delete", ({ id, topic }: { id: number; topic: string }) => {
    console.log("WalletConnect session deleted:", id, topic);
  });
}

initializeWalletConnect().catch(err => console.error("Failed to initialize WalletConnect", err));

// --- Bot Commands ---

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
                chains: ["eip155:1"],
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
    const state = db.getConversationState(userId) || {};
    console.log('Current state before setting command:', state);
    db.setConversationState(userId, { parsedCommand, sessionTopic: state.sessionTopic });
    console.log('Updated state with parsed command:', db.getConversationState(userId));

    const confirmationMessage = `You want to swap *${parsedCommand.amount} ${parsedCommand.fromAsset}* for *${parsedCommand.toAsset}*. Correct?`;

    ctx.replyWithMarkdown(confirmationMessage, Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes, get quote', 'confirm_swap'),
        Markup.button.callback('❌ Cancel', 'cancel_swap'),
    ]));

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
        console.log('Received quote:', quote);

        db.setConversationState(userId, { ...state, id: quote.id });
        console.log('Updated state with quote ID:', db.getConversationState(userId));

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
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.editMessageText(`Sorry, I was unable to get a quote. Please try again. \nError: ${errorMessage}`);
    }
});

bot.action('place_order', async (ctx) => {
    const userId = ctx.from.id;
    const state = db.getConversationState(userId);
    const user = db.getUser(userId);
    console.log('Current state:', state);

    if (!state || !state.id || !user || !user.wallet_address || !state.parsedCommand || !state.sessionTopic) {
        return ctx.answerCbQuery('Something went wrong. Please start over.');
    }

    try {
        await ctx.answerCbQuery('Placing your order...');
        const order = await createOrder(state.id, user.wallet_address, user.wallet_address);

        if (!order || !order.depositAddress) {
            return ctx.editMessageText(`Error placing order: Unknown error`);
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
`✅ Order placed!

This bot currently only supports sending transaction requests for EVM chains. Please send *${amount} ${fromAsset}* to the following address manually:

\`${address}\`

${memo ? `With this memo/tag: \`${memo}\`` : ''}`;
             ctx.editMessageText(orderMessage, { parse_mode: 'Markdown' });
             db.clearConversationState(userId);
             return
        }
        console.log(`Preparing to send transaction on chain ID ${chainId} to address ${address} with amount ${ethers.parseEther(amount.toString()).toString()}`);

        const transaction = {
            from: user.wallet_address,
            to: address,
            value: '0x' + ethers.parseEther(amount.toString()).toString(16),
            data: memo ? ethers.hexlify(ethers.toUtf8Bytes(memo)) : '0x',
        };
        const session = signClient.session.get(state.sessionTopic);
        console.log('Retrieved session:', session);
        if(!session) {
            return ctx.editMessageText('Could not find active WalletConnect session. Please reconnect.');
        }

        await signClient.request({
            topic: state.sessionTopic,
            chainId: `eip155:${chainId}`,
            request: {
                method: 'eth_sendTransaction',
                params: [transaction],
            },
        });
        console.log('Transaction request sent:', transaction);

        const orderMessage =
`✅ Order placed!

A transaction request has been sent to your wallet to send *${amount} ${fromAsset}* to the following address:

\`${address}\`

${memo ? `With this memo/tag: \`${memo}\`` : ''}`;

        ctx.editMessageText(orderMessage, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        ctx.editMessageText(`Sorry, I was unable to place your order or send the transaction request. Please try again. \nError: ${errorMessage}`);
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