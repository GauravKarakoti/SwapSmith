export async function fetchMarketSentiment() {
  try {
    const res = await fetch("/api/market-sentiment");
    if (!res.ok) throw new Error("Failed to fetch sentiment");
    return await res.json();
  } catch {
    return { bullish: 72, neutral: 18, bearish: 10 };
  }
}