import axios from 'axios';
import * as db from './database';
import { handleError, default as logger } from './logger';

// CoinGecko API base URL
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

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
  'BASE': 'ethereum', // Base uses ETH
  'BNB': 'binancecoin',
  'DOGE': 'dogecoin',
  'ADA': 'cardano',
  'DOT': 'polkadot',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'MKR': 'maker',
  'SNX': 'havven',
  'CRV': 'curve-dao-token',
  'LDO': 'lido-dao',
  'GMX': 'gmx',
  'MAGIC': 'magic',
  'PEPE': 'pepe',
  'SHIB': 'shiba-inu',
  'FLOKI': 'floki',
  'BONK': 'bonk',
  'WIF': 'dogwifhat',
  'JUP': 'jupiter-exchange-solana',
  'PYTH': 'pyth-network',
  'RNDR': 'render-token',
  'TIA': 'celestia',
  'SUI': 'sui',
  'APT': 'aptos',
  'SEI': 'sei-network',
  'INJ': 'injective-protocol',
  'KAVA': 'kava',
  'FET': 'fetch-ai',
  'AGIX': 'singularitynet',
  'OCEAN': 'ocean-protocol',
  'AR': 'arweave',
  'FIL': 'filecoin',
  'NEAR': 'near',
  'ALGO': 'algorand',
  'XLM': 'stellar',
  'XRP': 'ripple',
  'LTC': 'litecoin',
  'BCH': 'bitcoin-cash',
  'ETC': 'ethereum-classic',
  'ATOM': 'cosmos',
  'OSMO': 'osmosis',
  'JUNO': 'juno-network',
  'STARS': 'stargaze',
  'AKT': 'akash-network',
  'SCRT': 'secret',
  'DVPN': 'sentinel',
  'XMR': 'monero',
  'ZEC': 'zcash',
  'DASH': 'dash',
  'BSV': 'bitcoin-cash-sv',
  'TON': 'the-open-network',
  'NOT': 'notcoin',
  'HMSTR': 'hamster-kombat',
  'CATI': 'catizen',
  'DOGS': 'dogs-2',
};

// Cache for prices to avoid hitting rate limits
interface PriceCache {
  [key: string]: {
    price: number;
    timestamp: number;
  };
}

const priceCache: PriceCache = {};
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Get CoinGecko ID for an asset
 */
function getCoinGeckoId(asset: string): string | null {
  const normalizedAsset = asset.toUpperCase();
  return ASSET_ID_MAP[normalizedAsset] || null;
}

/**
 * Fetch current price for an asset from CoinGecko
 */
export async function getCurrentPrice(asset: string): Promise<number | null> {
  const coinId = getCoinGeckoId(asset);
  
  if (!coinId) {
    logger.warn(`No CoinGecko mapping found for asset: ${asset}`);
    return null;
  }

  // Check cache first
  const cacheKey = coinId;
  const now = Date.now();
  if (priceCache[cacheKey] && (now - priceCache[cacheKey].timestamp) < CACHE_DURATION) {
    return priceCache[cacheKey].price;
  }

  try {
    const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
      params: {
        ids: coinId,
        vs_currencies: 'usd',
        include_24hr_change: 'true',
      },
      timeout: 10000,
    });

    const price = response.data[coinId]?.usd;
    
    if (price) {
      // Update cache
      priceCache[cacheKey] = {
        price,
        timestamp: now,
      };
      return price;
    }

    return null;
  } catch (error) {
    await handleError('PriceFetchError', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      asset,
      coinId 
    }, null, false);
    return null;
  }
}

/**
 * Fetch prices for multiple assets at once
 */
export async function getMultiplePrices(assets: string[]): Promise<Record<string, number | null>> {
  const uniqueAssets = [...new Set(assets)];
  const coinIds: string[] = [];
  const assetToCoinId: Record<string, string> = {};

  for (const asset of uniqueAssets) {
    const coinId = getCoinGeckoId(asset);
    if (coinId) {
      coinIds.push(coinId);
      assetToCoinId[asset] = coinId;
    }
  }

  if (coinIds.length === 0) {
    return {};
  }

  try {
    const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
      params: {
        ids: coinIds.join(','),
        vs_currencies: 'usd',
      },
      timeout: 10000,
    });

    const results: Record<string, number | null> = {};
    
    for (const asset of uniqueAssets) {
      const coinId = assetToCoinId[asset];
      if (coinId && response.data[coinId]) {
        const price = response.data[coinId].usd;
        results[asset] = price;
        
        // Update cache
        priceCache[coinId] = {
          price,
          timestamp: Date.now(),
        };
      } else {
        results[asset] = null;
      }
    }

    return results;
  } catch (error) {
    await handleError('PriceFetchError', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      assets: uniqueAssets 
    }, null, false);
    return {};
  }
}

/**
 * Check if a limit order condition is met
 */
export function isLimitOrderTriggered(
  currentPrice: number,
  targetPrice: number,
  condition: 'above' | 'below'
): boolean {
  if (condition === 'above') {
    return currentPrice >= targetPrice;
  } else {
    return currentPrice <= targetPrice;
  }
}

/**
 * Check all pending limit orders and return those that should be triggered
 */
export async function checkPendingLimitOrders(): Promise<db.DelayedOrder[]> {
  const pendingOrders = await db.getPendingDelayedOrders();
  const limitOrders = pendingOrders.filter(order => order.orderType === 'limit_order');
  
  if (limitOrders.length === 0) {
    return [];
  }

  // Get unique assets to fetch prices
  const assets = [...new Set(limitOrders.map(order => order.toAsset))];
  const prices = await getMultiplePrices(assets);

  const triggeredOrders: db.DelayedOrder[] = [];

  for (const order of limitOrders) {
    const currentPrice = prices[order.toAsset];
    
    if (!currentPrice || !order.targetPrice || !order.condition) {
      continue;
    }

    // Check if order has expired
    if (order.expiryDate && new Date() > new Date(order.expiryDate)) {
      await db.updateDelayedOrderStatus(order.id, 'expired');
      continue;
    }

    // Check if condition is met
    if (isLimitOrderTriggered(currentPrice, order.targetPrice, order.condition as 'above' | 'below')) {
      triggeredOrders.push(order);
    }
  }

  return triggeredOrders;
}

/**
 * Get price change percentage for an asset
 */
export async function getPriceChange(asset: string, days: number = 1): Promise<number | null> {
  const coinId = getCoinGeckoId(asset);
  
  if (!coinId) {
    return null;
  }

  try {
    const response = await axios.get(`${COINGECKO_API_URL}/coins/${coinId}/market_chart`, {
      params: {
        vs_currency: 'usd',
        days: days,
      },
      timeout: 10000,
    });

    const prices = response.data.prices;
    if (!prices || prices.length < 2) {
      return null;
    }

    const oldPrice = prices[0][1];
    const newPrice = prices[prices.length - 1][1];
    const change = ((newPrice - oldPrice) / oldPrice) * 100;

    return change;
  } catch (error) {
    await handleError('PriceChangeError', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      asset,
      days 
    }, null, false);
    return null;
  }
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else {
    return `$${price.toFixed(6)}`;
  }
}

/**
 * Get asset symbol from CoinGecko ID (reverse lookup)
 */
export function getAssetSymbol(coinId: string): string | null {
  for (const [symbol, id] of Object.entries(ASSET_ID_MAP)) {
    if (id === coinId) {
      return symbol;
    }
  }
  return null;
}
