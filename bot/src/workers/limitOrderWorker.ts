import cron from 'node-cron';
import { Telegraf, Markup } from 'telegraf';
import * as db from '../services/database';
import { inferNetwork } from '../utils/network';
import { getPrices } from '../services/price-client';
import { createQuote, createOrder } from '../services/sideshift-client';

export function startLimitOrderWorker(bot: Telegraf) {
  console.log('👷 Limit Order Worker started...');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    console.log('👷 Checking limit orders...');
    try {
      const pendingOrders = await db.getPendingLimitOrders();
      if (pendingOrders.length === 0) return;

      // 1. Gather all unique condition assets
      const conditionAssets = [...new Set(pendingOrders.map(o => o.conditionAsset))];

      // 2. Fetch prices
      const prices = await getPrices(conditionAssets);

      // 3. Check conditions
      for (const order of pendingOrders) {
        const currentPrice = prices[order.conditionAsset];
        if (!currentPrice) {
          // Can happen if coin ID mapping is missing or API fails for specific coin
          console.warn(`No price for ${order.conditionAsset}, skipping order ${order.id}`);
          continue;
        }

        let conditionMet = false;
        if (order.conditionType === 'below' && currentPrice < order.targetPrice) {
          conditionMet = true;
        } else if (order.conditionType === 'above' && currentPrice > order.targetPrice) {
          conditionMet = true;
        }

        if (conditionMet) {
          console.log(`✅ Order ${order.id} triggered! ${order.conditionAsset} (${currentPrice}) is ${order.conditionType} ${order.targetPrice}`);
          await executeOrder(bot, order, currentPrice);
        }
      }
    } catch (error) {
      console.error('Worker error:', error);
    }
  });
}

async function executeOrder(bot: Telegraf, order: db.LimitOrder, triggerPrice: number) {
  try {
    if (!order.settleAddress) {
       await db.updateLimitOrderStatus(order.id, 'failed', undefined, "Missing destination address");
       bot.telegram.sendMessage(order.telegramId, `❌ Limit Order ${order.id} failed: Missing destination address.`);
       return;
    }

    // Infer networks if missing
    const fromNetwork = order.fromNetwork || inferNetwork(order.fromAsset);
    const toNetwork = order.toNetwork || inferNetwork(order.toAsset);

    if (!fromNetwork || !toNetwork) {
        throw new Error(`Could not determine network for ${order.fromAsset} -> ${order.toAsset}`);
    }

    // 1. Create Quote
    // Use a user IP placeholder or 1.1.1.1
    const quote = await createQuote(
        order.fromAsset,
        fromNetwork, // We might need to map short names to network IDs if they differ
        order.toAsset,
        toNetwork,
        order.amount,
        '1.1.1.1'
    );

    if (quote.error || !quote.id) {
        throw new Error(quote.error?.message || "Quote creation failed");
    }

    // 2. Create Order
    const sideshiftOrder = await createOrder(quote.id, order.settleAddress, order.settleAddress);

    // 3. Update DB
    await db.updateLimitOrderStatus(order.id, 'executed', sideshiftOrder.id);

    // 4. Notify User
    const depositAddress = typeof sideshiftOrder.depositAddress === 'string'
        ? sideshiftOrder.depositAddress
        : sideshiftOrder.depositAddress.address;

    const message =
        `🚀 *Limit Order Triggered!*\n` +
        `Condition: ${order.conditionAsset} ${order.conditionType} $${order.targetPrice}\n` +
        `Current Price: $${triggerPrice}\n\n` +
        `📝 *Order Details:*\n` +
        `Send: ${quote.depositAmount} ${quote.depositCoin} (${quote.depositNetwork})\n` +
        `Receive: ${quote.settleAmount} ${quote.settleCoin} (${quote.settleNetwork})\n` +
        `To Address: \`${depositAddress}\`\n\n` +
        `Please send funds now to execute the swap.`;

    await bot.telegram.sendMessage(order.telegramId, message, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error(`Failed to execute order ${order.id}:`, error);
    await db.updateLimitOrderStatus(order.id, 'failed', undefined, error instanceof Error ? error.message : String(error));
    await bot.telegram.sendMessage(order.telegramId, `⚠️ Limit Order ${order.id} triggered but failed to create swap: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
