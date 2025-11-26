import axios from 'axios';

export async function getTopStablecoinYields(): Promise<string> {
  try {
    const response = await axios.get('https://yields.llama.fi/pools');
    const data = response.data.data;

    // Filter for stablecoins, high APY, major chains, and sufficient TVL
    const topPools = data
      .filter((p: any) => 
        ['USDC', 'USDT', 'DAI'].includes(p.symbol) && 
        p.tvlUsd > 1000000 && 
        ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'Avalanche'].includes(p.chain)
      )
      .sort((a: any, b: any) => b.apy - a.apy)
      .slice(0, 5);

    if (topPools.length === 0) throw new Error("No pools found");

    return topPools.map((p: any) => 
      `• ${p.symbol} on ${p.chain} via ${p.project}: **${p.apy.toFixed(2)}% APY**`
    ).join('\n');

  } catch (error) {
    console.error("Yield fetch error:", error);
    return "Could not fetch live yield data at the moment.";
  }
}