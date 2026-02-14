import axios from 'axios';

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';

// Expanded list of common tokens
const SYMBOL_TO_ID: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'AVAX': 'avalanche-2',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LINK': 'chainlink',
  'DAI': 'dai',
  'UNI': 'uniswap',
  'WBTC': 'wrapped-bitcoin',
  'LTC': 'litecoin',
  'BCH': 'bitcoin-cash',
  'WETH': 'weth',
  'SHIB': 'shiba-inu',
  'TRX': 'tron',
  'ATOM': 'cosmos',
  'XLM': 'stellar',
  'ETC': 'ethereum-classic',
  'FIL': 'filecoin',
  'NEAR': 'near',
  'APT': 'aptos',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'PEPE': 'pepe'
};

export async function getPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};

  const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];
  const ids: string[] = [];
  const idToSymbols: Record<string, string[]> = {};

  for (const symbol of uniqueSymbols) {
    const id = SYMBOL_TO_ID[symbol];
    if (id) {
      if (!idToSymbols[id]) {
        idToSymbols[id] = [];
        ids.push(id);
      }
      idToSymbols[id].push(symbol);
    } else {
      console.warn(`[PriceClient] Unknown symbol: ${symbol}`);
    }
  }

  if (ids.length === 0) return {};

  try {
    const response = await axios.get(COINGECKO_API, {
      params: {
        ids: ids.join(','),
        vs_currencies: 'usd'
      }
    });

    const prices: Record<string, number> = {};
    for (const id of ids) {
      if (response.data[id] && response.data[id].usd) {
        const price = response.data[id].usd;
        for (const symbol of idToSymbols[id]) {
          prices[symbol] = price;
        }
      }
    }
    return prices;
  } catch (error) {
    console.error('[PriceClient] Error fetching prices:', error instanceof Error ? error.message : String(error));
    // Return partial results or empty object.
    return {};
  }
}

export async function getPricesWithChange(symbols: string[]): Promise<Record<string, { price: number, change24h: number }>> {
  if (symbols.length === 0) return {};

  const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];
  const ids: string[] = [];
  const idToSymbols: Record<string, string[]> = {};

  for (const symbol of uniqueSymbols) {
    const id = SYMBOL_TO_ID[symbol];
    if (id) {
      if (!idToSymbols[id]) {
        idToSymbols[id] = [];
        ids.push(id);
      }
      idToSymbols[id].push(symbol);
    }
  }

  if (ids.length === 0) return {};

  try {
    const response = await axios.get(COINGECKO_API, {
      params: {
        ids: ids.join(','),
        vs_currencies: 'usd',
        include_24hr_change: 'true'
      }
    });

    const result: Record<string, { price: number, change24h: number }> = {};
    for (const id of ids) {
      if (response.data[id] && response.data[id].usd) {
        const price = response.data[id].usd;
        const change24h = response.data[id].usd_24h_change || 0;

        if (idToSymbols[id]) {
            for (const symbol of idToSymbols[id]) {
                result[symbol] = { price, change24h };
            }
        }
      }
    }
    return result;
  } catch (error) {
    console.error('[PriceClient] Error fetching prices with change:', error instanceof Error ? error.message : String(error));
    return {};
  }
}
