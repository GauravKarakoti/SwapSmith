// Gas Estimator Service
// Provides real-time gas price estimation and optimization recommendations

import { GAS_CONFIG, getChainConfig, isEIP1559Supported, calculateGasSavings, getPriorityConfig } from '../config/gas-config';
import { gasEstimates, gasOptimizationHistory } from '../schema';
import { eq, and, desc, gt } from 'drizzle-orm';
import { createHash } from 'crypto';

// Database type

interface Database {
  select: () => any;
  insert: (table: any) => { values: (data: any) => Promise<any> };
}


// Types
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

// Cache management
const memoryCache = new Map<string, { data: GasEstimate; expires: Date }>();

function getCacheKey(chain: string, network: string): string {
  return createHash('sha256').update(`${chain}:${network}`).digest('hex');
}

function getCachedEstimate(chain: string, network: string): GasEstimate | null {
  const key = getCacheKey(chain, network);
  const cached = memoryCache.get(key);
  
  if (cached && cached.expires > new Date()) {
    return cached.data;
  }
  
  if (cached) {
    memoryCache.delete(key);
  }
  
  return null;
}

function setCachedEstimate(estimate: GasEstimate): void {
  const key = getCacheKey(estimate.chain, estimate.network);
  const expires = new Date(Date.now() + GAS_CONFIG.CACHE_TTL_SECONDS * 1000);
  memoryCache.set(key, { data: estimate, expires });
}

// Database instance - will be injected
let db: Database | null = null;

export function setDatabase(database: Database): void {
  db = database;
}

// Database cache operations
async function getDatabaseCache(chain: string, network: string): Promise<GasEstimate | null> {
  if (typeof db === 'undefined' || !db) return null;

  
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
    
    if (results.length > 0) {
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
    console.error('Error fetching gas estimate from database:', error);
  }
  
  return null;
}

async function saveToDatabaseCache(estimate: GasEstimate): Promise<void> {
  if (typeof db === 'undefined' || !db) return;

  
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
    console.error('Error saving gas estimate to database:', error);
  }
}

// Gas price fetching from various sources
async function fetchFromEthGasStation(): Promise<Partial<GasEstimate> | null> {
  try {
    // Dynamic import to avoid module resolution issues
    const axios = await import('axios').then(m => m.default || m);
    const apiKey = process.env.ETH_GAS_STATION_API_KEY;
    const headers: Record<string, string> = {};
    
    if (apiKey) {
      headers[GAS_CONFIG.APIS.ETH_GAS_STATION.API_KEY_HEADER] = apiKey;
    }
    
    const response = await axios.get(
      `${GAS_CONFIG.APIS.ETH_GAS_STATION.BASE_URL}${GAS_CONFIG.APIS.ETH_GAS_STATION.ENDPOINTS.GAS_PRICE}`,
      { headers, timeout: 5000 }
    );
    
    const data = response.data as { average: number; safeLow: number };
    
    // EthGasStation returns prices in deci-gwei (divide by 10)
    return {
      gasPrice: (data.average / 10).toString(),
      priorityFee: (data.average - data.safeLow / 10).toString(),
      confidence: 90,
      source: 'ethgasstation',
      estimatedTimeSeconds: 60,
    };
  } catch (error) {
    console.warn('EthGasStation API error:', error);
    return null;
  }
}

async function fetchFromGelato(chain: string): Promise<Partial<GasEstimate> | null> {
  try {
    // Dynamic import to avoid module resolution issues
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
    console.warn('Gelato API error:', error);
    return null;
  }
}


async function fetchFromProvider(chain: string, network: string): Promise<Partial<GasEstimate> | null> {
  // This would integrate with your existing provider (e.g., Infura, Alchemy)
  // For now, return null to use fallback
  return null;
}

