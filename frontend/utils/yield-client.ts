import axios from 'axios';
import { yieldConfig } from '@/config/yield.config';

export async function getTopStablecoinYields(): Promise<string> {
  try {
    const response = await axios.get('https://yields.llama.fi/pools');
    const data = response.data.data;
    const allowedAssets = new Set<string>(yieldConfig.assets);
    const allowedChains = new Set<string>(yieldConfig.chains);

    // Filter for stablecoins, high APY, major chains, and sufficient TVL
    const topPools = data
      .filter((p: { symbol: string; tvlUsd: number; chain: string }) => 
        allowedAssets.has(p.symbol) && 
        p.tvlUsd > 1000000 && 
        allowedChains.has(p.chain)
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
