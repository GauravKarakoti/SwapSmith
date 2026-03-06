/**
 * Bridge Configuration
 * Configuration for supported cross-chain bridge protocols
 * Supports: Across, Stargate, LayerZero, Wormhole
 */
import { SIDESHIFT_CONFIG } from './sideshift';

export interface BridgeConfig {
  name: string;
  displayName: string;
  apiBaseUrl: string;
  timeout: number;
  retryAttempts: number;
  supportedChains: string[];
  features: {
    instantExecution: boolean;
    refund: boolean;
    affiliate: boolean;
  };
  reliability: {
    score: number; // 0-100
    uptime: number; // percentage
  };
  avgExecutionTime: {
    min: number; // minutes
    max: number; // minutes
  };
}

export interface BridgeChainConfig {
  chainId: number;
  name: string;
  symbol: string;
  tokenAddress?: string;
  decimals: number;
  gasToken: string;
  explorer: string;
}

export const BRIDGE_CHAINS: Record<string, BridgeChainConfig> = {
  // Ethereum
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    gasToken: 'ETH',
    explorer: 'https://etherscan.io',
  },
  // Polygon
  polygon: {
    chainId: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    decimals: 18,
    gasToken: 'MATIC',
    explorer: 'https://polygonscan.com',
  },
  // Arbitrum
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    symbol: 'ETH',
    decimals: 18,
    gasToken: 'ETH',
    explorer: 'https://arbiscan.io',
  },
  // Optimism
  optimism: {
    chainId: 10,
    name: 'Optimism',
    symbol: 'ETH',
    decimals: 18,
    gasToken: 'ETH',
    explorer: 'https://optimistic.etherscan.io',
  },
  // Avalanche
  avalanche: {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    symbol: 'AVAX',
    decimals: 18,
    gasToken: 'AVAX',
    explorer: 'https://snowtrace.io',
  },
  // BSC
  bsc: {
    chainId: 56,
    name: 'BNB Chain',
    symbol: 'BNB',
    decimals: 18,
    gasToken: 'BNB',
    explorer: 'https://bscscan.com',
  },
  // Base
  base: {
    chainId: 8453,
    name: 'Base',
    symbol: 'ETH',
    decimals: 18,
    gasToken: 'ETH',
    explorer: 'https://basescan.org',
  },
  // Solana (Wormhole only)
  solana: {
    chainId: 101,
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9,
    gasToken: 'SOL',
    explorer: 'https://solscan.io',
  },
  // Fantom
  fantom: {
    chainId: 250,
    name: 'Fantom',
    symbol: 'FTM',
    decimals: 18,
    gasToken: 'FTM',
    explorer: 'https://ftmscan.com',
  },
  // Celo
  celo: {
    chainId: 42220,
    name: 'Celo',
    symbol: 'CELO',
    decimals: 18,
    gasToken: 'CELO',
    explorer: 'https://explorer.celo.org',
  },
};

// Bridge-specific configurations
export const BRIDGE_CONFIGS: Record<string, BridgeConfig> = {
  across: {
    name: 'across',
    displayName: 'Across Protocol',
    apiBaseUrl: process.env.ACROSS_API_URL || 'https://api.across.to',
    timeout: 10000,
    retryAttempts: 3,
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
    features: {
      instantExecution: true,
      refund: true,
      affiliate: true,
    },
    reliability: {
      score: 95,
      uptime: 99.9,
    },
    avgExecutionTime: {
      min: 2,
      max: 30,
    },
  },
  stargate: {
    name: 'stargate',
    displayName: 'Stargate',
    apiBaseUrl: process.env.STARGATE_API_URL || 'https://api.stargateprotocol.com',
    timeout: 15000,
    retryAttempts: 3,
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'base'],
    features: {
      instantExecution: true,
      refund: true,
      affiliate: true,
    },
    reliability: {
      score: 92,
      uptime: 99.5,
    },
    avgExecutionTime: {
      min: 5,
      max: 45,
    },
  },
  layerzero: {
    name: 'layerzero',
    displayName: 'LayerZero',
    apiBaseUrl: process.env.LAYERZERO_API_URL || 'https://api.layerzero.finance',
    timeout: 20000,
    retryAttempts: 2,
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'base', 'fantom', 'celo'],
    features: {
      instantExecution: false,
      refund: true,
      affiliate: true,
    },
    reliability: {
      score: 88,
      uptime: 99.0,
    },
    avgExecutionTime: {
      min: 10,
      max: 60,
    },
  },
  wormhole: {
    name: 'wormhole',
    displayName: 'Wormhole',
    apiBaseUrl: process.env.WORMHOLE_API_URL || 'https://api.wormhole.io',
    timeout: 15000,
    retryAttempts: 3,
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'solana', 'base', 'fantom', 'celo'],
    features: {
      instantExecution: true,
      refund: false,
      affiliate: true,
    },
    reliability: {
      score: 90,
      uptime: 98.5,
    },
    avgExecutionTime: {
      min: 5,
      max: 40,
    },
  },
  sideshift: {
    name: 'sideshift',
    displayName: 'SideShift.ai',
    apiBaseUrl: process.env.SIDESHIFT_API_URL || SIDESHIFT_CONFIG.BASE_URL,
    timeout: 15000,
    retryAttempts: 3,
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'base', 'solana', 'bitcoin', 'litecoin'],
    features: {
      instantExecution: false,
      refund: true,
      affiliate: true,
    },
    reliability: {
      score: 85,
      uptime: 97.0,
    },
    avgExecutionTime: {
      min: 10,
      max: 60,
    },
  },
};

// User preferences for bridge selection
export interface BridgePreferences {
  preferredBridges: string[];
  avoidBridges: string[];
  priority: 'speed' | 'cost' | 'reliability' | 'balanced';
  maxSlippage: number;
  instantOnly: boolean;
}

// Default preferences
export const DEFAULT_BRIDGE_PREFERENCES: BridgePreferences = {
  preferredBridges: [],
  avoidBridges: [],
  priority: 'balanced',
  maxSlippage: 0.5, // 0.5%
  instantOnly: false,
};

// Get bridge by name
export function getBridgeConfig(bridgeName: string): BridgeConfig | undefined {
  return BRIDGE_CONFIGS[bridgeName.toLowerCase()];
}

// Get chains supported by a specific bridge
export function getSupportedChains(bridgeName: string): string[] {
  const config = getBridgeConfig(bridgeName);
  return config?.supportedChains || [];
}

// Check if a bridge supports a specific chain
export function isChainSupported(bridgeName: string, chain: string): boolean {
  const config = getBridgeConfig(bridgeName);
  return config?.supportedChains.includes(chain.toLowerCase()) || false;
}

// Get chain configuration
export function getChainConfig(chainName: string): BridgeChainConfig | undefined {
  return BRIDGE_CHAINS[chainName.toLowerCase()];
}

// Get all available bridges for a route
export function getAvailableBridges(fromChain: string, toChain: string): string[] {
  return Object.keys(BRIDGE_CONFIGS).filter((bridge) =>
    isChainSupported(bridge, fromChain) && isChainSupported(bridge, toChain)
  );
}
