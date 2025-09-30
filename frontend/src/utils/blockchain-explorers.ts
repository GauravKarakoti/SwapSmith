export interface ExplorerConfig {
  baseUrl: string;
  addressPath: string;
  txPath: string;
  name: string;
}

export const BLOCKCHAIN_EXPLORERS: { [key: string]: ExplorerConfig } = {
  ethereum: {
    baseUrl: 'https://etherscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Etherscan'
  },
  bitcoin: {
    baseUrl: 'https://blockchain.com',
    addressPath: '/explorer/addresses',
    txPath: '/explorer/transactions',
    name: 'Blockchain.com Explorer'
  },
  polygon: {
    baseUrl: 'https://polygonscan.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Polygonscan'
  },
  arbitrum: {
    baseUrl: 'https://arbiscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Arbiscan'
  },
  avalanche: {
    baseUrl: 'https://snowtrace.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Snowtrace'
  },
  optimism: {
    baseUrl: 'https://optimistic.etherscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Optimistic Etherscan'
  },
  bsc: {
    baseUrl: 'https://bscscan.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'BscScan'
  },
  base: {
    baseUrl: 'https://basescan.org',
    addressPath: '/address',
    txPath: '/tx',
    name: 'BaseScan'
  },
  solana: {
    baseUrl: 'https://solscan.io',
    addressPath: '/account',
    txPath: '/tx',
    name: 'Solscan'
  }
}

export const getExplorerUrl = (
  network: string, 
  type: 'address' | 'transaction' = 'address',
  identifier: string
): string | null => {
  const explorer = BLOCKCHAIN_EXPLORERS[network.toLowerCase()]
  if (!explorer) return null

  const path = type === 'address' ? explorer.addressPath : explorer.txPath
  return `${explorer.baseUrl}${path}/${identifier}`
}

export const getNetworkDisplayName = (network: string): string => {
  return BLOCKCHAIN_EXPLORERS[network.toLowerCase()]?.name || network
}