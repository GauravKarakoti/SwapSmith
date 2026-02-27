import axios from 'axios';
import logger from './logger';

export interface FearGreedData {
  value: number;
  value_classification: string;
  timestamp: number;
}

export interface MarketData {
  sentiment: {
    bullish: number;
    neutral: number;
    bearish: number;
  };
  fearGreed: FearGreedData | null;
  signal: {
    recommendation: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

/**
 * Fetch Fear & Greed Index from alternative.me API
 */
async function fetchFearGreedIndex(): Promise<FearGreedData | null> {
  try {
    const response = await axios.get('https://api.alternative.me/fng/?limit=1', {
      timeout: 5000,
    });
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      const item = response.data.data[0];
      return {
        value: parseInt(item.value),
        value_classification: item.value_classification,
        timestamp: parseInt(item.timestamp),
      };
    }
    return null;
  } catch (error) {
    logger.error('Error fetching Fear & Greed Index:', error);
    return null;
  }
}

/**
 * Fetch market sentiment from CoinGecko
 */
async function fetchMarketSentiment(): Promise<{ bullish: number; neutral: number; bearish: number }> {
  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h',
      { timeout: 10000 }
    );
    
    const coins = response.data;
    let bullish = 0, bearish = 0, neutral = 0;
    
    coins.forEach((coin: { price_change_percentage_24h: number; total_volume: number; market_cap: number }) => {
      const priceChange = coin.price_change_percentage_24h;
      const volumeChange = coin.total_volume / coin.market_cap;
      
      if (priceChange > 2 && volumeChange > 0.05) {
        bullish++;
      } else if (priceChange < -2 && volumeChange > 0.05) {
        bearish++;
      } else {
        neutral++;
      }
    });
    
    const total = bullish + bearish + neutral;
    return {
      bullish: Math.round((bullish / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      bearish: Math.round((bearish / total) * 100),
    };
  } catch (error) {
    logger.error('Error fetching market sentiment:', error);
    return { bullish: 50, neutral: 30, bearish: 20 };
  }
}

/**
 * Generate trading signal based on market data
 */
function generateSignal(sentiment: { bullish: number; bearish: number }, fearGreed: FearGreedData | null) {
  const marketScore = sentiment.bullish - sentiment.bearish;
  const fearGreedValue = fearGreed?.value ?? 50;
  
  let recommendation: 'buy' | 'sell' | 'hold' = 'hold';
  let confidence = 50;
  let reasoning = '';
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  
  if (fearGreedValue <= 25 && marketScore < -20) {
    recommendation = 'buy';
    confidence = 85;
    reasoning = 'Extreme fear with bearish market - potential bottom signal';
    riskLevel = 'low';
  } else if (fearGreedValue <= 45 && marketScore < 0) {
    recommendation = 'buy';
    confidence = 70;
    reasoning = 'Fearful conditions may present buying opportunities';
    riskLevel = 'medium';
  } else if (fearGreedValue >= 75 && marketScore > 30) {
    recommendation = 'sell';
    confidence = 85;
    reasoning = 'Extreme greed with bullish market - potential top signal';
    riskLevel = 'low';
  } else if (fearGreedValue >= 55 && marketScore > 20) {
    recommendation = 'sell';
    confidence = 65;
    reasoning = 'Greedy conditions may indicate overbought assets';
    riskLevel = 'medium';
  } else {
    recommendation = 'hold';
    confidence = 60;
    reasoning = 'Market is neutral - wait for clearer signals';
    riskLevel = 'medium';
  }
  
  return { recommendation, confidence, reasoning, riskLevel };
}

/**
 * Get comprehensive market data
 */
export async function getMarketData(): Promise<MarketData> {
  const [sentiment, fearGreed] = await Promise.all([
    fetchMarketSentiment(),
    fetchFearGreedIndex(),
  ]);
  
  const signal = generateSignal(sentiment, fearGreed);
  
  return {
    sentiment,
    fearGreed,
    signal,
  };
}

/**
 * Format market data for Telegram message
 */
export function formatMarketMessage(data: MarketData): string {
  const { sentiment, fearGreed, signal } = data;
  
  // Get emoji and color based on fear/greed
  let fgEmoji = '😐';
  if (fearGreed) {
    if (fearGreed.value <= 25) fgEmoji = '😱';
    else if (fearGreed.value <= 45) fgEmoji = '😰';
    else if (fearGreed.value >= 75) fgEmoji = '🤑';
    else if (fearGreed.value >= 55) fgEmoji = '😊';
  }
  
  // Get emoji based on signal
  const signalEmoji = signal.recommendation === 'buy' ? '⬆️' : signal.recommendation === 'sell' ? '⬇️' : '➡️';
  const signalColor = signal.recommendation === 'buy' ? '🟢' : signal.recommendation === 'sell' ? '🔴' : '🟡';
  
  const message = `📊 *Market Intelligence*\n\n` +
    `*Market Sentiment:*\n` +
    `🟢 Bullish: ${sentiment.bullish}%\n` +
    `🟡 Neutral: ${sentiment.neutral}%\n` +
    `🔴 Bearish: ${sentiment.bearish}%\n\n` +
    `*Fear & Greed Index:*\n` +
    `${fgEmoji} ${fearGreed ? fearGreed.value : 'N/A'} - ${fearGreed?.value_classification || 'Unknown'}\n\n` +
    `*AI Trading Signal:*\n` +
    `${signalEmoji} *${signal.recommendation.toUpperCase()}* ${signalColor}\n` +
    `Confidence: ${signal.confidence}%\n` +
    `Risk: ${signal.riskLevel.toUpperCase()}\n\n` +
    `_${signal.reasoning}_`;
  
  return message;
}