// Main gas estimation function
export async function getGasEstimate(
  chain: string,
  network: string = 'mainnet',
  useCache: boolean = true
): Promise<GasEstimate> {
  // Check memory cache first
  if (useCache) {
    const cached = getCachedEstimate(chain, network);
    if (cached) return cached;
  }
  
  // Check database cache
  if (useCache) {
    const dbCached = await getDatabaseCache(chain, network);
    if (dbCached) {
      setCachedEstimate(dbCached);
      return dbCached;
    }
  }
  
  // Fetch from multiple sources
  const chainConfig = getChainConfig(chain);
  const estimates: Partial<GasEstimate>[] = [];
  
  // Try multiple sources in order of priority
  if (chain === 'ethereum') {
    const ethGasStation = await fetchFromEthGasStation();
    if (ethGasStation) estimates.push(ethGasStation);
  }
  
  const gelato = await fetchFromGelato(chain);
  if (gelato) estimates.push(gelato);
  
  const provider = await fetchFromProvider(chain, network);
  if (provider) estimates.push(provider);
  
  // If no estimates fetched, use fallback
  if (estimates.length === 0) {
    const fallbackPrice = GAS_CONFIG.GAS_PRICE_THRESHOLDS[chain as keyof typeof GAS_CONFIG.GAS_PRICE_THRESHOLDS]?.medium || 50;
    estimates.push({
      gasPrice: fallbackPrice.toString(),
      confidence: 70,
      source: 'fallback',
      estimatedTimeSeconds: 120,
    });
  }
  
  // Use the best estimate (highest confidence)
  const bestEstimate = estimates.reduce((best, current) => 
    (current.confidence || 0) > (best.confidence || 0) ? current : best
  );
  
  // Build full estimate
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
  
  // Cache the result
  setCachedEstimate(fullEstimate);
  await saveToDatabaseCache(fullEstimate);
  
  return fullEstimate;
}

// Get gas estimates for multiple chains
export async function getMultiChainGasEstimates(
  chains: string[]
): Promise<GasEstimate[]> {
  const promises = chains.map(chain => 
    getGasEstimate(chain).catch(error => {
      console.error(`Error fetching gas estimate for ${chain}:`, error);
      return null;
    })
  );
  
  const results = await Promise.all(promises);
  return results.filter((estimate): estimate is GasEstimate => estimate !== null);
}

