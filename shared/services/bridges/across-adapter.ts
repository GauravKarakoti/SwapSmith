/**
 * Across Protocol Adapter
 * Bridge adapter for Across Protocol
 */

import axios, { AxiosError } from 'axios';
import { BridgeConfig } from '../../config/bridge-config';
import {
  BaseBridgeAdapter,
  BridgeQuote,
  BridgeOrder,
  BridgeQuoteRequest,
  BridgeOrderRequest,
  createBaseQuote,
  handleBridgeError,
  withRetry,
} from './base-bridge-adapter';

// Across API response types
interface AcrossQuoteResponse {
  route: {
    fromToken: string;
    toToken: string;
    fromChain: number;
    toChain: number;
  };
  inputAmount: string;
  outputAmount: string;
  outputAmountMin: string;
  estimatedGas: string;
  gasPrice: string;
  relayerFee: string;
  recipient: string;
  depositAddress: string;
  exclusiveRelayer: string;
  quoteTimestamp: number;
  fillDeadline: number;
}

interface AcrossOrderStatus {
  orderId: string;
  status: 'pending' | 'filled' | 'expired' | 'cancelled';
  depositTxHash?: string;
  fillTxHash?: string;
  fillAmount?: string;
  fillTimestamp?: number;
}

export class AcrossAdapter extends BaseBridgeAdapter {
  private apiKey: string;

  constructor(config: BridgeConfig) {
    super('across', config);
    this.apiKey = process.env.ACROSS_API_KEY || '';
  }

  /**
   * Get quote from Across Protocol
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote> {
    try {
      const fromChainId = this.getChainId(request.fromChain);
      const toChainId = this.getChainId(request.toChain);

      const response = await withRetry(async () => {
        return axios.get<AcrossQuoteResponse>(
          `${this.config.apiBaseUrl}/api/suggested-fees`,
          {
            params: {
              token: request.fromToken,
              amount: request.amount,
              destinationChainId: toChainId,
              originChainId: fromChainId,
              recipient: request.userAddress,
            },
            headers: this.getHeaders(),
            timeout: this.config.timeout,
          }
        );
      }, this.config.retryAttempts);

      const data = response.data;
      const fromToken = request.fromToken.toUpperCase();
      const toToken = request.toToken.toUpperCase();

      // Calculate fees
      const gasEstimate = BigInt(data.estimatedGas || '200000');
      const gasFee = (gasEstimate * BigInt(data.gasPrice || '20000000000')) / BigInt(1e18);
      const relayerFee = BigInt(data.relayerFee || '0');
      const totalFee = gasFee + relayerFee;

      // Calculate output amount
      const outputAmount = BigInt(data.outputAmount);
      const outputAmountMin = BigInt(data.outputAmountMin);

      const quote: BridgeQuote = createBaseQuote(
        this.name,
        this.config.displayName,
        request,
        outputAmountMin.toString(),
        {
          toAmount: outputAmountMin.toString(),
          gasEstimate: gasEstimate.toString(),
          gasFee: gasFee.toString(),
          bridgeFee: relayerFee.toString(),
          totalFee: totalFee.toString(),
          depositAddress: data.depositAddress,
          estimatedTime: {
            min: this.config.avgExecutionTime.min,
            max: this.config.avgExecutionTime.max,
          },
          instant: this.config.features.instantExecution,
          confidence: this.config.reliability.score,
          expiresAt: new Date(data.fillDeadline * 1000).toISOString(),
          route: [request.fromChain, request.toChain],
        }
      );

      // Add allowance target for token approval
      quote.allowanceTarget = data.depositAddress;

      return quote;
    } catch (error) {
      throw handleBridgeError(error, 'Across');
    }
  }

  /**
   * Create order on Across Protocol
   */
  async createOrder(request: BridgeOrderRequest): Promise<BridgeOrder> {
    try {
      const quote = request.quote;
      
      if (!quote.depositAddress) {
        throw new Error('Across: No deposit address in quote');
      }

      // For Across, the order is created when user sends funds to deposit address
      // We just return the order info
      const order: BridgeOrder = {
        orderId: `across-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        depositAddress: quote.depositAddress,
        depositAmount: quote.fromAmount,
        depositToken: quote.fromToken,
        depositChain: quote.fromChain,
        receiveAmount: quote.toAmount,
        receiveToken: quote.toToken,
        receiveChain: quote.toChain,
        status: 'pending',
        expiry: quote.expiresAt,
      };

      return order;
    } catch (error) {
      throw handleBridgeError(error, 'Across');
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<BridgeOrder> {
    try {
      // Across doesn't have a direct order lookup API
      // In production, you'd track by deposit tx hash
      return {
        orderId,
        depositAddress: '',
        depositAmount: '0',
        depositToken: '',
        depositChain: '',
        receiveAmount: '0',
        receiveToken: '',
        receiveChain: '',
        status: 'pending',
      };
    } catch (error) {
      throw handleBridgeError(error, 'Across');
    }
  }

  /**
   * Get supported tokens for a chain
   */
  async getSupportedTokens(chain: string): Promise<string[]> {
    // Common tokens across supported chains
    const commonTokens = ['ETH', 'USDC', 'USDT', 'WBTC', 'DAI', 'WETH'];
    return commonTokens;
  }

  /**
   * Estimate gas for the transaction
   */
  async estimateGas(request: BridgeQuoteRequest): Promise<string> {
    try {
      const quote = await this.getQuote(request);
      return quote.gasEstimate;
    } catch {
      // Default gas estimate
      return '200000';
    }
  }

  /**
   * Validate address
   */
  async validateAddress(address: string, _chain: string): Promise<boolean> {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Get allowance target
   */
  async getAllowanceTarget(fromToken: string, _fromChain: string): Promise<string | null> {
    // Across uses deposit address as allowance target
    try {
      const quote = await this.getQuote({
        fromChain: 'ethereum',
        toChain: 'polygon',
        fromToken,
        toToken: fromToken,
        amount: '1',
      });
      return quote.depositAddress || null;
    } catch {
      return null;
    }
  }

  /**
   * Get HTTP headers for API requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    
    return headers;
  }

  /**
   * Convert chain name to chain ID
   */
  private getChainId(chainName: string): number {
    const chainIds: Record<string, number> = {
      ethereum: 1,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      base: 8453,
    };
    return chainIds[chainName.toLowerCase()] || 1;
  }
}

/**
 * Factory function to create Across adapter
 */
export function createAcrossAdapter(): AcrossAdapter {
  const { BRIDGE_CONFIGS } = require('../../config/bridge-config');
  return new AcrossAdapter(BRIDGE_CONFIGS.across);
}
