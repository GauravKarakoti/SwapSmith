import axios from 'axios';
import logger from './logger';
import { YieldPool, getTopYieldPools } from './yield-client';

export interface StakingProtocol {
  name: string;
  chain: string;
  supportedAssets: string[];
  apy: number;
  tvlUsd: number;
  contractAddress?: string;
  stakingFunction?: string;
}

export interface StakeOrderRequest {
  fromAsset: string;
  fromChain: string;
  toAsset: string;
  toChain: string;
  amount: number;
  stakingProtocol?: string;
  stakerAddress: string;
}

export interface StakeOrderResponse {
  success: boolean;
  orderId?: string;
  quoteId?: string;
  error?: string;
  estimatedApy?: number;
  stakingProtocol?: string;
  transactionData?: {
    to: string;
    value: string;
    data: string;
  };
}

// Supported staking protocols configuration
const SUPPORTED_PROTOCOLS: Record<string, StakingProtocol> = {
  'aave': {
    name: 'Aave',
    chain: 'ethereum',
    supportedAssets: ['USDC', 'USDT', 'DAI', 'ETH', 'WBTC'],
    apy: 0,
    tvlUsd: 0,
  },
  'compound': {
    name: 'Compound',
    chain: 'ethereum',
    supportedAssets: ['USDC', 'USDT', 'DAI', 'ETH', 'WBTC', 'COMP'],
    apy: 0,
    tvlUsd: 0,
  },
  'lido': {
    name: 'Lido',
    chain: 'ethereum',
    supportedAssets: ['ETH', 'stETH'],
    apy: 0,
    tvlUsd: 0,
  },
  'rocketpool': {
    name: 'Rocket Pool',
    chain: 'ethereum',
    supportedAssets: ['ETH', 'rETH'],
    apy: 0,
    tvlUsd: 0,
  },
  'curve': {
    name: 'Curve',
    chain: 'ethereum',
    supportedAssets: ['USDC', 'USDT', 'DAI', 'ETH', 'WBTC'],
    apy: 0,
    tvlUsd: 0,
  },
  'convex': {
    name: 'Convex',
    chain: 'ethereum',
    supportedAssets: ['USDC', 'USDT', 'DAI', 'CRV', 'CVX'],
    apy: 0,
    tvlUsd: 0,
  },
};

/**
 * Find the best staking protocol for a given asset
 */
export async function findBestStakingProtocol(
  asset: string,
  chain: string = 'ethereum',
  preferredProtocol?: string
): Promise<StakingProtocol | null> {
  try {
    // If a specific protocol is requested, check if it supports the asset
    if (preferredProtocol) {
      const protocolKey = preferredProtocol.toLowerCase();
      const protocol = SUPPORTED_PROTOCOLS[protocolKey];
      
      if (protocol && protocol.supportedAssets.includes(asset.toUpperCase())) {
        // Get current APY from DefiLlama
        const pools = await getTopYieldPools();
        const pool = pools.find(p => 
          p.project.toLowerCase() === protocolKey &&
          p.symbol.toUpperCase() === asset.toUpperCase() &&
          p.chain.toLowerCase() === chain.toLowerCase()
        );
        
        if (pool) {
          return {
            ...protocol,
            apy: pool.apy,
            tvlUsd: pool.tvlUsd,
          };
        }
        
        return protocol;
      }
    }

    // Find best protocol from available yield pools
    const pools = await getTopYieldPools();
    const relevantPools = pools.filter(p => 
      p.symbol.toUpperCase() === asset.toUpperCase() &&
      p.chain.toLowerCase() === chain.toLowerCase()
    );

    if (relevantPools.length === 0) {
      return null;
    }

    // Sort by APY and return the best
    const bestPool = relevantPools.sort((a, b) => b.apy - a.apy)[0];
    
    return {
      name: bestPool.project,
      chain: bestPool.chain,
      supportedAssets: [asset.toUpperCase()],
      apy: bestPool.apy,
      tvlUsd: bestPool.tvlUsd,
    };
  } catch (error) {
    logger.error('Error finding best staking protocol:', error);
    return null;
  }
}

/**
 * Create a swap and stake order
 */
export async function createSwapAndStakeOrder(
  request: StakeOrderRequest
): Promise<StakeOrderResponse> {
  try {
    // Find the best staking protocol for the target asset
    const protocol = await findBestStakingProtocol(
      request.toAsset,
      request.toChain,
      request.stakingProtocol
    );

    if (!protocol) {
      return {
        success: false,
        error: `No staking protocol found for ${request.toAsset} on ${request.toChain}`,
      };
    }

    // Generate a unique order ID
    const orderId = `stake-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Created swap and stake order:', {
      orderId,
      fromAsset: request.fromAsset,
      toAsset: request.toAsset,
      protocol: protocol.name,
      apy: protocol.apy,
    });

    return {
      success: true,
      orderId,
      quoteId: `quote-${orderId}`,
      estimatedApy: protocol.apy,
      stakingProtocol: protocol.name,
    };
  } catch (error) {
    logger.error('Error creating swap and stake order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get staking transaction data for executing the stake
 */
export async function getStakingTransactionData(
  protocol: string,
  asset: string,
  amount: string,
  stakerAddress: string
): Promise<{ to: string; data: string; value: string } | null> {
  try {
    // This would integrate with actual staking contract ABIs
    // For now, return mock data structure
    const protocolKey = protocol.toLowerCase();
    
    // Mock contract addresses - in production these would come from configuration
    const contractAddresses: Record<string, string> = {
      'aave': '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
      'compound': '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
      'lido': '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      'rocketpool': '0x0d8D8f32F5E83A4f511F5D4edFfF20e1b3f0C7e1',
    };

    const contractAddress = contractAddresses[protocolKey];
    
    if (!contractAddress) {
      return null;
    }

    // Mock transaction data - in production this would be encoded using the staking ABI
    return {
      to: contractAddress,
      data: '0x', // Would be actual encoded function call
      value: '0',
    };
  } catch (error) {
    logger.error('Error getting staking transaction data:', error);
    return null;
  }
}

/**
 * Get supported staking protocols for an asset
 */
export function getSupportedProtocolsForAsset(asset: string): string[] {
  const protocols: string[] = [];
  
  for (const [key, protocol] of Object.entries(SUPPORTED_PROTOCOLS)) {
    if (protocol.supportedAssets.includes(asset.toUpperCase())) {
      protocols.push(protocol.name);
    }
  }
  
  return protocols;
}

/**
 * Format staking information for user display
 */
export function formatStakingInfo(protocol: StakingProtocol, amount: number): string {
  const annualYield = (amount * protocol.apy) / 100;
  
  return `📊 *Staking Information*\n\n` +
    `Protocol: ${protocol.name}\n` +
    `Asset: ${protocol.supportedAssets[0]}\n` +
    `APY: ${protocol.apy.toFixed(2)}%\n` +
    `TVL: $${protocol.tvlUsd.toLocaleString()}\n\n` +
    `*Estimated Annual Yield:* $${annualYield.toFixed(2)} on $${amount}`;
}
