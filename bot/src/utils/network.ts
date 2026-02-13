export function inferNetwork(asset: string): string {
  const map: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'USDT': 'ethereum',
    'USDC': 'ethereum',
    'DAI': 'ethereum',
    'WBTC': 'ethereum',
    'BNB': 'bsc',
    'AVAX': 'avalanche',
    'MATIC': 'polygon',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'BASE': 'base'
  };
  return map[asset?.toUpperCase()] || 'ethereum';
}
