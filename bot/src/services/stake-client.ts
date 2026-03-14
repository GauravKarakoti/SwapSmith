import { 
  YieldPool, 
  YieldProtocol, 
  getProtocolInfo, 
  enrichPoolWithDepositAddress,
  YIELD_PROTOCOLS,
  findBestYieldPool
} from './yield-client';
import { createQuote, createOrder, getOrderStatus, SideShiftQuote } from './sideshift-client';
import logger from './logger';
import * as db from './database';

export interface ZapTransaction {
  swapOrderId: string;
  swapQuote: SideShiftQuote;
  stakePool: YieldPool;
  stakeTransactionData?: {
    to: string;
    value: string;
    data: string;
  };
  status: 'pending_swap' | 'swap_complete' | 'pending_stake' | 'completed' | 'failed';
}

export interface ZapQuote {
  fromAsset: string;
  fromNetwork: string;
  toAsset: string;
  toNetwork: string;
  fromAmount: string;
  expectedReceive: string;
  stakePool: YieldPool;
  estimatedApy: number;
  estimatedAnnualYield: string;
  depositAddress: string;
  protocolName: string;
  steps: ZapStep[];
}

export interface ZapStep {
  step: number;
  action: 'swap' | 'stake';
  description: string;
  status: 'pending' | 'ready' | 'completed' | 'failed';
}

