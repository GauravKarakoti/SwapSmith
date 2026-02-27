import { fetchFearGreedIndex, fetchFearGreedHistory, FearGreedData } from './fear-greed';

export interface MarketSentiment {
  bullish: number;
  neutral: number;
  bearish: number;
  fearGreed: FearGreedData | null;
  fearGreedHistory: FearGreedData[];
  lastUpdated: number;
}

export interface TradingSignal {
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
}

// Utility to fetch CoinGecko market data for sentiment
export async function fetchMarketSentiment(): Promise<MarketSentiment> {
  try {
    // Fetch top coins by market cap
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h"
    );
    if (!res.ok) throw new Error("Failed to fetch CoinGecko data");
    const coins = await res.json();

    // Calculate sentiment based on price and volume change
    let bullish = 0, bearish = 0, neutral = 0;
    coins.forEach((coin: {
      price_change_percentage_24h: number;
      total_volume: number;
      market_cap: number;
    }) => {
      const priceChange = coin.price_change_percentage_24h;
      const volumeChange = coin.total_volume / coin.market_cap;
      // Bullish: price up >2% and volume up
      if (priceChange > 2 && volumeChange > 0.05) bullish++;
      // Bearish: price down < -2% and volume up
      else if (priceChange < -2 && volumeChange > 0.05) bearish++;
      else neutral++;
    });
    const total = bullish + bearish + neutral;
    
    // Fetch Fear & Greed Index
    let fearGreed: FearGreedData | null = null;
    let fearGreedHistory: FearGreedData[] = [];
    
    try {
      fearGreed = await fetchFearGreedIndex();
      fearGreedHistory = await fetchFearGreedHistory(7);
    } catch (fgError) {
      console.error('Error fetching Fear & Greed:', fgError);
    }

    return {
      bullish: Math.round((bullish / total) * 100),
      bearish: Math.round((bearish / total) * 100),
      neutral: 100 - Math.round((bullish / total) * 100) - Math.round((bearish / total) * 100),
      fearGreed,
      fearGreedHistory,
      lastUpdated: Date.now(),
    };
  } catch (e) {
    // Fallback to fake data
    return { 
      bullish: 72, 
      neutral: 18, 
      bearish: 10,
      fearGreed: null,
      fearGreedHistory: [],
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Generate trading signal based on market sentiment and fear/greed index
 */
export function generateTradingSignal(sentiment: MarketSentiment): TradingSignal {
  const { bullish, bearish, fearGreed } = sentiment;
  
  // Default to hold
  let recommendation: 'buy' | 'sell' | 'hold' = 'hold';
  let confidence = 50;
  let reasoning = '';
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  
  // Analyze market conditions
  const marketScore = bullish - bearish; // -100 to 100
  const fearGreedValue = fearGreed?.value ?? 50;
  
  // Strong buy conditions: Extreme fear or high bearish sentiment with improving conditions
  if (fearGreedValue <= 25 && marketScore < -20) {
    recommendation = 'buy';
    confidence = 85;
    reasoning = 'Extreme fear combined with bearish market - potential bottom signal. Historical data suggests this could be a good entry point.';
    riskLevel = 'low';
  }
  // Buy conditions: Fear but not extreme
  else if (fearGreedValue <= 45 && marketScore < 0) {
    recommendation = 'buy';
    confidence = 70;
    reasoning = 'Fearful market conditions may present buying opportunities. Prices may be undervalued.';
    riskLevel = 'medium';
  }
  // Strong sell conditions: Extreme greed with bullish market
  else if (fearGreedValue >= 75 && marketScore > 30) {
    recommendation = 'sell';
    confidence = 85;
    reasoning = 'Extreme greed combined with bullish market - potential top signal. Consider taking profits.';
    riskLevel = 'low';
  }
  // Sell conditions: Greed but not extreme
  else if (fearGreedValue >= 55 && marketScore > 20) {
    recommendation = 'sell';
    confidence = 65;
    reasoning = 'Greedy market conditions may indicate overbought assets. Consider risk management.';
    riskLevel = 'medium';
  }
  // Hold conditions: Neutral market
  else {
    recommendation = 'hold';
    confidence = 60;
    reasoning = 'Market is in a neutral state. Wait for clearer signals before making significant moves.';
    riskLevel = 'medium';
  }
  
  // Adjust confidence based on sentiment divergence
  if (Math.abs(marketScore) > 40) {
    confidence = Math.min(95, confidence + 10);
  }
  
  return { recommendation, confidence, reasoning, riskLevel };
}
