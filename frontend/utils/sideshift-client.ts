import axios from 'axios';
import { SIDESHIFT_CONFIG } from '../../shared/config/sideshift';
import { SideShiftQuoteSchema, SideShiftCheckoutResponseSchema, CoinSchema } from '../../shared/schemas/sideshift';
const AFFILIATE_ID = process.env.NEXT_PUBLIC_AFFILIATE_ID;
const API_KEY = process.env.NEXT_PUBLIC_SIDESHIFT_API_KEY;

export interface SideShiftQuote {
  id?: string;
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
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

export async function createQuote(
  fromAsset: string,
  fromNetwork: string,
  toAsset: string,
  toNetwork: string,
  amount: number,
  userIP: string
): Promise<SideShiftQuote> {
  try {
    const response = await axios.post(
      `${SIDESHIFT_CONFIG.BASE_URL}/quotes`,
      {
        depositCoin: fromAsset,
        depositNetwork: fromNetwork,
        settleCoin: toAsset,
        settleNetwork: toNetwork,
        depositAmount: amount.toString(),
        affiliateId: AFFILIATE_ID,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-sideshift-secret': API_KEY,
          'x-user-ip': userIP
        }
      }
    );
    return SideShiftQuoteSchema.parse(response.data);
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: { message?: string } } } };
    throw new Error(err.response?.data?.error?.message || 'Failed to create quote');
  }
}

export async function createCheckout(
  settleCoin: string,
  settleNetwork: string,
  settleAmount: number,
  settleAddress: string,
  userIP: string
): Promise<SideShiftCheckoutResponse> {
  try {
    const response = await axios.post(
      `${SIDESHIFT_CONFIG.BASE_URL}/checkout`,
      {
        settleCoin,
        settleNetwork,
        settleAmount: settleAmount.toString(),
        affiliateId: AFFILIATE_ID,
        settleAddress: settleAddress,
        successUrl: SIDESHIFT_CONFIG.SUCCESS_URL,
        cancelUrl: SIDESHIFT_CONFIG.CANCEL_URL,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-sideshift-secret': API_KEY,
          'x-user-ip': userIP,
        },
      }
    );

    const validatedData = SideShiftCheckoutResponseSchema.parse(response.data);

    return {
      id: validatedData.id,
      url: `${SIDESHIFT_CONFIG.CHECKOUT_URL}/${validatedData.id}`,
      settleAmount: validatedData.settleAmount,
      settleCoin: validatedData.settleCoin
    };
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: { message?: string } } } };
    throw new Error(err.response?.data?.error?.message || 'Failed to create checkout');
  }
}

/**
 * Fetches all available coins from SideShift API
 */
export async function getCoins(): Promise<any[]> {
  try {
    const response = await axios.get(`${SIDESHIFT_CONFIG.BASE_URL}/coins`);
    return CoinSchema.array().parse(response.data);
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: { message?: string } } } };
    throw new Error(err.response?.data?.error?.message || 'Failed to fetch coins');
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
    console.error('CoinGecko API error:', error);

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
            `${SIDESHIFT_CONFIG.BASE_URL}/quotes`,
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

          // Rate is settleAmount / depositAmount, so for 1 unit it's the direct price
          const settleAmount = parseFloat(quoteResponse.data.settleAmount || quoteResponse.data.rate);

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
    } catch {
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
      `${SIDESHIFT_CONFIG.BASE_URL}/quotes`,
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

    const rate = parseFloat(quoteResponse.data.rate);
    return rate > 0 ? (1 / rate).toFixed(6) : null;
  } catch {
    return null;
  }
}