export interface StakeOrder {
  id?: number;
  telegramId: number;
  sideshiftOrderId: string;
  quoteId: string;
  fromAsset: string;
  fromNetwork: string;
  fromAmount: number;
  swapToAsset: string;
  swapToNetwork: string;
  stakeAsset: string;
  stakeProtocol: string;
  stakeNetwork: string;
  settleAmount?: string;
  depositAddress: string;
  depositMemo?: string;
  stakeAddress?: string;
  stakeTxHash?: string;
  swapStatus: 'pending' | 'processing' | 'settled' | 'failed';
  stakeStatus: 'pending' | 'submitted' | 'confirmed' | 'failed';
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

/**
 * Get a zap quote for swapping and staking in one transaction
 * @param fromAsset - Source asset symbol (e.g., 'ETH', 'BTC')
 * @param fromNetwork - Source network (e.g., 'ethereum')
 * @param toAsset - Target asset for staking (e.g., 'USDC')
 * @param toNetwork - Target network for staking
 * @param amount - Amount to swap
 * @param stakeChain - Optional chain to stake on (defaults to toNetwork)
 * @param userIP - User IP address for API calls
 * @returns ZapQuote with all the details
 */
export async function getZapQuote(
  fromAsset: string,
  fromNetwork: string,
  toAsset: string,
  toNetwork: string,
  amount: number,
  userIP: string,
  stakeChain?: string
): Promise<ZapQuote> {
  // Get swap quote first
  const swapQuote = await createQuote(
    fromAsset,
    fromNetwork,
    toAsset,
    toNetwork,
    amount,
    userIP
  );

  // Find the best yield pool for the target asset
  const stakeNetwork = stakeChain || toNetwork;
  const stakePool = await findBestYieldPool(toAsset, stakeNetwork);
  
  if (!stakePool) {
    throw new Error(`No yield pool found for ${toAsset} on ${stakeNetwork}`);
  }

  // Enrich the pool with deposit address
  const enrichedPool = enrichPoolWithDepositAddress(stakePool);
  const protocol = getProtocolInfo(enrichedPool);

  if (!enrichedPool.depositAddress) {
    throw new Error(`No deposit address found for ${toAsset} on ${stakeNetwork}`);
  }

  // Validate that the deposit address is not a placeholder
  const { isPlaceholderAddress } = await import('./yield-client');
  if (isPlaceholderAddress(enrichedPool.depositAddress)) {
    throw new Error(
      `Protocol ${enrichedPool.project} on ${stakeNetwork} is not yet supported. ` +
      `Please try a different protocol or network.`
    );
  }

  // Calculate estimated yield
  const amountNum = parseFloat(swapQuote.settleAmount || '0');
  const estimatedAnnualYield = (amountNum * enrichedPool.apy / 100).toFixed(2);

  return {
    fromAsset,
    fromNetwork,
    toAsset,
    toNetwork,
    fromAmount: amount.toString(),
    expectedReceive: swapQuote.settleAmount || '0',
    stakePool: enrichedPool,
    estimatedApy: enrichedPool.apy,
    estimatedAnnualYield,
    depositAddress: enrichedPool.depositAddress,
    protocolName: protocol?.name || enrichedPool.project,
    steps: [
      {
        step: 1,
        action: 'swap',
        description: `Swap ${amount} ${fromAsset} to ${toAsset}`,
        status: 'ready'
      },
      {
        step: 2,
        action: 'stake',
        description: `Deposit ${toAsset} to ${protocol?.name || enrichedPool.project} for ${enrichedPool.apy.toFixed(2)}% APY`,
        status: 'pending'
      }
    ]
  };
}

/**
 * Create a zap transaction (swap + stake)
 * @param zapQuote - The zap quote to execute
 * @param settleAddress - User's wallet address to receive staking tokens
 * @param userIP - User IP address
 * @returns ZapTransaction with order details
 */
export async function createZapTransaction(
  zapQuote: ZapQuote,
  settleAddress: string,
  userIP: string
): Promise<ZapTransaction> {
  // First, we need to create a proper SideShift quote
  const swapQuote = await createQuote(
    zapQuote.fromAsset,
    zapQuote.fromNetwork,
    zapQuote.toAsset,
    zapQuote.toNetwork,
    parseFloat(zapQuote.fromAmount),
    userIP
  );

  if (swapQuote.error) {
    throw new Error(`Quote error: ${swapQuote.error.message}`);
  }

  // Create the swap order via SideShift
  // User receives the swapped tokens to their address
  // They will need to manually stake or we can provide instructions
  const swapOrder = await createOrder(
    swapQuote.id,
    settleAddress, // User receives the swapped tokens
    settleAddress, // Refund to same address
    userIP
  );

  if (!swapOrder.id) {
    throw new Error('Failed to create swap order');
  }

  return {
    swapOrderId: swapOrder.id,
    swapQuote: swapQuote,
    stakePool: zapQuote.stakePool,
    stakeTransactionData: {
      to: zapQuote.depositAddress,
      value: '0',
      data: '0x' // Would be actual calldata for the stake
    },
    status: 'pending_swap'
  };
}

/**
 * Get the status of a zap transaction
 * @param zapTx - The zap transaction to check
 * @returns Updated ZapTransaction with current status
 */
export async function getZapTransactionStatus(zapTx: ZapTransaction): Promise<ZapTransaction> {
  try {
    const swapStatus = await getOrderStatus(zapTx.swapOrderId);
    
    if (swapStatus.status === 'settled') {
      return {
        ...zapTx,
        status: 'swap_complete'
      };
    } else if (swapStatus.status === 'failed') {
      return {
        ...zapTx,
        status: 'failed'
      };
    }
    
    return zapTx;
  } catch (error) {
    logger.error('Error getting zap transaction status:', error);
    return zapTx;
  }
}

/**
 * Format a zap quote for display to the user
 * @param zapQuote - The zap quote to format
 * @returns Formatted message string
 */
export function formatZapQuote(zapQuote: ZapQuote): string {
  return `⚡ *Swap & Stake Quote*\n\n` +
    `*Swap:*\n` +
    `  From: ${zapQuote.fromAmount} ${zapQuote.fromAsset} (${zapQuote.fromNetwork})\n` +
    `  To: ~${zapQuote.expectedReceive} ${zapQuote.toAsset} (${zapQuote.toNetwork})\n\n` +
    `*Stake:*\n` +
    `  Protocol: ${zapQuote.protocolName}\n` +
    `  APY: *${zapQuote.estimatedApy.toFixed(2)}%*\n` +
    `  Est. Annual Yield: $${zapQuote.estimatedAnnualYield}\n\n` +
    `*Steps:*\n` +
    `1. 🔄 Swap ${zapQuote.fromAsset} → ${zapQuote.toAsset}\n` +
    `2. 📈 Deposit to ${zapQuote.protocolName}\n\n` +
    `Ready to proceed?`;
}

/**
 * Check if a stake order can be completed (swap has settled)
 * @param stakeOrder - The stake order to check
 * @returns True if stake can be executed
 */
export async function canExecuteStake(stakeOrder: StakeOrder): Promise<boolean> {
  if (stakeOrder.swapStatus !== 'settled') {
    return false;
  }
  
  try {
    const swapStatus = await getOrderStatus(stakeOrder.sideshiftOrderId);
    return swapStatus.status === 'settled';
  } catch (error) {
    logger.error('Error checking stake eligibility:', error);
    return false;
  }
}

/**
 * Get available protocols for a specific chain
 * @param chain - The chain to filter by
 * @returns Array of available protocols on that chain
 */
export function getProtocolsByChain(chain: string): YieldProtocol[] {
  return YIELD_PROTOCOLS.filter(
    p => p.chain.toLowerCase() === chain.toLowerCase()
  );
}

/**
 * Get the best available protocol for a specific asset and chain
 * @param symbol - Asset symbol (e.g., 'USDC')
 * @param chain - Chain name
 * @returns Best protocol or null
 */
export function getBestProtocol(_symbol: string, chain: string): YieldProtocol | null {
  const protocols = getProtocolsByChain(chain);
  
  if (protocols.length === 0) return null;
  
  // For now, return the first one - could be enhanced to sort by TVL or APY
  return protocols[0] || null;
}

/**
 * Build a staking transaction for a given protocol
 * @param protocol - Protocol name (e.g., 'Lido', 'Aave')
 * @param amount - Amount to stake (in wei)
 * @param userAddress - User's wallet address
 * @param stakeAddress - Address to stake from
 * @returns Transaction data {to, data, value}
 */
export async function buildStakingTransaction(
  protocol: string,
  amount: string,
  userAddress: string,
  stakeAddress: string
): Promise<{ to: string; data: string; value: string }> {
  const protocolLower = protocol.toLowerCase();

  if (protocolLower.includes('lido')) {
    // Lido staking: transfer stETH or provide delegation
    // For simplicity, we return the transaction data format
    // In production, you'd need ethers.js to encode properly
    return {
      to: stakeAddress,
      data: '0xa1903eab' + userAddress.slice(2).padStart(64, '0'), // submit() call with referral
      value: amount
    };
  }

  if (protocolLower.includes('aave')) {
    // Aave deposit: approve or direct transfer to aToken
    return {
      to: stakeAddress,
      data: '0xa0712d68' + amount.slice(2).padStart(64, '0'), // approve() or deposit() pattern
      value: '0'
    };
  }

  if (protocolLower.includes('compound')) {
    // Compound: transfer to cToken contract
    return {
      to: stakeAddress,
      data: '0x', // Will be constructed with proper encoding
      value: amount
    };
  }

  if (protocolLower.includes('yearn')) {
    // Yearn: deposit to vault
    return {
      to: stakeAddress,
      data: '0x', // Deposit signature
      value: '0'
    };
  }

  // Default: transfer to stake address
  return {
    to: stakeAddress,
    data: '0x',
    value: amount
  };
}

/**
 * Format staking instructions for the user
 * @param stakeOrder - The stake order
 * @param settleAmount - The amount received from the swap
 * @returns Formatted instruction message
 */
export function formatStakingInstructions(
  stakeOrder: StakeOrder,
  settleAmount: string
): string {
  return (
    `📈 *Staking Instructions*\n\n` +
    `*Order:* \`${stakeOrder.sideshiftOrderId}\`\n` +
    `*Amount to Stake:* ${settleAmount} ${stakeOrder.stakeAsset}\n` +
    `*Protocol:* ${stakeOrder.stakeProtocol}\n` +
    `*Network:* ${stakeOrder.stakeNetwork}\n\n` +
    `🎯 *Steps to Complete:*\n` +
    `1. Open your wallet\n` +
    `2. Go to ${stakeOrder.stakeProtocol} platform\n` +
    `3. Deposit: ${settleAmount} ${stakeOrder.stakeAsset}\n` +
    `4. Confirm the transaction\n\n` +
    `💡 *Wallet Address for Staking:*\n` +
    `\`${stakeOrder.stakeAddress}\`\n\n` +
    `✨ You'll earn ${stakeOrder.stakeAsset} rewards automatically!`
  );
}

/**
 * Execute a staking transaction (this would be called by a relayer or user)
 * @param stakeOrder - The stake order to execute
 * @param txHash - Optional transaction hash if already submitted
 * @returns Updated stake order status
 */
export async function executeStakingTransaction(
  stakeOrder: StakeOrder,
  txHash?: string
): Promise<StakeOrder | null> {
  try {
    logger.info(
      `[StakeClient] Executing staking transaction for order ${stakeOrder.sideshiftOrderId}`
    );

    // If we have a tx hash, just track it
    if (txHash) {
      await db.updateStakeOrderStakeStatus(
        stakeOrder.sideshiftOrderId,
        'submitted',
        txHash
      );
      return { ...stakeOrder, stakeTxHash: txHash, stakeStatus: 'submitted' };
    }

    // Otherwise, in a real implementation, you would:
    // 1. Check if we have custody of the swapped tokens
    // 2. Build the staking transaction
    // 3. Sign and submit the transaction
    // 4. Track its status

    // For now, we mark it as ready for the user to complete
    await db.updateStakeOrderStakeStatus(
      stakeOrder.sideshiftOrderId,
      'pending'
    );

    return stakeOrder;
  } catch (error) {
    logger.error(
      `[StakeClient] Error executing staking transaction: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
    throw error;
  }
}

/**
 * Check if we can auto-stake (has deployment contract, user opted in, etc.)
 * @param protocol - Protocol name
 * @param network - Network name
 * @returns Whether auto-staking is available
 */
export function isAutoStakingAvailable(protocol: string, network: string): boolean {
  // Check if we have a relayer or auto-staking contract deployed
  // For now, return false - auto-staking requires additional infrastructure
  const autoStakingProtocols = ['lido', 'rocket-pool'];
  const supportedNetworks = ['ethereum', 'mainnet'];

  return (
    autoStakingProtocols.some(p => protocol.toLowerCase().includes(p)) &&
    supportedNetworks.includes(network.toLowerCase())
  );
}

/**
 * Get transaction fee estimate for staking
 * @param protocol - Protocol name
 * @param amount - Amount to stake
 * @returns Estimated fee in USD
 */
export function getEstimatedStakingFee(protocol: string, _amount: string): number {
  // Base fee estimation (in real implementation, would use gas APIs)
  const baseFee = 5; // $5 base

  // Protocol specific multipliers
  if (protocol.toLowerCase().includes('lido')) {
    return baseFee + 2; // Lido is simple
  }
  if (protocol.toLowerCase().includes('aave')) {
    return baseFee + 5; // Aave might have approval step
  }
  if (protocol.toLowerCase().includes('compound')) {
    return baseFee + 3;
  }

  return baseFee;
}
