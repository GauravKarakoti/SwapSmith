import { Telegraf } from 'telegraf';
import axios from 'axios';
import { eq, and } from 'drizzle-orm';
import { db, limitOrders, LimitOrder, updateLimitOrderStatus, getUser } from '../services/database';
import { getCoins, createQuote, createOrder } from '../services/sideshift-client';

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

    console.log('🚀 Starting Limit Order Worker...');

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
    console.log('🛑 Limit Order Worker stopped.');
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
      console.log(`✅ Built coin map with ${this.symbolToIdMap.size} entries.`);
    } catch (error) {
      console.error('⚠️ Failed to build coin map from SideShift, using defaults.', error);
    }
  }

  private async checkOrders() {
    try {
      // 1. Fetch pending orders
      const pendingOrders = await db.select().from(limitOrders).where(eq(limitOrders.status, 'pending'));

      if (pendingOrders.length === 0) return;

      console.log(`🔍 Checking ${pendingOrders.length} pending limit orders...`);

      // 2. Identify unique assets to fetch prices for
      const assetsToFetch = new Set<string>();
      for (const order of pendingOrders) {
        assetsToFetch.add(order.conditionAsset);
      }

      // 3. Fetch prices from CoinGecko
      const prices = await this.fetchPrices(Array.from(assetsToFetch));

      // 4. Check conditions and execute
      for (const order of pendingOrders) {
        const currentPrice = prices.get(order.conditionAsset);

        if (currentPrice === undefined) {
          console.warn(`⚠️ No price found for ${order.conditionAsset}, skipping order ${order.id}`);
          continue;
        }

        if (this.isConditionMet(order, currentPrice)) {
          await this.executeOrder(order, currentPrice);
        }
      }

    } catch (error) {
      console.error('❌ Error in Limit Order Worker loop:', error);
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
        console.warn(`⚠️ No CoinGecko ID mapping for ${asset}`);
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
            console.warn('⏳ CoinGecko rate limit hit, skipping this check cycle.');
        } else {
            console.error('❌ Failed to fetch prices from CoinGecko:', error instanceof Error ? error.message : String(error));
        }
    }

    return priceMap;
  }

  private isConditionMet(order: LimitOrder, currentPrice: number): boolean {
    const { conditionOperator, conditionValue } = order;

    if (conditionOperator === 'gt') {
      return currentPrice > conditionValue;
    } else if (conditionOperator === 'lt') {
      return currentPrice < conditionValue;
    }

    return false;
  }

  private async executeOrder(order: LimitOrder, triggerPrice: number) {
    console.log(`⚡ Condition met for Order #${order.id}: ${order.conditionAsset} is ${triggerPrice} (Target: ${order.conditionOperator} ${order.conditionValue})`);

    try {
        // Mark as executing
        const result = await db.update(limitOrders)
            .set({
                status: 'executing',
                executedAt: new Date()
            })
            .where(and(eq(limitOrders.id, order.id), eq(limitOrders.status, 'pending')))
            .returning();

        if (result.length === 0) {
            console.warn(`⚠️ Order #${order.id} was already picked up or cancelled.`);
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
        console.log(`Creating quote for ${order.amount} ${order.fromAsset} -> ${order.toAsset}`);
        const quote = await createQuote(
            order.fromAsset,
            order.fromChain,
            order.toAsset,
            order.toChain,
            order.amount,
            undefined // IP
        );

        if (!quote.id) {
            throw new Error('Failed to create SideShift quote');
        }

        // 3. Create Order
        console.log(`Creating order with quote ${quote.id}`);
        // Use settleAddress as refundAddress too for simplicity, or user wallet
        const sideshiftOrder = await createOrder(quote.id, settleAddress, settleAddress);

        if (!sideshiftOrder.id) {
            throw new Error('Failed to create SideShift order');
        }

        // 4. Update DB
        await updateLimitOrderStatus(order.id, 'executed', sideshiftOrder.id);
        console.log(`✅ Order #${order.id} executed via SideShift (Order ID: ${sideshiftOrder.id})`);

        // 5. Notify User
        if (this.bot) {
            const depositAddress = typeof sideshiftOrder.depositAddress === 'object'
                ? sideshiftOrder.depositAddress.address
                : sideshiftOrder.depositAddress;

            const message = `🚀 *Limit Order Triggered!* \n\n` +
                `Condition: ${order.conditionAsset} reached ${triggerPrice}\n` +
                `Swap: ${order.amount} ${order.fromAsset} -> ${order.toAsset}\n\n` +
                `*Action Required:*\n` +
                `Send ${order.amount} ${order.fromAsset} to:\n` +
                `\`${depositAddress}\`\n\n` +
                `Order ID: \`${sideshiftOrder.id}\``;

            try {
                await this.bot.telegram.sendMessage(Number(order.telegramId), message, { parse_mode: 'Markdown' });
            } catch (err) {
                console.error('Failed to send notification to user:', err);
            }
        }

    } catch (error) {
        console.error(`❌ Failed to execute order #${order.id}:`, error);
        await updateLimitOrderStatus(order.id, 'failed', undefined, error instanceof Error ? error.message : 'Unknown error');

        // Notify user of failure if possible
         if (this.bot) {
            try {
                await this.bot.telegram.sendMessage(Number(order.telegramId), `⚠️ Limit Order #${order.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } catch (e) {}
        }
    }
  }
}

export const limitOrderWorker = new LimitOrderWorker();
