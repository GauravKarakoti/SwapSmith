/**
 * Bridge Client for Bot
 * Multi-bridge support for cross-chain swaps in the Telegram bot
 * 
 * Note: This client uses SideShift API directly as the primary bridge
 * and can be extended to support additional bridges via the frontend API
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { SIDESHIFT_CONFIG } from '../../../shared/config/sideshift';

dotenv.config();

const AFFILIATE_ID = process.env.SIDESHIFT_AFFILIATE_ID || process.env.NEXT_PUBLIC_AFFILIATE_ID || '';
const API_KEY = process.env.SIDESHIFT_API_KEY || process.env.NEXT_PUBLIC_SIDESHIFT_API_KEY;
const DEFAULT_USER_IP = process.env.SIDESHIFT_CLIENT_IP;

// SideShift API Configuration - use centralized config
const SIDESHIFT_BASE_URL = process.env.SIDESHIFT_API_URL || SIDESHIFT_CONFIG.BASE_URL;

// Bridge API URL for aggregated quotes (optional)
const BRIDGE_API_URL = process.env.BRIDGE_API_URL || '';

// Local bridge configuration
interface BridgeConfig {
  name: string;
  displayName: string;
  supportedChains: string[];
  features: {
    instantExecution: boolean;
  };
  reliability: {
    score: number;
  };
  avgExecutionTime: {
    min: number;
    max: number;
  };
}

const BRIDGE_CONFIGS: Record<string, BridgeConfig> = {
  sideshift: {
    name: 'sideshift',
    displayName: 'SideShift.ai',
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'base', 'solana'],
    features: { instantExecution: false },
    reliability: { score: 85 },
    avgExecutionTime: { min: 10, max: 60 },
  },
  across: {
    name: 'across',
    displayName: 'Across Protocol',
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
    features: { instantExecution: true },
    reliability: { score: 95 },
    avgExecutionTime: { min: 2, max: 30 },
  },
  stargate: {
    name: 'stargate',
    displayName: 'Stargate',
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'base'],
    features: { instantExecution: true },
    reliability: { score: 92 },
    avgExecutionTime: { min: 5, max: 45 },
  },
  wormhole: {
    name: 'wormhole',
    displayName: 'Wormhole',
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'solana', 'base'],
    features: { instantExecution: true },
    reliability: { score: 90 },
    avgExecutionTime: { min: 5, max: 40 },
  },
};

// Bridge preferences type
interface BridgePreferences {
  preferredBridges: string[];
  avoidBridges: string[];
  priority: 'speed' | 'cost' | 'reliability' | 'balanced';
  maxSlippage: number;
  instantOnly: boolean;
}

const DEFAULT_BRIDGE_PREFERENCES: BridgePreferences = {
  preferredBridges: [],
  avoidBridges: [],
  priority: 'balanced',
  maxSlippage: 0.5,
  instantOnly: false,
};

type BridgePriority = 'cost' | 'speed' | 'reliability' | 'balanced';

// Types
export interface BridgeQuoteRequest {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  userAddress?: string;
  slippage?: number;
}

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
  gasFee: string;
  bridgeFee: string;
  totalFee: string;
  estimatedTime: {
    min: number;
    max: number;
  };
  instant: boolean;
  confidence: number;
  depositAddress?: string;
}

export interface AggregatedQuotes {
  quotes: BridgeQuote[];
  bestQuote: BridgeQuote;
  recommendedQuote: BridgeQuote;
  availableBridges: string[];
  errors: Record<string, string>;
}

/**
 * Get aggregated quotes from multiple bridges
 */
