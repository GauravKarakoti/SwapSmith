import axios from 'axios';
import { SIDESHIFT_CONFIG, getApiUrl } from '../../shared/config/sideshift';
import { validateDepositAddressForNetwork } from './addressValidation';

// API key is now server-side only - client calls backend API routes

export interface SideShiftQuote {
  id?: string;
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
  depositAddress: string;
  depositAmount: string;
  settleAmount: string;
  rate: string;
  affiliateId: string;
  error?: { code: string; message: string; };
  memo?: string;
  expiry?: string;
}

export interface SideShiftCheckoutResponse {
  id: string;
  url: string;
  settleAmount: string;
  settleCoin: string;
}

export interface CoinNetwork {
  network: string;
  tokenContract?: string;
  depositAddressType?: string;
  depositOffline?: boolean;
  settleOffline?: boolean;
}

export interface Coin {
  coin: string;
  name: string;
  networks: CoinNetwork[];
  chainData?: {
    chain: string;
    mainnet: boolean;
  };
}

export interface CoinPrice {
  coin: string;
  name: string;
  network: string;
  usdPrice?: string;
  btcPrice?: string;
  available: boolean;
}

// ============================================
// Zod Schemas for Runtime Validation
// ============================================

const SideShiftErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

const CoinNetworkSchema: z.ZodSchema<CoinNetwork> = z.object({
  network: z.string(),
  tokenContract: z.string().optional(),
  depositAddressType: z.string().optional(),
  depositOffline: z.boolean().optional(),
  settleOffline: z.boolean().optional(),
});

const CoinSchema = z.object({
  coin: z.string(),
  name: z.string(),
  networks: z.array(CoinNetworkSchema),
  chainData: z.object({
    chain: z.string(),
    mainnet: z.boolean(),
  }).optional(),
});

const CoinPriceSchema = z.object({
  coin: z.string(),
  name: z.string(),
  network: z.string(),
  usdPrice: z.string().optional(),
  btcPrice: z.string().optional(),
  available: z.boolean(),
});

const SideShiftQuoteSchema = z.object({
  id: z.string().optional(),
  depositCoin: z.string(),
  depositNetwork: z.string(),
  settleCoin: z.string(),
  settleNetwork: z.string(),
  depositAmount: z.string(),
  settleAmount: z.string(),
  rate: z.string(),
  affiliateId: z.string(),
  error: SideShiftErrorSchema.optional(),
  memo: z.string().optional(),
  expiry: z.string().optional(),
});

const SideShiftCheckoutResponseSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  settleAmount: z.string(),
  settleCoin: z.string(),
});

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validates API response data against a Zod schema
 * @throws Error with detailed validation issues if validation fails
 */
function validateResponse<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const issues = result.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`SideShift API response validation failed for ${context}: ${issues}`);
  }
  
  return result.data;
}

// ============================================
// API Functions with Validation
// ============================================

export async function createQuote(
  fromAsset: string,
  fromNetwork: string,
  toAsset: string,
  toNetwork: string,
  amount: number,
  _userIP: string
): Promise<SideShiftQuote> {
  try {
    // Call backend API route instead of SideShift directly
    const response = await axios.post('/api/sideshift/quote', {
      depositCoin: fromAsset,
      depositNetwork: fromNetwork,
      settleCoin: toAsset,
      settleNetwork: toNetwork,
      depositAmount: amount,
    });

    const quote = { ...response.data, id: response.data.id };

    // SECURITY: Validate depositAddress presence + format for the reported network
    const addressCheck = validateDepositAddressForNetwork(quote.depositNetwork, quote.depositAddress);
    if (!addressCheck.passed) {
      console.error('SECURITY: SideShift quote failed deposit address validation:', {
        quoteId: quote.id,
        depositNetwork: quote.depositNetwork,
        depositAddress: quote.depositAddress,
        message: addressCheck.message,
      });
      throw new Error(`Invalid quote: ${addressCheck.message}. Please try again.`);
    }

    return quote;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
    }
    throw error;
  }
}

export async function createCheckout(
  settleCoin: string,
  settleNetwork: string,
  settleAmount: number,
  settleAddress: string,
  _userIP: string
): Promise<SideShiftCheckoutResponse> {
  try {
    // Call backend API route instead of SideShift directly
    const response = await axios.post('/api/sideshift/checkout', {
      settleCoin,
      settleNetwork,
      settleAmount,
      settleAddress,
    });

    return {
      id: response.data.id,
      url: response.data.url,
      settleAmount: response.data.settleAmount,
      settleCoin: response.data.settleCoin
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      throw new Error(err.response?.data?.error?.message || 'Failed to create checkout');
    }
    throw error;
  }
}

let coinsCache: Coin[] | null = null;
let coinsCacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches all available coins from SideShift API
 * Results are cached for 5 minutes
 */
export async function getCoins(): Promise<Coin[]> {
  if (coinsCache && Date.now() - coinsCacheTimestamp < CACHE_TTL) {
    return coinsCache;
  }

  try {
    const response = await axios.get(getApiUrl('coins'));
    coinsCache = response.data;
    coinsCacheTimestamp = Date.now();
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      throw new Error(err.response?.data?.error?.message || 'Failed to fetch coins');
    }
    throw error;
  }
}

/**
 * Fetches prices for popular cryptocurrencies from CoinGecko API
 * Returns 15-20 coins with accurate real-time prices
 */
