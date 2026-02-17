export const yieldConfig = {
  chains: ["Ethereum", "Polygon", "Arbitrum", "Optimism", "Base", "Avalanche"],
  assets: ["USDC", "USDT", "DAI"],
} as const;

export type Chain = typeof yieldConfig.chains[number];
export type Asset = typeof yieldConfig.assets[number];
