/**
 * Gas Estimator Service
 * Provides real-time gas price estimation, historical trend prediction, 
 * and cost optimization recommendations for SwapSmith routing.
 */

import { GAS_CONFIG, calculateGasSavings } from '../config/gas-config';
import { gasEstimates, gasOptimizationHistory } from '../schema';
import { eq, and, desc, gt } from 'drizzle-orm';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface Database {
  select: () => any;
  insert: (table: any) => { values: (data: Record<string, unknown>) => Promise<unknown> };
}

export interface GasEstimate {
  chain: string;
  network: string;
  gasPrice: string;
  gasPriceUnit: string;
  priorityFee?: string;
  baseFee?: string;
  estimatedTimeSeconds?: number;
  confidence: number;
  source: string;
  timestamp: Date;
  expiresAt: Date;
}

export interface GasComparison {
  chain: string;
  currentGas: GasEstimate;
  recommendedGas: GasEstimate;
  savings: {
    amount: string;
    percent: number;
    usdValue?: string;
  };
  recommendation: 'execute_now' | 'wait' | 'use_token' | 'batch';
  reason: string;
}

export interface GasOptimizationResult {
  canOptimize: boolean;
  originalEstimate: GasEstimate;
  optimizedEstimate: GasEstimate;
  savings: {
    amount: string;
    percent: number;
  };
  method: 'timing' | 'token' | 'batching' | 'none';
  gasToken?: string;
  batchId?: string;
  estimatedExecutionTime?: Date;
}

// ---------------------------------------------------------------------------
// Cache Management
// ---------------------------------------------------------------------------

const memoryCache = new Map<string, { data: GasEstimate; expires: Date }>();

function getCacheKey(chain: string, network: string): string {
  return createHash('sha256').update(`${chain}:${network}`).digest('hex');
}

function getCachedEstimate(chain: string, network: string): GasEstimate | null {
  const key = getCacheKey(chain, network);
  const cached = memoryCache.get(key);
  
  if (cached) {
    if (cached.expires > new Date()) {
      return cached.data;
    }
    // Purge expired entry to prevent memory leaks
    memoryCache.delete(key);
  }
  
  return null;
}

function setCachedEstimate(estimate: GasEstimate): void {
  const key = getCacheKey(estimate.chain, estimate.network);
  const expires = new Date(Date.now() + GAS_CONFIG.CACHE_TTL_SECONDS * 1000);
  memoryCache.set(key, { data: estimate, expires });
}

// ---------------------------------------------------------------------------
// Database Operations
// ---------------------------------------------------------------------------

let db: Database | null = null;

export function setDatabase(database: Database): void {
  db = database;
}

async function getDatabaseCache(chain: string, network: string): Promise<GasEstimate | null> {
  if (!db) return null;

  try {
    const results = await db
      .select()
      .from(gasEstimates)
      .where(
        and(
          eq(gasEstimates.chain, chain),
          eq(gasEstimates.network, network),
          gt(gasEstimates.expiresAt, new Date())
        )
      )
      .orderBy(desc(gasEstimates.createdAt))
      .limit(1);
    
    if (results && results.length > 0) {
      const row = results[0];
      return {
        chain: row.chain,
        network: row.network,
        gasPrice: row.gasPrice,
        gasPriceUnit: row.gasPriceUnit,
        priorityFee: row.priorityFee || undefined,
        baseFee: row.baseFee || undefined,
        estimatedTimeSeconds: row.estimatedTimeSeconds || undefined,
        confidence: row.confidence || 80,
        source: row.source,
        timestamp: row.createdAt,
        expiresAt: row.expiresAt,
      };
    }
  } catch (error) {
    console.error(`[DB Cache] Error fetching gas estimate for ${chain}:`, error);
  }
  
  return null;
}

async function saveToDatabaseCache(estimate: GasEstimate): Promise<void> {
  if (!db) return;

  try {
    await db.insert(gasEstimates).values({
      chain: estimate.chain,
      network: estimate.network,
      gasPrice: estimate.gasPrice,
      gasPriceUnit: estimate.gasPriceUnit,
      priorityFee: estimate.priorityFee,
      baseFee: estimate.baseFee,
      estimatedTimeSeconds: estimate.estimatedTimeSeconds,
      confidence: estimate.confidence,
      source: estimate.source,
      expiresAt: estimate.expiresAt,
    });
  } catch (error) {
    console.error(`[DB Cache] Error saving gas estimate for ${estimate.chain}:`, error);
  }
}

