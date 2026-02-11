import axios from 'axios';

// ✅ Interface definition for yield pool data
interface YieldPool {
  symbol: string;
  tvlUsd: number;
  chain: string;
  apy: number;
  project: string;
}

export async function getTopStablecoinYields(): Promise<string> {
  try {
    const response = await axios.get('https://yields.llama.fi/pools');
    // ✅ FIXED: Properly typed the response data
    const data: YieldPool[] = response.data.data;

    // Filter for stablecoins, high APY, major chains, and sufficient TVL
    // ✅ FIXED: Removed all `any` types - TypeScript now infers from YieldPool
    const topPools = data
      .filter((p: { symbol: string; tvlUsd: number; chain: string }) => 
        ['USDC', 'USDT', 'DAI'].includes(p.symbol) && 
        p.tvlUsd > 1000000 && 
        ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'Avalanche'].includes(p.chain)
      )
      .sort((a: { apy: number }, b: { apy: number }) => b.apy - a.apy)
      .slice(0, 5);

    if (topPools.length === 0) throw new Error("No pools found");

    return topPools.map((p: { symbol: string; chain: string; project: string; apy: number }) => 
      `• ${p.symbol} on ${p.chain} via ${p.project}: **${p.apy.toFixed(2)}% APY**`
    ).join('\n');

  } catch (error: unknown) {
    const err = error as Error;
    console.error("Yield fetch error:", err);
    return "Could not fetch live yield data at the moment.";
  }
}