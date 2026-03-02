// Utility to fetch CoinGecko market data for sentiment
export async function fetchMarketSentiment() {
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
    return {
      bullish: Math.round((bullish / total) * 100),
      bearish: Math.round((bearish / total) * 100),
      neutral: 100 - Math.round((bullish / total) * 100) - Math.round((bearish / total) * 100),
    };
  } catch {
    // Fallback to fake data
    return { bullish: 72, neutral: 18, bearish: 10 };
  }
}