// ---------------------------------------------------------------------------
// External API Fetchers
// ---------------------------------------------------------------------------

async function fetchFromGelato(chain: string): Promise<Partial<GasEstimate> | null> {
  try {
    const axios = await import('axios').then(m => m.default || m);
    const response = await axios.get(
      `${GAS_CONFIG.APIS.GELATO.BASE_URL}${GAS_CONFIG.APIS.GELATO.ENDPOINTS.GAS_PRICE}/${chain}`,
      { timeout: 5000 }
    );
    
    const data = response.data as { 
      gasPrice: string; 
      maxPriorityFeePerGas?: string; 
      baseFee?: string;
      estimatedTime?: number;
    };
    
    return {
      gasPrice: data.gasPrice,
      priorityFee: data.maxPriorityFeePerGas,
      baseFee: data.baseFee,
      confidence: 95,
      source: 'gelato',
      estimatedTimeSeconds: data.estimatedTime || 30,
    };
  } catch (error) {
    console.warn(`[API Fetch] Gelato API error for ${chain}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function fetchFromProvider(_chain: string, _network: string): Promise<Partial<GasEstimate> | null> {
  // Placeholder for direct RPC provider integration (Infura/Alchemy/Viem)
  return null;
}

// ---------------------------------------------------------------------------
// Core Estimation Logic
// ---------------------------------------------------------------------------

export async function getGasEstimate(
  chain: string,
  network: string = 'mainnet',
  useCache: boolean = true
): Promise<GasEstimate> {
  
  if (useCache) {
    const cached = getCachedEstimate(chain, network);
    if (cached) return cached;

    const dbCached = await getDatabaseCache(chain, network);
    if (dbCached) {
      setCachedEstimate(dbCached);
      return dbCached;
    }
  }
  
  const estimates: Partial<GasEstimate>[] = [];
  
  const gelato = await fetchFromGelato(chain);
  if (gelato) estimates.push(gelato);
  
  const provider = await fetchFromProvider(chain, network);
  if (provider) estimates.push(provider);
  
  // Fallback if APIs fail
  if (estimates.length === 0) {
    const fallbackPrice = GAS_CONFIG.GAS_PRICE_THRESHOLDS[chain as keyof typeof GAS_CONFIG.GAS_PRICE_THRESHOLDS]?.medium || 50;
    estimates.push({
      gasPrice: fallbackPrice.toString(),
      confidence: 70,
      source: 'fallback',
      estimatedTimeSeconds: 120,
    });
  }
  
  // Select highest confidence estimate
  const bestEstimate = estimates.reduce((best, current) => 
    (current.confidence || 0) > (best.confidence || 0) ? current : best
  );
  
  const fullEstimate: GasEstimate = {
    chain,
    network,
    gasPrice: bestEstimate.gasPrice || '50',
    gasPriceUnit: 'gwei',
    priorityFee: bestEstimate.priorityFee,
    baseFee: bestEstimate.baseFee,
    estimatedTimeSeconds: bestEstimate.estimatedTimeSeconds || 60,
    confidence: bestEstimate.confidence || 80,
    source: bestEstimate.source || 'unknown',
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + GAS_CONFIG.CACHE_TTL_SECONDS * 1000),
  };
  
  setCachedEstimate(fullEstimate);
  await saveToDatabaseCache(fullEstimate);
  
  return fullEstimate;
}

export async function getMultiChainGasEstimates(chains: string[]): Promise<GasEstimate[]> {
  const promises = chains.map(chain => 
    getGasEstimate(chain).catch(error => {
      console.error(`[Gas Estimator] Failed multichain fetch for ${chain}:`, error);
      return null;
    })
  );
  
  const results = await Promise.all(promises);
  return results.filter((estimate): estimate is GasEstimate => estimate !== null);
}

// ---------------------------------------------------------------------------
// Analysis & Optimization
// ---------------------------------------------------------------------------

export async function compareGasPrices(fromChain: string, toChain: string): Promise<GasComparison> {
  const [fromEstimate, toEstimate] = await Promise.all([
    getGasEstimate(fromChain),
    getGasEstimate(toChain),
  ]);
  
  const fromPrice = parseFloat(fromEstimate.gasPrice);
  const toPrice = parseFloat(toEstimate.gasPrice);
  
  const savings = {
    amount: Math.abs(fromPrice - toPrice).toString(),
    percent: 0,
  };
  
  if (fromPrice > toPrice) {
    savings.percent = ((fromPrice - toPrice) / fromPrice) * 100;
  }
  
  let recommendation: GasComparison['recommendation'] = 'execute_now';
  let reason = 'Gas prices are optimal for execution.';
  
  if (savings.percent > 20) {
    if (fromPrice > toPrice) {
      recommendation = 'wait';
      reason = `Gas prices on ${fromChain} are ${savings.percent.toFixed(1)}% higher than ${toChain}. Consider waiting for a drop.`;
    } else {
      recommendation = 'execute_now';
      reason = `Gas prices on ${fromChain} are ${savings.percent.toFixed(1)}% lower than ${toChain}. Optimal execution window.`;
    }
  }
  
  return {
    chain: fromChain,
    currentGas: fromEstimate,
    recommendedGas: toEstimate,
    savings: {
      amount: savings.amount,
      percent: savings.percent,
    },
    recommendation,
    reason,
  };
}

export async function getOptimizationRecommendation(
  chain: string,
  userGasToken?: string,
  allowBatching: boolean = false
): Promise<GasOptimizationResult> {
  const currentEstimate = await getGasEstimate(chain);
  const currentPrice = parseFloat(currentEstimate.gasPrice);
  
  const thresholds = GAS_CONFIG.GAS_PRICE_THRESHOLDS[chain as keyof typeof GAS_CONFIG.GAS_PRICE_THRESHOLDS];
  
  if (!thresholds) {
    return {
      canOptimize: false,
      originalEstimate: currentEstimate,
      optimizedEstimate: currentEstimate,
      savings: { amount: '0', percent: 0 },
      method: 'none',
    };
  }
  
  const isHighGas = currentPrice > thresholds.high;
  const isMediumGas = currentPrice > thresholds.medium;
  
  let optimizedPrice = currentPrice;
  let method: GasOptimizationResult['method'] = 'none';
  let gasToken: string | undefined;
  let batchId: string | undefined;
  
  // 1. Check gas token discounts (e.g., CHI, native protocol tokens)
  if (userGasToken) {
    const tokenConfig = GAS_CONFIG.GAS_TOKENS[userGasToken as keyof typeof GAS_CONFIG.GAS_TOKENS];
    if (tokenConfig && tokenConfig.supportedChains.includes(chain)) {
      const discount = tokenConfig.discountPercent / 100;
      optimizedPrice = currentPrice * (1 - discount);
      method = 'token';
      gasToken = userGasToken;
    }
  }
  
  // 2. Check timing optimization (Wait for congestion drop)
  if (isHighGas && method === 'none') {
    optimizedPrice = currentPrice * 0.8; // Assume a conservative 20% drop post-congestion
    method = 'timing';
  }
  
  // 3. Check batching capability 
  if (allowBatching && isMediumGas) {
    const batchSavings = GAS_CONFIG.BATCHING.GAS_SAVINGS_PERCENT / 100;
    const batchedPrice = currentPrice * (1 - batchSavings);
    
    if (batchedPrice < optimizedPrice) {
      optimizedPrice = batchedPrice;
      method = 'batching';
      batchId = `batch-${Date.now()}`;
    }
  }
  
  const savings = calculateGasSavings(currentPrice, optimizedPrice);
  
  return {
    canOptimize: savings.percent >= GAS_CONFIG.OPTIMIZATION.MIN_SAVINGS_PERCENT,
    originalEstimate: currentEstimate,
    optimizedEstimate: {
      ...currentEstimate,
      gasPrice: optimizedPrice.toString(),
    },
    savings: {
      amount: savings.saved.toFixed(2),
      percent: savings.percent,
    },
    method,
    gasToken,
    batchId,
    estimatedExecutionTime: method === 'timing' 
      ? new Date(Date.now() + 60 * 60 * 1000) 
      : undefined,
  };
}

export async function predictGasPrice(chain: string, _hoursAhead: number = 1): Promise<{
  predictedPrice: string;
  confidence: number;
  trend: 'rising' | 'falling' | 'stable';
}> {
  if (!db) {
    return { predictedPrice: '0', confidence: 0, trend: 'stable' };
  }
  
  try {
    const history = await db
      .select()
      .from(gasEstimates)
      .where(eq(gasEstimates.chain, chain))
      .orderBy(desc(gasEstimates.createdAt))
      .limit(24); 
    
    // Require sufficient data points for a meaningful prediction
    if (history.length < 6) {
      return { predictedPrice: '0', confidence: 0, trend: 'stable' };
    }
    
    const prices: number[] = history.map((h: { gasPrice: string }) => parseFloat(h.gasPrice));
    const avg: number = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // Compare most recent quadrant to oldest quadrant
    const splitIndex = Math.max(Math.floor(prices.length / 4), 1);
    const recent: number[] = prices.slice(0, splitIndex);
    const older: number[] = prices.slice(-splitIndex);
    
    const recentAvg: number = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg: number = older.reduce((a, b) => a + b, 0) / older.length;
    
    let trend: 'rising' | 'falling' | 'stable';
    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (percentChange > 10) trend = 'rising';
    else if (percentChange < -10) trend = 'falling';
    else trend = 'stable';
    
    let predictedMultiplier = 1;
    if (trend === 'rising') predictedMultiplier = 1.15;
    else if (trend === 'falling') predictedMultiplier = 0.85;
    
    return {
      predictedPrice: (avg * predictedMultiplier).toFixed(2),
      confidence: Math.min(history.length * 4, 95), 
      trend,
    };
  } catch (error) {
    console.error(`[Trend Predictor] Error predicting gas price for ${chain}:`, error);
    return { predictedPrice: '0', confidence: 0, trend: 'stable' };
  }
}

// ---------------------------------------------------------------------------
// Telemetry & Formatting Utils
// ---------------------------------------------------------------------------

export async function recordGasOptimization(
  userId: string,
  swapId: string,
  originalGas: string,
  optimizedGas: string,
  gasTokenUsed: string | null,
  gasSaved: string,
  savingsPercent: number,
  optimizationType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!db) return;

  try {
    await db.insert(gasOptimizationHistory).values({
      userId,
      swapId,
      originalGasEstimate: originalGas,
      optimizedGasEstimate: optimizedGas,
      gasTokenUsed,
      gasSaved,
      savingsPercent,
      optimizationType,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error('[Telemetry] Error recording gas optimization:', error);
  }
}

export function formatGasPrice(gasPrice: string, unit: string = 'gwei', _nativeCurrency: string = 'ETH'): string {
  const price = parseFloat(gasPrice);
  
  if (unit.toLowerCase() === 'gwei') {
    if (price < 0.01) {
      return `${(price * 1000).toFixed(2)} wei`;
    } else if (price > 1000) {
      return `${(price / 1000).toFixed(2)} kGwei`;
    }
    return `${price.toFixed(2)} Gwei`;
  }
  
  return `${price} ${unit}`;
}

export function gasPriceToUsd(
  gasPrice: string,
  gasLimit: number = 21000,
  nativePriceUsd: number,
  unit: 'gwei' | 'wei' | 'ether' = 'gwei'
): string {
  const price = parseFloat(gasPrice);
  
  // Normalize everything to Ether mathematically
  let costEth = 0;
  if (unit === 'gwei') costEth = (price * gasLimit) / 1e9;
  else if (unit === 'wei') costEth = (price * gasLimit) / 1e18;
  else if (unit === 'ether') costEth = price * gasLimit;
  
  const costUsd = costEth * nativePriceUsd;
  
  if (costUsd < 0.01) {
    return `< $0.01`;
  }
  
  return `$${costUsd.toFixed(2)}`;
}