// Compare gas prices across chains
export async function compareGasPrices(
  fromChain: string,
  toChain: string
): Promise<GasComparison> {
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
  let reason = 'Gas prices are optimal for execution';
  
  if (savings.percent > 20) {
    if (fromPrice > toPrice) {
      recommendation = 'wait';
      reason = `Gas prices on ${fromChain} are ${savings.percent.toFixed(1)}% higher than ${toChain}. Consider waiting for lower prices.`;
    } else {
      recommendation = 'execute_now';
      reason = `Gas prices on ${fromChain} are ${savings.percent.toFixed(1)}% lower than ${toChain}. Good time to execute!`;
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

// Get optimization recommendations
export async function getOptimizationRecommendation(
  chain: string,
  userGasToken?: string,
  allowBatching: boolean = false
): Promise<GasOptimizationResult> {
  const currentEstimate = await getGasEstimate(chain);
  const currentPrice = parseFloat(currentEstimate.gasPrice);
  
  // Get chain thresholds
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
  
  // Check if current gas is high
  const isHighGas = currentPrice > thresholds.high;
  const isMediumGas = currentPrice > thresholds.medium;
  
  // Calculate potential savings
  let optimizedPrice = currentPrice;
  let method: GasOptimizationResult['method'] = 'none';
  let gasToken: string | undefined;
  let batchId: string | undefined;
  
  // Check gas token optimization
  if (userGasToken) {
    const tokenConfig = GAS_CONFIG.GAS_TOKENS[userGasToken as keyof typeof GAS_CONFIG.GAS_TOKENS];
    if (tokenConfig && tokenConfig.supportedChains.includes(chain)) {
      const discount = tokenConfig.discountPercent / 100;
      optimizedPrice = currentPrice * (1 - discount);
      method = 'token';
      gasToken = userGasToken;
    }
  }
  
  // Check timing optimization
  if (isHighGas && method === 'none') {
    // Predict that gas will drop in the next hour
    optimizedPrice = currentPrice * 0.8; // Assume 20% drop
    method = 'timing';
  }
  
  // Check batching optimization
  if (allowBatching && isMediumGas) {
    const batchSavings = GAS_CONFIG.BATCHING.GAS_SAVINGS_PERCENT / 100;
    const batchedPrice = currentPrice * (1 - batchSavings);
    
    if (batchedPrice < optimizedPrice) {
      optimizedPrice = batchedPrice;
      method = 'batching';
      batchId = `batch-${Date.now()}`;
    }
  }
  
  // Calculate savings
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
      ? new Date(Date.now() + 60 * 60 * 1000) // 1 hour later
      : undefined,
  };
}

// Predict gas price trends
export async function predictGasPrice(
  chain: string,
  hoursAhead: number = 1
): Promise<{
  predictedPrice: string;
  confidence: number;
  trend: 'rising' | 'falling' | 'stable';
}> {
  // Get historical data
  if (typeof db === 'undefined' || !db) {
    return {
      predictedPrice: '0',
      confidence: 0,
      trend: 'stable',
    };
  }
  
  try {
    const history = await db
      .select()
      .from(gasEstimates)
      .where(eq(gasEstimates.chain, chain))
      .orderBy(desc(gasEstimates.createdAt))
      .limit(24); // Last 24 data points
    
    if (history.length < 6) {
      return {
        predictedPrice: '0',
        confidence: 0,
        trend: 'stable',
      };
    }
    
    // Simple moving average prediction
    const prices: number[] = history.map((h: { gasPrice: string }) => parseFloat(h.gasPrice));
    const avg: number = prices.reduce((a: number, b: number): number => a + b, 0) / prices.length;
    
    // Calculate trend
    const recent: number[] = prices.slice(0, 6);
    const older: number[] = prices.slice(-6);
    const recentAvg: number = recent.reduce((a: number, b: number): number => a + b, 0) / recent.length;
    const olderAvg: number = older.reduce((a: number, b: number): number => a + b, 0) / older.length;

    
    let trend: 'rising' | 'falling' | 'stable';
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 10) trend = 'rising';
    else if (change < -10) trend = 'falling';
    else trend = 'stable';
    
    // Predict based on trend
    let predictedMultiplier = 1;
    if (trend === 'rising') predictedMultiplier = 1.1;
    else if (trend === 'falling') predictedMultiplier = 0.9;
    
    return {
      predictedPrice: (avg * predictedMultiplier).toFixed(2),
      confidence: Math.min(history.length * 4, 95), // Higher confidence with more data
      trend,
    };
  } catch (error) {
    console.error('Error predicting gas price:', error);
    return {
      predictedPrice: '0',
      confidence: 0,
      trend: 'stable',
    };
  }
}


// Record gas optimization in history
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
  if (typeof db === 'undefined' || !db) return;

  
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
    console.error('Error recording gas optimization:', error);
  }
}

// Format gas price for display
export function formatGasPrice(
  gasPrice: string,
  unit: string = 'gwei',
  nativeCurrency: string = 'ETH'
): string {
  const price = parseFloat(gasPrice);
  
  if (unit === 'gwei') {
    if (price < 0.01) {
      return `${(price * 1000).toFixed(2)} wei`;
    } else if (price > 1000) {
      return `${(price / 1000).toFixed(2)} kGwei`;
    }
    return `${price.toFixed(2)} Gwei`;
  }
  
  return `${price} ${unit}`;
}

// Convert gas price to USD
export function gasPriceToUsd(
  gasPrice: string,
  gasLimit: number = 21000,
  nativePriceUsd: number
): string {
  const price = parseFloat(gasPrice);
  const costEth = (price * gasLimit) / 1e9;
  const costUsd = costEth * nativePriceUsd;
  
  if (costUsd < 0.01) {
    return `< $0.01`;
  }
  
  return `$${costUsd.toFixed(2)}`;
}
