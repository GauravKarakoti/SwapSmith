import { Telegraf } from 'telegraf';
import { eq, and } from 'drizzle-orm';
import { db } from '../services/database';
import { trailingStopOrders } from '../../../shared/schema';
import logger from '../services/logger';
import { getCurrentPrice, getMultiplePrices } from '../services/price-monitor';
import { createQuote, createOrder } from '../services/sideshift-client';

const CHECK_INTERVAL_MS = 60 * 1000;

export class TrailingStopWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private bot: Telegraf | null = null;

  public async start(bot: Telegraf) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.bot = bot;

    logger.info('🚀 Starting Trailing Stop Worker...');

    this.checkTrailingStops();
    this.intervalId = setInterval(
      () => this.checkTrailingStops(),
      CHECK_INTERVAL_MS
    );
  }

  public stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    logger.info('🛑 Trailing Stop Worker stopped.');
  }

  private async checkTrailingStops() {
    try {
      const activeOrders = await db
        .select()
        .from(trailingStopOrders)
        .where(
          and(
            eq(trailingStopOrders.isActive, true),
            eq(trailingStopOrders.status, 'pending')
          )
        );

      if (activeOrders.length === 0) return;

      logger.info(`🔍 Checking ${activeOrders.length} trailing stop orders`);

      const assets = Array.from(
        new Set(activeOrders.map(o => o.fromAsset.toUpperCase()))
      );

      const prices = await getMultiplePrices(assets);

      for (const order of activeOrders) {
        const currentPrice = prices[order.fromAsset.toUpperCase()];

        if (currentPrice == null) {
          logger.warn(`⚠️ No price for ${order.fromAsset}, skipping ${order.id}`);
          continue;
        }

        await this.processTrailingStopOrder(order, currentPrice);
      }
    } catch (error) {
      logger.error('❌ Trailing Stop Worker loop error', error);
    }
  }

  private async processTrailingStopOrder(
    order: typeof trailingStopOrders.$inferSelect,
    currentPrice: number
  ) {
    try {
      let peakPrice = order.peakPrice
        ? parseFloat(order.peakPrice)
        : currentPrice;

      if (currentPrice > peakPrice) {
        peakPrice = currentPrice;
        logger.info(`📈 New peak for ${order.id}: $${peakPrice}`);
      }

      const triggerPrice =
        peakPrice * (1 - order.trailingPercentage / 100);

      await db
        .update(trailingStopOrders)
        .set({
          peakPrice: peakPrice.toString(),
          currentPrice: currentPrice.toString(),
          triggerPrice: triggerPrice.toString(),
          lastCheckedAt: new Date(),
        })
        .where(eq(trailingStopOrders.id, order.id));

      if (currentPrice <= triggerPrice) {
        await this.triggerTrailingStop(
          order,
          currentPrice,
          peakPrice,
          triggerPrice
        );
      }
    } catch (error) {
      logger.error(`❌ Error processing order ${order.id}`, error);
    }
  }

  private async triggerTrailingStop(
    order: typeof trailingStopOrders.$inferSelect,
    currentPrice: number,
    peakPrice: number,
    triggerPrice: number
  ) {
    try {
      await db
        .update(trailingStopOrders)
        .set({
          status: 'triggered',
          isActive: false,
          triggeredAt: new Date(),
        })
        .where(eq(trailingStopOrders.id, order.id));

      if (this.bot && order.telegramId) {
        await this.bot.telegram.sendMessage(
          Number(order.telegramId),
          `🚨 *Trailing Stop Triggered!*\n\n` +
            `*${order.fromAsset} → ${order.toAsset}*\n` +
            `Amount: ${order.fromAmount}\n` +
            `Peak: $${peakPrice.toLocaleString()}\n` +
            `Trigger: $${triggerPrice.toLocaleString()}`,
          { parse_mode: 'Markdown' }
        );
      }

      await this.executeSwap(order);
    } catch (error) {
      await db
        .update(trailingStopOrders)
        .set({
          status: 'failed',
          error:
            error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(trailingStopOrders.id, order.id));
    }
  }

  private async executeSwap(order: typeof trailingStopOrders.$inferSelect) {
    try {
      if (!order.settleAddress) {
        throw new Error('Missing settle address');
      }

      const quote = await createQuote(
        order.fromAsset,
        order.fromNetwork || 'ethereum',
        order.toAsset,
        order.toNetwork || 'ethereum',
        parseFloat(order.fromAmount),
        process.env.SIDESHIFT_CLIENT_IP || '127.0.0.1'
      );

      if (quote.error) {
        throw new Error(quote.error.message);
      }

      const sideshiftOrder = await createOrder(
        quote.id,
        order.settleAddress,
        order.settleAddress
      );

      await db
        .update(trailingStopOrders)
        .set({
          status: 'completed',
          sideshiftOrderId: sideshiftOrder.id,
        })
        .where(eq(trailingStopOrders.id, order.id));

      if (this.bot && order.telegramId) {
        await this.bot.telegram.sendMessage(
          Number(order.telegramId),
          `✅ *Trailing Stop Executed!*\n\n` +
            `Deposit: ${quote.depositAmount} ${quote.depositCoin}\n` +
            `To: \`${sideshiftOrder.depositAddress}\``,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';

      await db
        .update(trailingStopOrders)
        .set({ status: 'failed', error: message })
        .where(eq(trailingStopOrders.id, order.id));

      if (this.bot && order.telegramId) {
        await this.bot.telegram.sendMessage(
          Number(order.telegramId),
          `❌ *Trailing Stop Failed*\n\n${message}`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  }
}

export const trailingStopWorker = new TrailingStopWorker();
