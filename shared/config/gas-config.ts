// Gas Fee Optimization Configuration
// This file contains configuration for gas estimation services and gas tokens

export const GAS_CONFIG = {
  // Cache settings
  CACHE_TTL_SECONDS: 30, // Gas price cache time-to-live
  HISTORY_CACHE_HOURS: 24, // How long to keep gas price history
  
  // Gas price thresholds (in gwei)
  GAS_PRICE_THRESHOLDS: {
    ethereum: {
      low: 20,
      medium: 50,
      high: 100,
      urgent: 200,
    },
    polygon: {
      low: 50,
      medium: 100,
      high: 300,
      urgent: 500,
    },
    bsc: {
      low: 5,
      medium: 10,
      high: 20,
      urgent: 50,
    },
    arbitrum: {
      low: 0.1,
      medium: 0.5,
      high: 1,
      urgent: 2,
    },
    optimism: {
      low: 0.001,
      medium: 0.01,
      high: 0.1,
      urgent: 0.5,
    },
  },
  
  // API endpoints
  APIS: {
    ETH_GAS_STATION: {
      BASE_URL: 'https://ethgasstation.info/api',
      ENDPOINTS: {
        GAS_PRICE: '/ethgasAPI.json',
        GAS_PRICE_PREDICTION: '/predictTable.json',
      },
      API_KEY_HEADER: 'X-API-KEY',
    },
    GELATO: {
      BASE_URL: 'https://relay.gelato.digital',
      ENDPOINTS: {
        GAS_PRICE: '/oracles',
        RELAY: '/relays',
      },
    },
    ETHEREUM_RPC: {
      // Standard Ethereum JSON-RPC methods for gas estimation
      METHODS: {
        GAS_PRICE: 'eth_gasPrice',
        FEE_HISTORY: 'eth_feeHistory',
        MAX_PRIORITY_FEE: 'eth_maxPriorityFeePerGas',
      },
    },
  },
  
  // Chain configurations
  CHAINS: {
    ethereum: {
      id: 1,
      name: 'Ethereum',
      nativeCurrency: 'ETH',
      supportsEIP1559: true,
      blockTimeSeconds: 12,
      defaultGasLimit: 21000,
      maxGasLimit: 3000000,
    },
    polygon: {
      id: 137,
      name: 'Polygon',
      nativeCurrency: 'MATIC',
      supportsEIP1559: true,
      blockTimeSeconds: 2,
      defaultGasLimit: 21000,
      maxGasLimit: 30000000,
    },
    bsc: {
      id: 56,
      name: 'BSC',
      nativeCurrency: 'BNB',
      supportsEIP1559: false,
      blockTimeSeconds: 3,
      defaultGasLimit: 21000,
      maxGasLimit: 30000000,
    },
    arbitrum: {
      id: 42161,
      name: 'Arbitrum',
      nativeCurrency: 'ETH',
      supportsEIP1559: true,
      blockTimeSeconds: 0.25,
      defaultGasLimit: 21000,
      maxGasLimit: 30000000,
    },
    optimism: {
      id: 10,
      name: 'Optimism',
      nativeCurrency: 'ETH',
      supportsEIP1559: true,
      blockTimeSeconds: 2,
      defaultGasLimit: 21000,
      maxGasLimit: 30000000,
    },
    base: {
      id: 8453,
      name: 'Base',
      nativeCurrency: 'ETH',
      supportsEIP1559: true,
      blockTimeSeconds: 2,
      defaultGasLimit: 21000,
      maxGasLimit: 30000000,
    },
  },
  
  // Gas token configurations
  GAS_TOKENS: {
    CHI: {
      symbol: 'CHI',
      name: 'Chi Gastoken',
      discountPercent: 42,
      supportedChains: ['ethereum'],
      contractAddresses: {
        ethereum: '0x0000000000004946c0e9F43F4Dee607b0eF1fA1c',
      },
      abi: [
        'function mint(uint256 value) external',
        'function free(uint256 value) external returns (uint256 freed)',
        'function freeUpTo(uint256 value) external returns (uint256 freed)',
        'function balanceOf(address account) external view returns (uint256)',
        'function totalMinted() external view returns (uint256)',
        'function totalBurned() external view returns (uint256)',
      ],
    },
    GST: {
      symbol: 'GST',
      name: 'Gas Station Token',
      discountPercent: 35,
      supportedChains: ['ethereum', 'polygon', 'bsc'],
      contractAddresses: {
        ethereum: '0x0000000000000000000000000000000000000000',
        polygon: '0x0000000000000000000000000000000000000000',
        bsc: '0x0000000000000000000000000000000000000000',
      },
      abi: [
        'function mint(uint256 amount) external',
        'function burn(uint256 amount) external',
        'function balanceOf(address account) external view returns (uint256)',
      ],
    },
  },
  
  // Batching configuration
  BATCHING: {
    MAX_BATCH_SIZE: 10, // Maximum transactions per batch
    MIN_BATCH_WAIT_MINUTES: 5, // Minimum time to wait before executing batch
    MAX_BATCH_WAIT_MINUTES: 60, // Maximum time to wait before forcing execution
    GAS_SAVINGS_PERCENT: 15, // Estimated gas savings from batching
  },
  
  // Optimization settings
  OPTIMIZATION: {
    AUTO_OPTIMIZE_DEFAULT: true,
    DEFAULT_PRIORITY_LEVEL: 'medium',
    GAS_PRICE_PREDICTION_HOURS: 1, // How far ahead to predict gas prices
    MIN_SAVINGS_PERCENT: 5, // Minimum savings % to suggest optimization
    NOTIFICATION_COOLDOWN_MINUTES: 30, // Minimum time between gas notifications
  },
};

