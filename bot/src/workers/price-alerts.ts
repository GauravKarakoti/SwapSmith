import { Telegraf } from 'telegraf';
import axios from 'axios';
import { eq } from 'drizzle-orm';
import { db, users, userSettings } from '../services/database';
import { priceAlerts } from '../../../shared/schema';
import logger from '../services/logger';

const CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

// Asset ID mapping for CoinGecko
const ASSET_ID_MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'DAI': 'dai',
  'MATIC': 'polygon',
  'SOL': 'solana',
  'AVAX': 'avalanche-2',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'BNB': 'binancecoin',
  'DOGE': 'dogecoin',
  'ADA': 'cardano',
  'DOT': 'polkadot',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'MKR': 'maker',
  'SHIB': 'shiba-inu',
  'PEPE': 'pepe',
  'WIF': 'dogwifhat',
  'BONK': 'bonk',
  'JUP': 'jupiter-exchange-solana',
  'APT': 'aptos',
  'SUI': 'sui',
  'TIA': 'celestia',
};

export class PriceAlertWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private bot: Telegraf | null = null;

  constructor() {
    // Constructor - no initialization needed
  }

  public async start(bot: Telegraf) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.bot = bot;

    logger.info('🚀 Starting Price Alert Worker...');

    // Run immediately
    this.checkAlerts();

    this.intervalId = setInterval(() => {
      this.checkAlerts();
    }, CHECK_INTERVAL_MS);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('🛑 Price Alert Worker stopped.');
  }

  private async checkAlerts() {
    try {
      // 1. Fetch active alerts
      const activeAlerts = await db.select().from(priceAlerts)
        .where(eq(priceAlerts.isActive, true));

      if (activeAlerts.length === 0) return;

      logger.info(`🔍 Checking ${activeAlerts.length} active price alerts...`);

      // 2. Identify unique assets to fetch prices for
      const assetsToFetch = new Set<string>();
      for (const alert of activeAlerts) {
        assetsToFetch.add(alert.coin.toUpperCase());
      }

      // 3. Fetch prices from CoinGecko
      const prices = await this.fetchPrices(Array.from(assetsToFetch));

      // 4. Check conditions and trigger notifications
      for (const alert of activeAlerts) {
        const currentPrice = prices.get(alert.coin.toUpperCase());

        if (currentPrice === undefined) {
          logger.warn(`⚠️ No price found for ${alert.coin}, skipping alert ${alert.id}`);
          continue;
        }

        const targetPrice = parseFloat(alert.targetPrice.toString());
        
        if (this.isConditionMet(alert.condition, currentPrice, targetPrice)) {
          await this.triggerAlert(alert, currentPrice);
        }
      }

    } catch (error) {
      logger.error('❌ Error in Price Alert Worker loop:', error);
    }
  }

  private async fetchPrices(assets: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    const idsToFetch: string[] = [];
    const idToAssetMap = new Map<string, string>();

    for (const asset of assets) {
      const id = ASSET_ID_MAP[asset];
      if (id) {
        idsToFetch.push(id);
        idToAssetMap.set(id, asset);
      } else {
        logger.warn(`⚠️ No CoinGecko ID mapping for ${asset}`);
      }
    }

    if (idsToFetch.length === 0) return priceMap;

    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: idsToFetch.join(','),
          vs_currencies: 'usd'
        }
      });

      const data = response.data;

      for (const [id, priceData] of Object.entries(data) as [string, { usd: number }][]) {
        const asset = idToAssetMap.get(id);
        if (asset && priceData.usd) {
          priceMap.set(asset, priceData.usd);
        }
      }

    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        logger.warn('⏳ CoinGecko rate limit hit, skipping this check cycle.');
      } else {
        logger.error('❌ Failed to fetch prices from CoinGecko:', error.message);
      }
    }

    return priceMap;
  }

  private isConditionMet(condition: string, currentPrice: number, targetPrice: number): boolean {
    if (condition === 'gt') {
      return currentPrice > targetPrice;
    } else if (condition === 'lt') {
      return currentPrice < targetPrice;
    }
    return false;
  }

  private async triggerAlert(alert: any, currentPrice: number) {
    const targetPrice = parseFloat(alert.targetPrice.toString());
    const conditionText = alert.condition === 'gt' ? 'above' : 'below';
    
    logger.info(`⚡ Alert triggered for ${alert.coin}: Price is $${currentPrice}, target was ${conditionText} $${targetPrice}`);

    try {
      // 1. Mark alert as triggered
      await db.update(priceAlerts)
        .set({
          isActive: false,
          triggeredAt: new Date()
        })
        .where(eq(priceAlerts.id, alert.id));

      // 2. Get user notification preferences
      let telegramId = alert.telegramId;
      let userId = alert.userId;

      // Try to get telegramId from users table if not set
      if (!telegramId && userId) {
        const user = await db.select().from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (user[0]?.telegramId) {
          telegramId = user[0].telegramId;
        }
      }

      // 3. Send Telegram notification if bot is available
      if (this.bot && telegramId) {
        const message = `🔔 *Price Alert Triggered!*\n\n` +
          `*${alert.name} (${alert.coin.toUpperCase()})*\n` +
          `Current Price: *$${currentPrice.toLocaleString()}*\n` +
          `Target: ${alert.condition === 'gt' ? 'Above' : 'Below'} $${targetPrice.toLocaleString()}\n\n` +
          `Network: ${alert.network}`;

        try {
          await this.bot.telegram.sendMessage(Number(telegramId), message, { parse_mode: 'Markdown' });
          logger.info(`✅ Notification sent for alert ${alert.id}`);
        } catch (err) {
          logger.error('Failed to send Telegram notification:', err);
        }
      } else if (!telegramId) {
        logger.warn(`⚠️ No Telegram ID for alert ${alert.id}, cannot send notification`);
      }

    } catch (error) {
      logger.error(`❌ Error triggering alert ${alert.id}:`, error);
    }
  }
}

export const priceAlertWorker = new PriceAlertWorker();
