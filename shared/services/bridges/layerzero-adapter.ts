/**
 * LayerZero Adapter
 * Bridge adapter for LayerZero Protocol
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

// LayerZero API response types
interface LayerZeroQuoteResponse {
  dstChainId: number;
  destination: string;
  bridgeFee: string;
  gasFee: string;
  estimatedAmount: string;
  estimatedGas: string;
  depositAddress: string;
  payload: string;
}

interface LayerZeroOrderResponse {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  destinationTxHash?: string;
}

export class LayerZeroAdapter extends BaseBridgeAdapter {
  private apiKey: string;

  constructor(config: BridgeConfig) {
    super('layerzero', config);
    this.apiKey = process.env.LAYERZERO_API_KEY || '';
  }

  /**
   * Get quote from LayerZero
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote> {
    try {
      const fromChainId = this.getChainId(request.fromChain);
      const toChainId = this.getChainId(request.toChain);

      const response = await withRetry(async () => {
        return axios.get<LayerZeroQuoteResponse>(
          `${this.config.apiBaseUrl}/quote`,
          {
            params: {
              sourceChainId: fromChainId,
              destinationChainId: toChainId,
              sourceTokenAddress: request.fromToken,
              destinationTokenAddress: request.toToken,
              amount: request.amount,
              userAddress: request.userAddress,
            },
            headers: this.getHeaders(),
            timeout: this.config.timeout,
          }
        );
      }, this.config.retryAttempts);

      const data = response.data;

      // Calculate fees
      const gasEstimate = BigInt(data.estimatedGas || '300000');
      const gasFee = BigInt(data.gasFee || '0');
      const bridgeFee = BigInt(data.bridgeFee || '0');
      const totalFee = gasFee + bridgeFee;

      const outputAmount = BigInt(data.estimatedAmount || request.amount);
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
          txData: data.payload,
          route: [request.fromChain, request.toChain],
        }
      );

      quote.allowanceTarget = data.depositAddress;

      return quote;
    } catch (error) {
      throw handleBridgeError(error, 'LayerZero');
    }
  }

  /**
   * Create order on LayerZero
   */
  async createOrder(request: BridgeOrderRequest): Promise<BridgeOrder> {
    try {
      const quote = request.quote;

      if (!quote.depositAddress) {
        throw new Error('LayerZero: No deposit address in quote');
      }

      const order: BridgeOrder = {
        orderId: `layerzero-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      throw handleBridgeError(error, 'LayerZero');
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<BridgeOrder> {
    try {
      // In production, look up by transaction hash
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
      throw handleBridgeError(error, 'LayerZero');
    }
  }

  /**
   * Get supported tokens for a chain
   */
  async getSupportedTokens(chain: string): Promise<string[]> {
    const tokenMap: Record<string, string[]> = {
      ethereum: ['ETH', 'USDC', 'USDT', 'WBTC', 'LZTOKEN'],
      polygon: ['MATIC', 'USDC', 'USDT', 'LZTOKEN'],
      arbitrum: ['ETH', 'USDC', 'USDT', 'LZTOKEN'],
      optimism: ['ETH', 'USDC', 'USDT', 'LZTOKEN'],
      avalanche: ['AVAX', 'USDC', 'USDT', 'LZTOKEN'],
      bsc: ['BNB', 'USDC', 'USDT', 'LZTOKEN'],
      base: ['ETH', 'USDC', 'USDT'],
      fantom: ['FTM', 'USDC', 'USDT'],
      celo: ['CELO', 'cUSD', 'cEUR'],
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
      fantom: 112,
      celo: 125,
    };
    return chainIds[chainName.toLowerCase()] || 101;
  }
}

/**
 * Factory function to create LayerZero adapter
 */
export function createLayerZeroAdapter(): LayerZeroAdapter {
  const { BRIDGE_CONFIGS } = require('../../config/bridge-config');
  return new LayerZeroAdapter(BRIDGE_CONFIGS.layerzero);
}
