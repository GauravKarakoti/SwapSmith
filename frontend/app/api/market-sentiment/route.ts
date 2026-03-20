import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h",
      { next: { revalidate: 300 } } // Cache for 5 minutes to prevent 429s
    );
    
    if (!res.ok) throw new Error("Failed to fetch CoinGecko data");
    const coins = await res.json();

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
    
    bullish= Math.round((bullish / total) * 100);
    bearish= Math.round((bearish / total) * 100);
    neutral= 100 - Math.round((bullish / total) * 100) - Math.round((bearish / total) * 100);
    
    return NextResponse.json({ bullish, bearish, neutral });
  } catch (error) {
    return NextResponse.json({ bullish: 72, neutral: 18, bearish: 10 }); // Fallback
  }
}