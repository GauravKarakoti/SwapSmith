/**
 * Base Bridge Adapter
 * Abstract base class for all bridge protocol adapters
 */

import { BridgeConfig, BridgePreferences } from '../../config/bridge-config';

export interface BridgeQuote {
  bridge: string;
  displayName: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  gasEstimate: string;
  gasFee: string;
  bridgeFee: string;
  totalFee: string;
  estimatedTime: {
    min: number;
    max: number;
  };
  depositAddress?: string;
  memo?: string;
  txData?: string;
  allowanceTarget?: string;
  route?: string[];
  instant: boolean;
  confidence: number;
  expiresAt?: string;
}

export interface BridgeOrder {
  orderId: string;
  depositAddress: string;
  depositAmount: string;
  depositToken: string;
  depositChain: string;
  receiveAmount: string;
  receiveToken: string;
  receiveChain: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  txHash?: string;
  memo?: string;
  expiry?: string;
}

export interface BridgeQuoteRequest {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  userAddress?: string;
  slippage?: number;
}

export interface BridgeOrderRequest {
  quote: BridgeQuote;
  receiveAddress: string;
  refundAddress: string;
  userIP?: string;
}

export abstract class BaseBridgeAdapter {
  protected config: BridgeConfig;
  protected name: string;

  constructor(bridgeName: string, config: BridgeConfig) {
    this.name = bridgeName;
    this.config = config;
  }

  /**
   * Get bridge name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get display name
   */
  getDisplayName(): string {
    return this.config.displayName;
  }

  /**
   * Check if bridge supports a specific chain
   */
  supportsChain(chain: string): boolean {
    return this.config.supportedChains.includes(chain.toLowerCase());
  }

  /**
   * Check if bridge supports a route
   */
  supportsRoute(fromChain: string, toChain: string): boolean {
    return this.supportsChain(fromChain) && this.supportsChain(toChain);
  }

  /**
   * Get reliability score
   */
  getReliabilityScore(): number {
    return this.config.reliability.score;
  }

  /**
   * Get average execution time
   */
  getAvgExecutionTime(): { min: number; max: number } {
    return this.config.avgExecutionTime;
  }

  /**
   * Check if instant execution is supported
   */
  supportsInstantExecution(): boolean {
    return this.config.features.instantExecution;
  }

  /**
   * Get quote from bridge
   */
  abstract getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote>;

  /**
   * Create order on bridge
   */
  abstract createOrder(request: BridgeOrderRequest): Promise<BridgeOrder>;

  /**
   * Get order status
   */
  abstract getOrderStatus(orderId: string): Promise<BridgeOrder>;

  /**
   * Validate if the bridge can handle this swap
   */
  canHandle(request: BridgeQuoteRequest): boolean {
    return this.supportsRoute(request.fromChain, request.toChain);
  }

  /**
   * Get supported tokens for a chain
   */
  abstract getSupportedTokens(chain: string): Promise<string[]>;

  /**
   * Estimate gas for the transaction
   */
  abstract estimateGas(request: BridgeQuoteRequest): Promise<string>;

  /**
   * Validate addresses
   */
  abstract validateAddress(address: string, chain: string): Promise<boolean>;

  /**
   * Get approval token address
   */
  abstract getAllowanceTarget(fromToken: string, fromChain: string): Promise<string | null>;
}

/**
 * Create a quote result with common fields
 */
export function createBaseQuote(
  bridgeName: string,
  displayName: string,
  request: BridgeQuoteRequest,
  toAmount: string,
  options?: Partial<BridgeQuote>
): BridgeQuote {
  const fromAmount = BigInt(request.amount);
  const toAmountBigInt = BigInt(toAmount);
  // Replace `0n` with `BigInt(0)` to avoid the ES2020 target requirement
  const rate = fromAmount > BigInt(0) 
    ? (Number(toAmount) / Number(request.amount)).toFixed(8)
    : '0';

  const config = {
    bridge: bridgeName,
    displayName,
    fromChain: request.fromChain,
    toChain: request.toChain,
    fromToken: request.fromToken,
    toToken: request.toToken,
    fromAmount: request.amount,
    toAmount,
    rate,
    gasEstimate: '0',
    gasFee: '0',
    bridgeFee: '0',
    totalFee: '0',
    estimatedTime: {
      min: 10,
      max: 30,
    },
    instant: false,
    confidence: 90,
    ...options,
  };

  return config as BridgeQuote;
}

/**
 * Handle bridge API errors
 */
export function handleBridgeError(error: unknown, bridgeName: string): Error {
  if (error instanceof Error) {
    return new Error(`${bridgeName}: ${error.message}`);
  }
  return new Error(`${bridgeName}: Unknown error occurred`);
}

/**
 * Retry wrapper for bridge calls
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}