export async function getCoinPrices(): Promise<CoinPrice[]> {
  try {
    // CoinGecko mapping for coin symbols
    const coinGeckoMap: { [key: string]: { id: string; name: string; network: string } } = {
      'btc': { id: 'bitcoin', name: 'Bitcoin', network: 'bitcoin' },
      'eth': { id: 'ethereum', name: 'Ethereum', network: 'ethereum' },
      'usdt': { id: 'tether', name: 'Tether', network: 'ethereum' },
      'bnb': { id: 'binancecoin', name: 'BNB', network: 'bsc' },
      'usdc': { id: 'usd-coin', name: 'USD Coin', network: 'ethereum' },
      'xrp': { id: 'ripple', name: 'XRP', network: 'ripple' },
      'ada': { id: 'cardano', name: 'Cardano', network: 'cardano' },
      'doge': { id: 'dogecoin', name: 'Dogecoin', network: 'dogecoin' },
      'sol': { id: 'solana', name: 'Solana', network: 'solana' },
      'trx': { id: 'tron', name: 'TRON', network: 'tron' },
      'ltc': { id: 'litecoin', name: 'Litecoin', network: 'litecoin' },
      'matic': { id: 'matic-network', name: 'Polygon', network: 'polygon' },
      'dot': { id: 'polkadot', name: 'Polkadot', network: 'polkadot' },
      'dai': { id: 'dai', name: 'Dai', network: 'ethereum' },
      'avax': { id: 'avalanche-2', name: 'Avalanche', network: 'avalanche' },
      'link': { id: 'chainlink', name: 'Chainlink', network: 'ethereum' },
      'bch': { id: 'bitcoin-cash', name: 'Bitcoin Cash', network: 'bitcoincash' },
      'uni': { id: 'uniswap', name: 'Uniswap', network: 'ethereum' },
      'xlm': { id: 'stellar', name: 'Stellar', network: 'stellar' },
      'atom': { id: 'cosmos', name: 'Cosmos', network: 'cosmos' },
    };

    const coinIds = Object.values(coinGeckoMap).map(c => c.id).join(',');

    // Fetch prices from CoinGecko free API
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price`,
      {
        params: {
          ids: coinIds,
          vs_currencies: 'usd',
          include_24hr_change: 'true'
        },
        timeout: 10000,
      }
    );

    const priceData = response.data;
    const results: CoinPrice[] = [];

    // Map the prices back to our coin format
    for (const [symbol, coinInfo] of Object.entries(coinGeckoMap)) {
      const price = priceData[coinInfo.id];
      if (price && price.usd) {
        results.push({
          coin: symbol,
          name: coinInfo.name,
          network: coinInfo.network,
          usdPrice: price.usd.toString(),
          available: true,
        });
      }
    }

    // Ensure we have at least 15 coins
    if (results.length < 15) {
      throw new Error('Insufficient price data available');
    }

    return results;
  } catch (error: unknown) {
    // If it's already an Error, rethrow it
    if (error instanceof Error) {
      console.error('CoinGecko API error:', error.message);
    } else {
      console.error('CoinGecko API error:', error);
    }

    // Fallback: Try to fetch from SideShift with corrected calculation
    try {
      const coins = await getCoins();
      const popularCoins = ['btc', 'eth', 'usdt', 'bnb', 'usdc', 'xrp', 'ada', 'doge', 'sol', 'trx', 'ltc', 'matic', 'dot', 'dai', 'avax'];

      const filteredCoins = coins
        .filter(c => popularCoins.includes(c.coin.toLowerCase()))
        .slice(0, 15);

      const pricesPromises = filteredCoins.map(async (coin): Promise<CoinPrice | null> => {
        try {
          const network = coin.networks[0];
          // For stablecoins, use fixed price
          if (['usdt', 'usdc', 'dai'].includes(coin.coin.toLowerCase())) {
            return {
              coin: coin.coin,
              name: coin.name,
              network: network.network,
              usdPrice: '1.00',
              available: true,
            };
          }

          const quoteResponse = await axios.post(
            getApiUrl('quotes'),
            {
              depositCoin: coin.coin,
              depositNetwork: network.network,
              settleCoin: 'usdt',
              settleNetwork: 'ethereum',
              depositAmount: '1',
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 5000,
            }
          );

          // Validate the quote response
          const validatedQuote = validateResponse(SideShiftQuoteSchema, quoteResponse.data, 'getCoinPrices-fallback');

          // Rate is settleAmount / depositAmount, so for 1 unit it's the direct price
          const settleAmount = parseFloat(validatedQuote.settleAmount || validatedQuote.rate);

          if (settleAmount > 0) {
            return {
              coin: coin.coin,
              name: coin.name,
              network: network.network,
              usdPrice: settleAmount.toString(),
              available: true,
            };
          }
          return null;
        } catch {
          return null;
        }
      });

      const prices = await Promise.all(pricesPromises);
      return prices.filter((p): p is CoinPrice => p !== null);
    } catch (fallbackError) {
      throw new Error('Failed to fetch coin prices from all sources');
    }
  }
}

/**
 * Fetches a specific coin's price
 */
export async function getCoinPrice(coin: string, network: string): Promise<string | null> {
  try {
    const quoteResponse = await axios.post(
      getApiUrl('quotes'),
      {
        depositCoin: coin,
        depositNetwork: network,
        settleCoin: 'usdt',
        settleNetwork: 'ethereum',
        depositAmount: '1',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    // Validate the quote response
    const validatedQuote = validateResponse(SideShiftQuoteSchema, quoteResponse.data, 'getCoinPrice');

    const rate = parseFloat(validatedQuote.rate);
    return rate > 0 ? (1 / rate).toFixed(6) : null;
  } catch {
    return null;
  }
}