// Priority level configurations
export const PRIORITY_LEVELS = {
  low: {
    label: 'Low',
    description: 'Save money, wait longer',
    multiplier: 0.8,
    maxWaitMinutes: 30,
  },
  medium: {
    label: 'Medium',
    description: 'Balanced speed and cost',
    multiplier: 1.0,
    maxWaitMinutes: 10,
  },
  high: {
    label: 'High',
    description: 'Fast execution',
    multiplier: 1.2,
    maxWaitMinutes: 2,
  },
  urgent: {
    label: 'Urgent',
    description: 'Immediate execution',
    multiplier: 1.5,
    maxWaitMinutes: 0,
  },
};

// Gas price confidence levels
export const CONFIDENCE_LEVELS = {
  99: { label: 'Very High', color: '#22c55e' },
  95: { label: 'High', color: '#84cc16' },
  90: { label: 'Good', color: '#eab308' },
  80: { label: 'Medium', color: '#f97316' },
  70: { label: 'Low', color: '#ef4444' },
};

// Helper functions
export function getChainConfig(chain: string) {
  return GAS_CONFIG.CHAINS[chain as keyof typeof GAS_CONFIG.CHAINS];
}

export function getGasTokenConfig(symbol: string) {
  return GAS_CONFIG.GAS_TOKENS[symbol as keyof typeof GAS_CONFIG.GAS_TOKENS];
}

export function getPriorityConfig(level: string) {
  return PRIORITY_LEVELS[level as keyof typeof PRIORITY_LEVELS] || PRIORITY_LEVELS.medium;
}

export function isEIP1559Supported(chain: string): boolean {
  const config = getChainConfig(chain);
  return config?.supportsEIP1559 ?? false;
}

export function calculateGasSavings(
  originalGas: number,
  optimizedGas: number,
  gasTokenDiscount: number = 0
): { saved: number; percent: number } {
  const baseSavings = originalGas - optimizedGas;
  const tokenSavings = optimizedGas * (gasTokenDiscount / 100);
  const totalSavings = baseSavings + tokenSavings;
  const percent = (totalSavings / originalGas) * 100;
  
  return {
    saved: Math.max(0, totalSavings),
    percent: Math.max(0, percent),
  };
}
