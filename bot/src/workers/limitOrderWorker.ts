import { Telegraf } from 'telegraf';
import axios from 'axios';
import { eq, and, or, isNull, lte } from 'drizzle-orm';
import { db, limitOrders, LimitOrder, updateLimitOrderStatus, getUser } from '../services/database';
import { getCoins, createQuote, createOrder } from '../services/sideshift-client';
import logger, { handleError } from '../services/logger';


const CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

export class LimitOrderWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private symbolToIdMap: Map<string, string> = new Map();
  private bot: Telegraf | null = null;

  constructor() {
    // Initialize common mappings
    this.symbolToIdMap.set('BTC', 'bitcoin');
    this.symbolToIdMap.set('ETH', 'ethereum');
    this.symbolToIdMap.set('SOL', 'solana');
    this.symbolToIdMap.set('AVAX', 'avalanche-2');
    this.symbolToIdMap.set('MATIC', 'matic-network');
    this.symbolToIdMap.set('BNB', 'binancecoin');
    this.symbolToIdMap.set('DOGE', 'dogecoin');
    this.symbolToIdMap.set('USDC', 'usd-coin');
    this.symbolToIdMap.set('USDT', 'tether');
  }

  public async start(bot: Telegraf) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.bot = bot;

    logger.info('🚀 Starting Limit Order Worker...');


    // Initial coin map build
    await this.buildCoinMap();

    // Run immediately
    this.checkOrders();

    this.intervalId = setInterval(() => {
      this.checkOrders();
    }, CHECK_INTERVAL_MS);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('🛑 Limit Order Worker stopped.');

  }

  private async buildCoinMap() {
    try {
      const coins = await getCoins();
      for (const coin of coins) {
        if (!this.symbolToIdMap.has(coin.coin)) {
          // Fallback: use name lowercased, replace spaces with dashes
          // This is a heuristic for CoinGecko IDs
          const id = coin.name.toLowerCase().replace(/\s+/g, '-');
          this.symbolToIdMap.set(coin.coin, id);
        }
      }
      logger.info(`✅ Built coin map with ${this.symbolToIdMap.size} entries.`);
    } catch (error) {
      logger.error('⚠️ Failed to build coin map from SideShift, using defaults.', error);

    }
  }

  private async checkOrders() {
    try {
      // 1. Fetch pending orders using status or isActive, and check retry constraints
      const pendingOrders = await db.select().from(limitOrders)
        .where(
          and(
            eq(limitOrders.isActive, 1),
            eq(limitOrders.status, 'pending'),
            or(isNull(limitOrders.retryAfter), lte(limitOrders.retryAfter, new Date()))
          )
        );

      if (pendingOrders.length === 0) return;

      logger.info(`🔍 Checking ${pendingOrders.length} pending limit orders...`);


      // 2. Identify unique assets to fetch prices for
      const assetsToFetch = new Set<string>();
      for (const order of pendingOrders) {
        if (order.conditionAsset) {
          assetsToFetch.add(order.conditionAsset);
        } else if (order.fromAsset) {
          assetsToFetch.add(order.fromAsset);
        }
      }

      // 3. Fetch prices from CoinGecko
      const prices = await this.fetchPrices(Array.from(assetsToFetch));

      // 4. Check conditions and execute
      for (const order of pendingOrders) {
        // Use conditionAsset or fallback to fromAsset
        const asset = order.conditionAsset || order.fromAsset;
        const currentPrice = prices.get(asset);

        if (currentPrice === undefined) {
          logger.warn(`⚠️ No price found for ${asset}, skipping order ${order.id}`);
          continue;

        }

        if (this.isConditionMet(order, currentPrice)) {
          await this.executeOrder(order, currentPrice);
        }
      }

    } catch (error) {
      logger.error('❌ Error in Limit Order Worker loop:', error);
    }

  }

  private async fetchPrices(assets: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    const idsToFetch: string[] = [];
    const idToAssetMap = new Map<string, string>(); // ID -> Asset Symbol

    for (const asset of assets) {
      const id = this.symbolToIdMap.get(asset);
      if (id) {
        idsToFetch.push(id);
        idToAssetMap.set(id, asset);
      } else {
        logger.warn(`⚠️ No CoinGecko ID mapping for ${asset}`);
      }

    }

    if (idsToFetch.length === 0) return priceMap;

    try {
      // CoinGecko allows multiple IDs comma separated
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: idsToFetch.join(','),
          vs_currencies: 'usd'
        }
      });

      const data = response.data;
      // data format: { "bitcoin": { "usd": 50000 }, ... }

      for (const [id, priceData] of Object.entries(data) as [string, { usd: number }][]) {
        const asset = idToAssetMap.get(id);
        if (asset && priceData.usd) {
          priceMap.set(asset, priceData.usd);
        }
      }

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        logger.warn('⏳ CoinGecko rate limit hit, skipping this check cycle.');
      } else {
        logger.error('❌ Failed to fetch prices from CoinGecko:', error instanceof Error ? error.message : String(error));
      }

    }

    return priceMap;
  }

  private isConditionMet(order: LimitOrder, currentPrice: number): boolean {
    const { conditionOperator, conditionValue, targetPrice } = order;

    // Use conditionValue if available, else fallback to targetPrice parsing
    const target = conditionValue !== null ? conditionValue : parseFloat(targetPrice || '0');

    if (conditionOperator === 'gt') {
      return currentPrice > target;
    } else if (conditionOperator === 'lt') {
      return currentPrice < target;
    }

    return false;
  }

  private async executeOrder(order: LimitOrder, triggerPrice: number) {
    const asset = order.conditionAsset || order.fromAsset;
    const target = order.conditionValue || order.targetPrice;

    logger.info(`⚡ Condition met for Order #${order.id}: ${asset} is ${triggerPrice} (Target: ${order.conditionOperator} ${target})`);


    try {
      // Mark as executing
      const result = await db.update(limitOrders)
        .set({
          status: 'executing',
        })
        .where(and(eq(limitOrders.id, order.id), eq(limitOrders.status, 'pending')))
        .returning();

      if (result.length === 0) {
        logger.warn(`⚠️ Order #${order.id} was already picked up or cancelled.`);
        return;

      }

      // 1. Determine Settle Address
      let settleAddress = order.settleAddress;
      if (!settleAddress) {
        const user = await getUser(Number(order.telegramId));
        if (user?.walletAddress) {
          settleAddress = user.walletAddress;
        } else {
          throw new Error('No settle address provided and no wallet linked to user.');
        }
      }

      // 2. Create Quote
      // Note: order.fromAmount is text, parse it
      const amount = parseFloat(order.fromAmount);
      logger.info(`Creating quote for ${amount} ${order.fromAsset} -> ${order.toAsset}`);

      const quote = await createQuote(
        order.fromAsset,
        order.fromNetwork, // Used schema field name fromNetwork
        order.toAsset,
        order.toNetwork,   // Used schema field name toNetwork
        amount,
        undefined // IP
      );

      if (!quote.id) {
        throw new Error('Failed to create SideShift quote');
      }

      // 3. Create Order
      logger.info(`Creating order with quote ${quote.id}`);

      // Use settleAddress as refundAddress too for simplicity, or user wallet
      const sideshiftOrder = await createOrder(quote.id, settleAddress, settleAddress);

      if (!sideshiftOrder.id) {
        throw new Error('Failed to create SideShift order');
      }

      // 4. Update DB
      await updateLimitOrderStatus(order.id, 'executed', sideshiftOrder.id);
      logger.info(`✅ Order #${order.id} executed via SideShift (Order ID: ${sideshiftOrder.id})`);


      // 5. Notify User
      if (this.bot) {
        const depositAddress = typeof sideshiftOrder.depositAddress === 'object'
          ? sideshiftOrder.depositAddress.address
          : sideshiftOrder.depositAddress;

        const message = `🚀 *Limit Order Triggered!* \n\n` +
          `Condition: ${asset} reached ${triggerPrice}\n` +
          `Swap: ${amount} ${order.fromAsset} -> ${order.toAsset}\n\n` +
          `*Action Required:*\n` +
          `Send ${amount} ${order.fromAsset} to:\n` +
          `\`${depositAddress}\`\n\n` +
          `Order ID: \`${sideshiftOrder.id}\``;

        try {
          await this.bot.telegram.sendMessage(Number(order.telegramId), message, { parse_mode: 'Markdown' });
        } catch (err) {
          logger.error('Failed to send notification to user:', err);
        }

      }

    } catch (error) {
      logger.error(`❌ Failed to execute order #${order.id}:`, error);

      const MAX_RETRIES = 5;
      const currentRetries = order.retryCount || 0;

      if (currentRetries < MAX_RETRIES) {
        const nextRetryCount = currentRetries + 1;
        // Exponential backoff: 2^currentRetries * 1 minute -> 1,2,4,8,16...
        const backoffMs = Math.pow(2, currentRetries) * 60 * 1000;
        const nextRetryAfter = new Date(Date.now() + backoffMs);

        await db.update(limitOrders)
          .set({
            retryCount: nextRetryCount,
            retryAfter: nextRetryAfter,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'pending' // ensure status remains pending
          })
          .where(
            and(
              eq(limitOrders.id, order.id),
              eq(limitOrders.status, 'executing'),
              eq(limitOrders.isActive, 1),
            )
          );

        logger.info(`⏳ Scheduled retry ${nextRetryCount}/${MAX_RETRIES} for order #${order.id} at ${nextRetryAfter.toISOString()}`);
      } else {
        logger.warn(`🚫 Max retries reached for order #${order.id}, marking as permanently failed.`);
        await updateLimitOrderStatus(order.id, 'failed', undefined, error instanceof Error ? error.message : 'Unknown error');


        // Notify user of failure if possible
        if (this.bot) {
          try {
            await this.bot.telegram.sendMessage(Number(order.telegramId), `⚠️ Limit Order #${order.id} permanently failed after ${MAX_RETRIES} retries: ${error instanceof Error ? error.message : 'Unknown error'}`);
          } catch (e) {
            await handleError('LimitOrderNotificationError', {
              error: e instanceof Error ? e.message : 'Unknown error',
              stack: e instanceof Error ? e.stack : undefined,
              orderId: order.id,
              telegramId: order.telegramId,
              message: `Failed to send failure notification for order #${order.id}`
            }, null, true);
          }
        }
      }
    }
  }
}

export const limitOrderWorker = new LimitOrderWorker();