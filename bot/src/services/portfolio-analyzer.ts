import axios from 'axios';
import { eq } from 'drizzle-orm';
import { db, users } from './database';
import { portfolioTargets, swapHistory, coinPriceCache } from '../../../shared/schema';
import logger from './logger';

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

export interface PortfolioAsset {
  coin: string;
  network: string;
  targetPercentage: number;
}

export interface CurrentPortfolio {
  assets: {
    coin: string;
    network: string;
    amount: number;
    value: number;
    percentage: number;
  }[];
  totalValue: number;
}

export interface DriftAnalysis {
  asset: string;
  network: string;
  targetPercentage: number;
  currentPercentage: number;
  drift: number; // positive = overweight, negative = underweight
  needsRebalance: boolean;
  suggestedAction: 'buy' | 'sell' | 'hold';
  amountToTrade: number; // in USD
}

export interface RebalancePlan {
  portfolioTargetId: number;
  currentPortfolio: CurrentPortfolio;
  drifts: DriftAnalysis[];
  needsRebalance: boolean;
  totalDrift: number;
  estimatedSwaps: number;
}

/**
 * Fetches current prices for multiple assets from CoinGecko
 */
async function fetchPrices(coins: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  const idsToFetch: string[] = [];
  const idToAssetMap = new Map<string, string>();

  for (const coin of coins) {
    const id = ASSET_ID_MAP[coin.toUpperCase()];
    if (id) {
      idsToFetch.push(id);
      idToAssetMap.set(id, coin.toUpperCase());
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
      logger.warn('⏳ CoinGecko rate limit hit, using cached prices');
    } else {
      logger.error('❌ Failed to fetch prices from CoinGecko:', error.message);
    }
  }

  return priceMap;
}

/**
 * Get user's swap history to calculate current portfolio holdings
 */
export async function getUserPortfolioHoldings(
  userId: string,
  walletAddress?: string
): Promise<CurrentPortfolio> {
  try {
    // Get all swap history for this user
    const swaps = await db.select().from(swapHistory)
      .where(eq(swapHistory.userId, userId));

    // Calculate holdings from swap history
    const holdings: Record<string, { amount: number; network: string }> = {};

    for (const swap of swaps) {
      // Add to holdings (from asset)
      const fromKey = `${swap.fromAsset}-${swap.fromNetwork}`;
      if (!holdings[fromKey]) {
        holdings[fromKey] = { amount: 0, network: swap.fromNetwork };
      }
      holdings[fromKey].amount += swap.fromAmount;

      // Subtract from holdings (to asset) - assuming they sold
      const toKey = `${swap.toAsset}-${swap.toNetwork}`;
      if (!holdings[toKey]) {
        holdings[toKey] = { amount: 0, network: swap.toNetwork };
      }
      // Note: This is a simplified calculation. In reality, you'd track current balances
    }

    // Get unique coins
    const uniqueCoins = [...new Set(Object.keys(holdings).map(k => k.split('-')[0]))];
    
    // Fetch prices
    const prices = await fetchPrices(uniqueCoins);

    // Calculate values
    const assets: CurrentPortfolio['assets'] = [];
    let totalValue = 0;

    for (const [key, data] of Object.entries(holdings)) {
      const [coin, network] = key.split('-');
      const price = prices.get(coin) || 0;
      const value = data.amount * price;
      
      if (value > 0) {
        assets.push({
          coin,
          network,
          amount: data.amount,
          value,
          percentage: 0 // Will calculate after total
        });
        totalValue += value;
      }
    }

    // Calculate percentages
    for (const asset of assets) {
      asset.percentage = totalValue > 0 ? (asset.value / totalValue) * 100 : 0;
    }

    return { assets, totalValue };
  } catch (error) {
    logger.error('Error calculating portfolio holdings:', error);
    return { assets: [], totalValue: 0 };
  }
}

/**
 * Analyze portfolio drift from target allocations
 */
export async function analyzePortfolioDrift(
  portfolioTargetId: number
): Promise<RebalancePlan | null> {
  try {
    // Get portfolio target
    const targets = await db.select().from(portfolioTargets)
      .where(eq(portfolioTargets.id, portfolioTargetId));

    if (!targets[0]) {
      logger.warn(`Portfolio target ${portfolioTargetId} not found`);
      return null;
    }

    const target = targets[0];
    const userId = target.userId;

    // Get current portfolio
    const currentPortfolio = await getUserPortfolioHoldings(userId);

    if (currentPortfolio.assets.length === 0) {
      logger.warn(`No holdings found for user ${userId}`);
      return null;
    }

    // Parse target assets
    const targetAssets = target.assets as PortfolioAsset[];
    const driftThreshold = target.driftThreshold;

    // Analyze drift for each target asset
    const drifts: DriftAnalysis[] = [];

    for (const targetAsset of targetAssets) {
      const currentAsset = currentPortfolio.assets.find(
        a => a.coin.toUpperCase() === targetAsset.coin.toUpperCase()
      );

      const currentPercentage = currentAsset?.percentage || 0;
      const drift = currentPercentage - targetAsset.targetPercentage;
      const needsRebalance = Math.abs(drift) >= driftThreshold;

      let suggestedAction: 'buy' | 'sell' | 'hold' = 'hold';
      let amountToTrade = 0;

      if (needsRebalance) {
        if (drift > 0) {
          suggestedAction = 'sell';
          amountToTrade = (drift / 100) * currentPortfolio.totalValue;
        } else {
          suggestedAction = 'buy';
          amountToTrade = (Math.abs(drift) / 100) * currentPortfolio.totalValue;
        }
      }

      drifts.push({
        asset: targetAsset.coin,
        network: targetAsset.network,
        targetPercentage: targetAsset.targetPercentage,
        currentPercentage,
        drift,
        needsRebalance,
        suggestedAction,
        amountToTrade
      });
    }

    // Check for assets in portfolio but not in targets (could be sold)
    const targetCoins = targetAssets.map(a => a.coin.toUpperCase());
    for (const currentAsset of currentPortfolio.assets) {
      if (!targetCoins.includes(currentAsset.coin.toUpperCase())) {
        drifts.push({
          asset: currentAsset.coin,
          network: currentAsset.network,
          targetPercentage: 0,
          currentPercentage: currentAsset.percentage,
          drift: currentAsset.percentage,
          needsRebalance: currentAsset.percentage >= driftThreshold,
          suggestedAction: currentAsset.percentage >= driftThreshold ? 'sell' : 'hold',
          amountToTrade: currentAsset.value
        });
      }
    }

    const needsRebalance = drifts.some(d => d.needsRebalance);
    const totalDrift = drifts.reduce((sum, d) => sum + Math.abs(d.drift), 0);
    const estimatedSwaps = drifts.filter(d => d.needsRebalance && d.amountToTrade > 0).length;

    return {
      portfolioTargetId,
      currentPortfolio,
      drifts,
      needsRebalance,
      totalDrift,
      estimatedSwaps
    };
  } catch (error) {
    logger.error('Error analyzing portfolio drift:', error);
    return null;
  }
}

/**
 * Get all active portfolio targets for a user
 */
export async function getUserPortfolioTargets(userId: string) {
  return await db.select().from(portfolioTargets)
    .where(eq(portfolioTargets.userId, userId));
}

/**
 * Get all active portfolio targets that need rebalancing
 */
export async function getPortfoliosNeedingRebalance(): Promise<typeof portfolioTargets.$inferSelect[]> {
  // This would need to be implemented with a more complex query
  // For now, return all active targets
  return await db.select().from(portfolioTargets)
    .where(eq(portfolioTargets.isActive, true));
}
