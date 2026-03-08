/**
 * Type definitions for quote, order, and allocation data
 */

/**
 * Asset allocation in a portfolio
 */
export interface PortfolioAllocation {
  toAsset: string;
  toChain: string;
  percentage: number;
  priority?: number;
}

/**
 * Quote error details
 */
export interface QuoteError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Quote response from exchange API
 */
export interface Quote {
  id?: string;
  quoteId?: string;
  fromAsset: string;
  fromChain: string;
  fromAmount: string | number;
  toAsset: string;
  toChain: string;
  toAmount: string | number;
  settleAmount: string | number;
  rate?: string | number;
  expiresIn?: number;
  expiresAt?: number;
  createdAt?: number;
  error?: QuoteError;
  validUntil?: number;
  [key: string]: unknown;
}

/**
 * Deposit address information
 */
export interface DepositAddress {
  address: string;
  memo?: string;
  tag?: string;
  [key: string]: unknown;
}

/**
 * Order response from exchange API
 */
export interface Order {
  id?: string;
  orderId?: string;
  status: string;
  createdAt: number;
  quoteId?: string;
  fromAsset: string;
  fromChain: string;
  fromAmount: string | number;
  toAsset: string;
  toChain: string;
  toAmount?: string | number;
  depositAddress: DepositAddress | string;
  refundAddress?: string;
  expiresAt?: number;
  error?: QuoteError;
  [key: string]: unknown;
}

/**
 * Quote and order pair
 */
export interface QuoteOrderPair {
  quote: Quote;
  order: Order;
  allocation: PortfolioAllocation;
  swapAmount: number;
}

/**
 * Successful order execution result
 */
export interface SuccessfulOrderResult {
  order: Order;
  allocation: PortfolioAllocation;
  quoteId: string;
  swapAmount: number;
}

/**
 * Failed swap attempt
 */
export interface FailedSwap {
  asset: string;
  reason: string;
  amount?: number;
}

/**
 * Portfolio execution result
 */
export interface PortfolioExecutionResult {
  successfulOrders: SuccessfulOrderResult[];
  failedSwaps: FailedSwap[];
}

/**
 * Sideshift API response wrapper
 */
export interface SideshiftResponse<T> {
  data?: T;
  error?: QuoteError;
  status?: number;
}

/**
 * Order status response
 */
export interface OrderStatus {
  id: string;
  status: 'pending' | 'confirming' | 'preparing' | 'sending' | 'complete' | 'failed' | 'expired';
  fromAsset: string;
  fromChain: string;
  fromAmount: string | number;
  toAsset: string;
  toChain: string;
  toAmount?: string | number;
  depositAddress?: DepositAddress | string;
  refundAddress?: string;
  createdAt: number;
  expiresAt?: number;
  [key: string]: unknown;
}