export async function getAggregatedQuotes(
  request: BridgeQuoteRequest,
  preferences?: Partial<BridgePreferences>
): Promise<AggregatedQuotes> {
  // Try to use bridge API if available
  if (BRIDGE_API_URL) {
    try {
      const response = await axios.post<{
        success: boolean;
        data: AggregatedQuotes;
        error?: string;
      }>(
        `${BRIDGE_API_URL}/api/bridge-quote`,
        {
          ...request,
          preferences: {
            ...DEFAULT_BRIDGE_PREFERENCES,
            ...preferences,
          },
          optimize: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      if (response.data.success) {
        return response.data.data;
      }
    } catch (error) {
      console.warn('Bridge aggregator unavailable, falling back to SideShift:', error);
    }
  }

  // Fallback to SideShift
  return getSideShiftQuotes(request);
}

/**
 * Get quotes from SideShift (fallback)
 */
async function getSideShiftQuotes(request: BridgeQuoteRequest): Promise<AggregatedQuotes> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (API_KEY) {
      headers['x-sideshift-secret'] = API_KEY;
    }
    if (DEFAULT_USER_IP) {
      headers['x-user-ip'] = DEFAULT_USER_IP;
    }

    const response = await axios.post(
      `${SIDESHIFT_BASE_URL}/quotes`,
      {
        depositCoin: request.fromToken,
        depositNetwork: request.fromChain,
        settleCoin: request.toToken,
        settleNetwork: request.toChain,
        depositAmount: request.amount,
        affiliateId: AFFILIATE_ID,
      },
      { headers }
    );

    const data = response.data;
    const quote: BridgeQuote = {
      bridge: 'sideshift',
      displayName: 'SideShift.ai',
      fromChain: request.fromChain,
      toChain: request.toChain,
      fromToken: request.fromToken,
      toToken: request.toToken,
      fromAmount: request.amount,
      toAmount: data.settleAmount || data.rate || '0',
      rate: data.rate || '0',
      gasFee: '0',
      bridgeFee: '0',
      totalFee: '0',
      estimatedTime: {
        min: 10,
        max: 60,
      },
      instant: false,
      confidence: 85,
      depositAddress: data.depositAddress,
    };

    return {
      quotes: [quote],
      bestQuote: quote,
      recommendedQuote: quote,
      availableBridges: ['sideshift'],
      errors: {},
    };
  } catch (error) {
    throw new Error(`SideShift quote failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a single bridge quote
 */
export async function getSingleBridgeQuote(
  bridge: string,
  request: BridgeQuoteRequest
): Promise<BridgeQuote> {
  // If SideShift requested, get from API
  if (bridge === 'sideshift') {
    const result = await getSideShiftQuotes(request);
    return result.quotes[0];
  }

  // Try bridge API for other bridges
  if (BRIDGE_API_URL) {
    try {
      const response = await axios.post<{
        success: boolean;
        data: { quotes: BridgeQuote[] };
        error?: string;
      }>(
        `${BRIDGE_API_URL}/api/bridge-quote`,
        {
          ...request,
          bridge,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      if (response.data.success && response.data.data.quotes[0]) {
        return response.data.data.quotes[0];
      }
      throw new Error(response.data.error || `Failed to get ${bridge} quote`);
    } catch (error) {
      throw new Error(`${bridge} quote failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  throw new Error(`Bridge ${bridge} is not available. Only SideShift is supported in bot mode.`);
}

/**
 * Get supported bridges for a route
 */
export function getSupportedBridges(fromChain: string, toChain: string): string[] {
  const bridges: string[] = ['sideshift'];

  for (const [name, config] of Object.entries(BRIDGE_CONFIGS)) {
    if (
      config.supportedChains.includes(fromChain.toLowerCase()) &&
      config.supportedChains.includes(toChain.toLowerCase())
    ) {
      bridges.push(name);
    }
  }

  return bridges;
}

/**
 * Get the best quote based on priority
 */
export function getBestQuote(
  quotes: BridgeQuote[],
  priority: BridgePriority = 'balanced'
): BridgeQuote {
  if (quotes.length === 0) {
    throw new Error('No quotes available');
  }

  if (quotes.length === 1) {
    return quotes[0];
  }

  switch (priority) {
    case 'cost':
      return quotes.reduce((best, current) =>
        Number(current.totalFee || '0') < Number(best.totalFee || '0') ? current : best
      );

    case 'speed':
      return quotes.reduce((best, current) =>
        (current.estimatedTime?.max || 60) < (best.estimatedTime?.max || 60) ? current : best
      );

    case 'reliability':
      return quotes.reduce((best, current) =>
        (current.confidence || 0) > (best.confidence || 0) ? current : best
      );

    case 'balanced':
    default:
      return quotes.reduce((best, current) => {
        const bestScore = calculateScore(best);
        const currentScore = calculateScore(current);
        return currentScore > bestScore ? current : best;
      });
  }
}

/**
 * Calculate a score for a quote (for balanced ranking)
 */
function calculateScore(quote: BridgeQuote): number {
  let score = 0;

  // Fee (25 points max)
  const fee = Number(quote.totalFee || '0');
  score += Math.max(0, 25 - fee * 100);

  // Speed (20 points max)
  const time = quote.estimatedTime?.max || 60;
  score += Math.max(0, 20 - time / 3);

  // Reliability (15 points max)
  score += (quote.confidence || 80) * 0.15;

  return score;
}

/**
 * Format quote for display
 */
export function formatQuoteForDisplay(quote: BridgeQuote): string {
  const lines: string[] = [];
  
  lines.push(`🌉 ${quote.displayName}`);
  lines.push(`💰 You receive: ${quote.toAmount} ${quote.toToken}`);
  lines.push(`⏱️ Time: ${quote.estimatedTime?.min || '?'}-${quote.estimatedTime?.max || '?'} min`);
  lines.push(`📊 Rate: 1 ${quote.fromToken} = ${quote.rate} ${quote.toToken}`);
  
  if (quote.instant) {
    lines.push(`⚡ Instant execution`);
  }
  
  lines.push(`✅ Reliability: ${quote.confidence}%`);

  return lines.join('\n');
}

/**
 * Format multiple quotes for selection
 */
export function formatQuotesForSelection(quotes: BridgeQuote[]): string {
  if (quotes.length === 0) {
    return 'No bridge quotes available for this route.';
  }

  const lines: string[] = [
    '🌉 Available Bridges:',
    '',
  ];

  quotes.forEach((quote, index) => {
    lines.push(`${index + 1}. ${quote.displayName}`);
    lines.push(`   💰 ${quote.toAmount} ${quote.toToken}`);
    lines.push(`   ⏱️ ${quote.estimatedTime?.min || '?'}-${quote.estimatedTime?.max || '?'} min`);
    lines.push(`   📊 ${quote.confidence}% reliable`);
    if (quote.instant) {
      lines.push(`   ⚡ Instant`);
    }
    lines.push('');
  });

  return lines.join('\n');
}
