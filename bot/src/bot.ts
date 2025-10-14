import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { parseUserCommand } from './services/groq-client';
import { createQuote, createOrder } from './services/sideshift-client';
import * as db from './services/database';
import NodeWalletConnect from "@walletconnect/node";
import qrcode from 'qrcode'; 

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN || '');

let tempTelegramId: number | null = null;

// --- WalletConnect ---

const walletConnector = new NodeWalletConnect(
  {
    bridge: "https://bridge.walletconnect.org",
  },
  {
    clientMeta: {
      description: "SwapSmith Bot",
      url: "https://t.me/SwapSmithBot",
      icons: ["https://prd-akindo-private.s3.us-west-1.amazonaws.com/products/icons/MzjLGdOOqIA4ZGnr_medium.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAUVKHMQQTM4KPRWKF%2F20251014%2Fus-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251014T172122Z&X-Amz-Expires=3600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjELn%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLXdlc3QtMSJHMEUCIQC3QL7XcLSFJpLWM1nrDTjz48Czx5upbf7R%2Flvh%2FawxjwIgYS8b%2FGyyiUN%2BvfZvx6oOYsfok0DYwpaGks%2FWQxxQ1Poq6wMIYhABGgwzMjA2NjE2NTI1MTgiDAisQRNVfj6V%2F2hI2irIA2DIFgIUj1CRDNC1cDOc%2BzMwnpdprBkoiA%2BOVYMEK7RexcFhLApmJ7%2BIga8Cal4SEv5BiP1fFjTJVPBEmdHUO7texC56kvU2MZWY%2F1TGBeOQWvKILL1ujCjjUd5rma8iGXMaECvRNr5PHJT%2BY7bNdmWON06KSfTKKzSqd8zVrnE2Nr9ID9u9rqVtVi%2FnvL0BAW1H%2BgGkssjkHvmXpYt2p3yw6CXX5bX6gD2eoyihYNXScKlecT3%2FCnA9oCTMIriiyJgs8BvFUEtrKcr0uCXbC%2ByU1XgantBc9I2g5IVWsho8jqvPjhbjCcT4PhY0WiK7IQDelPBL0Z8zU44hYudu%2Fip1W%2FdDjCIEumGdksvMDWNdmGm6WEhtekpYwrQBOkgXK0%2BKRgUclt36JOoez8ASTRpoI%2BKd67L6%2FaJGKwlPZevRxMJ5HYHOp%2Fek7u%2BPRB60NpZuMJQJO1DqdTXC%2FaSTlJPUu7PAEqDQnQkDD47%2FoowcvavLuhYvS0F9BjqvJzuhrLWmGtXrHQxIKVP7abhTGOMBKFjzTNV6WowWQqGhAOZV4dyfK69Fc7YAQXN1Ud4tJD2vrrvwDfQ44DrHEJKlVI39JfOAIKCiXjCNh7rHBjqlAe1ww9bWaI6fzwm9ZJgJmqU0L%2FgTVH%2Fwq3S7Fau2XezS04SO9Qm7PrLKd16f2vMQlF21oL6ERae2e3B%2Fst8xr7L0HKQD8cWfQqCkzgcvYCz61KqyFx0S5FDuZcpeSUui2ays7XsyDMhFUmf8Op5GBWJK9ttKZe5Vu3mvLR4WJf%2FuglnJ2oHO8tZocrK0zfGOdV3cLV5bEm8vzhexdpZzbPg%2BCb%2BEYA%3D%3D&X-Amz-Signature=4cd97cc55ea66f846861e94fff4b3916bcaef3b333832a6b9bb6cf07fa5c3a4c&X-Amz-SignedHeaders=host&x-id=GetObject"],
      name: "SwapSmith Bot",
    },
  }
);

walletConnector.on("connect", (error, payload) => {
  if (error) {
    throw error;
  }
  const { accounts } = payload.params[0];
  const [address] = accounts;
  if (tempTelegramId) {
    db.setUserWalletAddress(tempTelegramId, address);
    bot.telegram.sendMessage(tempTelegramId, `✅ Wallet connected! Your address is: ${address}`);
    tempTelegramId = null;
  }
});

// --- Bot Commands ---

bot.start((ctx) => {
  ctx.reply('Welcome to SwapSmith Bot! 🤖');
  ctx.reply("Use /connect to connect your wallet.\n\nThen, tell me what you want to swap, like 'Swap 0.1 ETH on Ethereum for USDC on BSC'");
});

// --- ✅ UPDATED 'connect' COMMAND ---
bot.command('connect', async (ctx) => {
  tempTelegramId = ctx.from.id;

  // Check if there's already a session and kill it
  if (walletConnector.connected) {
      await walletConnector.killSession();
  }

  await walletConnector.createSession();
  const uri = walletConnector.uri;

  try {
    // Generate the QR code as a Data URL (base64 image)
    const qrCodeDataURL = await qrcode.toDataURL(uri);
    
    // The data URL is too long for a caption, so we send the image first, then the text.
    await ctx.replyWithPhoto(
        { source: Buffer.from(qrCodeDataURL.split(",")[1], 'base64') },
        { caption: 'Scan this QR code with a WalletConnect-compatible wallet to connect.' }
    );

  } catch (err) {
    console.error('Failed to generate or send QR code', err);
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

        db.setConversationState(userId, { ...state, quoteId: quote.id });
        
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

    if (!state || !state.quoteId || !user || !user.wallet_address) {
        return ctx.answerCbQuery('Something went wrong. Please start over.');
    }

    try {
        await ctx.answerCbQuery('Placing your order...');
        const order = await createOrder(state.quoteId, user.wallet_address, user.wallet_address);

        const orderMessage = 
`✅ Order placed!

Please send *${state.parsedCommand.amount} ${state.parsedCommand.fromAsset}* to the following address:

\`${order.depositAddress.address}\`

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

console.log('Bot is running...');