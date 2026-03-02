/**
 * Wormhole Adapter
 * Bridge adapter for Wormhole Protocol
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

// Wormhole API response types
interface WormholeQuoteResponse {
  sourceChain: number;
  destinationChain: number;
  sourceToken: string;
  destinationToken: string;
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  bridgeFee: string;
  estimatedGas: string;
  depositAddress: string;
  vaa?: string;
}

interface WormholeOrderResponse {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  destinationTxHash?: string;
  message?: string;
}

export class WormholeAdapter extends BaseBridgeAdapter {
  private apiKey: string;

  constructor(config: BridgeConfig) {
    super('wormhole', config);
    this.apiKey = process.env.WORMHOLE_API_KEY || '';
  }

  /**
   * Get quote from Wormhole
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote> {
    try {
      const fromChainId = this.getChainId(request.fromChain);
      const toChainId = this.getChainId(request.toChain);

      const response = await withRetry(async () => {
        return axios.get<WormholeQuoteResponse>(
          `${this.config.apiBaseUrl}/v1/quote`,
          {
            params: {
              sourceChain: fromChainId,
              destinationChain: toChainId,
              sourceToken: request.fromToken,
              destinationToken: request.toToken,
              amount: request.amount,
              walletAddress: request.userAddress,
            },
            headers: this.getHeaders(),
            timeout: this.config.timeout,
          }
        );
      }, this.config.retryAttempts);

      const data = response.data;

      // Calculate fees
      const gasEstimate = BigInt(data.estimatedGas || '250000');
      const gasPrice = BigInt('20000000000'); // 20 gwei default
      const gasFee = (gasEstimate * gasPrice) / BigInt(1e18);
      const bridgeFee = BigInt(data.bridgeFee || '0');
      const totalFee = gasFee + bridgeFee;

      const outputAmount = BigInt(data.amountOut || request.amount);
      const outputAmountMin = BigInt(data.amountOutMin || '0');

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

      quote.allowanceTarget = data.depositAddress;

      return quote;
    } catch (error) {
      throw handleBridgeError(error, 'Wormhole');
    }
  }

  /**
   * Create order on Wormhole
   */
  async createOrder(request: BridgeOrderRequest): Promise<BridgeOrder> {
    try {
      const quote = request.quote;

      if (!quote.depositAddress) {
        throw new Error('Wormhole: No deposit address in quote');
      }

      const order: BridgeOrder = {
        orderId: `wormhole-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      throw handleBridgeError(error, 'Wormhole');
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
      throw handleBridgeError(error, 'Wormhole');
    }
  }

  /**
   * Get supported tokens for a chain
   */
  async getSupportedTokens(chain: string): Promise<string[]> {
    const tokenMap: Record<string, string[]> = {
      ethereum: ['ETH', 'USDC', 'USDT', 'WBTC', 'WETH', 'WH'],
      polygon: ['MATIC', 'USDC', 'USDT', 'WMATIC', 'WH'],
      arbitrum: ['ETH', 'USDC', 'USDT', 'WETH', 'WH'],
      optimism: ['ETH', 'USDC', 'USDT', 'WETH', 'WH'],
      avalanche: ['AVAX', 'USDC', 'USDT', 'WAVAX', 'WH'],
      bsc: ['BNB', 'USDC', 'USDT', 'WBNB', 'WH'],
      solana: ['SOL', 'USDC', 'USDT', 'WSOL'],
      base: ['ETH', 'USDC', 'USDT', 'WETH'],
      fantom: ['FTM', 'USDC', 'USDT', 'WFTM'],
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
      return '250000';
    }
  }

  /**
   * Validate address
   */
  async validateAddress(address: string, chain: string): Promise<boolean> {
    // Support both EVM and Solana addresses
    if (chain.toLowerCase() === 'solana') {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }
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
      ethereum: 2,
      polygon: 5,
      arbitrum: 23,
      optimism: 24,
      avalanche: 6,
      bsc: 4,
      solana: 1,
      base: 30,
      fantom: 10,
      celo: 14,
    };
    return chainIds[chainName.toLowerCase()] || 2;
  }
}

/**
 * Factory function to create Wormhole adapter
 */
export function createWormholeAdapter(): WormholeAdapter {
  const { BRIDGE_CONFIGS } = require('../../config/bridge-config');
  return new WormholeAdapter(BRIDGE_CONFIGS.wormhole);
}
