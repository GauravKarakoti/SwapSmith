/**
 * Stargate Adapter
 * Bridge adapter for Stargate Protocol
 */

import axios from 'axios';
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

// Stargate API response types
interface StargateQuoteResponse {
  amount: string;
  eqFee: {
    gas: string;
    gasPrice: string;
    eqGas: string;
  };
  eqReward: string;
  lpFee: string;
  protocolFee: string;
  bridgeFee: string;
  totalFee: string;
  destinationGas: string;
  destinationPrice: string;
  depositAddress: string;
  dstChainId: number;
  srcChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
}

export class StargateAdapter extends BaseBridgeAdapter {
  private apiKey: string;

  constructor(config: BridgeConfig) {
    super('stargate', config);
    this.apiKey = process.env.STARGATE_API_KEY || '';
  }

  /**
   * Get quote from Stargate
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote> {
    try {
      const fromChainId = this.getChainId(request.fromChain);
      const toChainId = this.getChainId(request.toChain);

      const response = await withRetry(async () => {
        return axios.get<StargateQuoteResponse>(
          `${this.config.apiBaseUrl}/quote`,
          {
            params: {
              srcChainId: fromChainId,
              dstChainId: toChainId,
              srcTokenAddress: request.fromToken,
              dstTokenAddress: request.toToken,
              amount: request.amount,
              userAddress: request.userAddress,
              slippage: (request.slippage || 0.5) * 100,
            },
            headers: this.getHeaders(),
            timeout: this.config.timeout,
          }
        );
      }, this.config.retryAttempts);

      const data = response.data;

      // Calculate fees
      const eqFee = data.eqFee || { gas: '300000', gasPrice: '20000000000' };
      const gasEstimate = BigInt(eqFee.gas || '300000');
      const gasPrice = BigInt(eqFee.gasPrice || '20000000000');
      const gasFee = (gasEstimate * gasPrice) / BigInt(1e18);
      const bridgeFee = BigInt(data.bridgeFee || '0');
      const totalFee = gasFee + bridgeFee;

      const outputAmount = BigInt(data.amount);
      const outputAmountMin = outputAmount - (outputAmount * BigInt(Math.floor((request.slippage || 0.5) * 10000)) / BigInt(10000));

      const quote: BridgeQuote = createBaseQuote(
        this.name,
        this.config.displayName,
        request,
        outputAmountMin.toString(),
        {
          toAmount: outputAmountMin.toString(),
          gasEstimate: gasEstimate.toString(),
          gasFee: gasFee.toString(),
          bridgeFee: bridgeFee.toString(),
          totalFee: totalFee.toString(),
          depositAddress: data.depositAddress,
          estimatedTime: {
            min: this.config.avgExecutionTime.min,
            max: this.config.avgExecutionTime.max,
          },
          instant: this.config.features.instantExecution,
          confidence: this.config.reliability.score,
          route: [request.fromChain, request.toChain],
        }
      );

      quote.allowanceTarget = data.fromTokenAddress;

      return quote;
    } catch (error) {
      throw handleBridgeError(error, 'Stargate');
    }
  }

  /**
   * Create order on Stargate
   */
  async createOrder(request: BridgeOrderRequest): Promise<BridgeOrder> {
    try {
      const quote = request.quote;

      if (!quote.depositAddress) {
        throw new Error('Stargate: No deposit address in quote');
      }

      const order: BridgeOrder = {
        orderId: `stargate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        depositAddress: quote.depositAddress,
        depositAmount: quote.fromAmount,
        depositToken: quote.fromToken,
        depositChain: quote.fromChain,
        receiveAmount: quote.toAmount,
        receiveToken: quote.toToken,
        receiveChain: quote.toChain,
        status: 'pending',
      };

      return order;
    } catch (error) {
      throw handleBridgeError(error, 'Stargate');
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<BridgeOrder> {
    try {
      // In production, you would look up by transaction hash
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
      throw handleBridgeError(error, 'Stargate');
    }
  }

  /**
   * Get supported tokens for a chain
   */
  async getSupportedTokens(chain: string): Promise<string[]> {
    const tokenMap: Record<string, string[]> = {
      ethereum: ['ETH', 'USDC', 'USDT', 'WBTC', 'STG'],
      polygon: ['MATIC', 'USDC', 'USDT', 'STG'],
      arbitrum: ['ETH', 'USDC', 'USDT', 'STG'],
      optimism: ['ETH', 'USDC', 'USDT', 'STG'],
      avalanche: ['AVAX', 'USDC', 'USDT', 'STG'],
      bsc: ['BNB', 'USDC', 'USDT', 'STG'],
      base: ['ETH', 'USDC', 'USDT'],
    };
    return tokenMap[chain.toLowerCase()] || [];
  }

  /**
   * Estimate gas for the transaction
   */
  async estimateGas(request: BridgeQuoteRequest): Promise<string> {
    try {
      const quote = await this.getQuote(request);
      return quote.gasEstimate;
    } catch {
      return '300000';
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
    try {
      const quote = await this.getQuote({
        fromChain: 'ethereum',
        toChain: 'polygon',
        fromToken,
        toToken: fromToken,
        amount: '1',
      });
      return quote.allowanceTarget || null;
    } catch {
      return null;
    }
  }

  /**
   * Get HTTP headers
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
      ethereum: 101,
      polygon: 109,
      arbitrum: 110,
      optimism: 111,
      avalanche: 106,
      bsc: 102,
      base: 184,
    };
    return chainIds[chainName.toLowerCase()] || 101;
  }
}

/**
 * Factory function to create Stargate adapter
 */
export function createStargateAdapter(): StargateAdapter {
  const { BRIDGE_CONFIGS } = require('../../config/bridge-config');
  return new StargateAdapter(BRIDGE_CONFIGS.stargate);
}