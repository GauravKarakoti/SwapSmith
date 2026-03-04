// Gas Token Service
// Manages gas tokens (CHI, GST) for transaction fee optimization

import { GAS_CONFIG, getGasTokenConfig } from '../config/gas-config';
import { gasTokens, userGasPreferences, batchedTransactions } from '../schema';
import { eq, and, desc } from 'drizzle-orm';

// Database type
interface Database {
  select: () => any;
  insert: (table: any) => { values: (data: any) => Promise<any> };
  update: (table: any) => { set: (data: any) => { where: (condition: any) => Promise<any> } };
  delete: (table: any) => { where: (condition: any) => Promise<any> };
}

// Database instance - will be injected
let db: Database | null = null;

export function setDatabase(database: Database): void {
  db = database;
}

// Types
export interface GasToken {
  symbol: string;
  name: string;
  contractAddress: string;
  chain: string;
  network: string;
  decimals: number;
  tokenType: string;
  discountPercent: number;
  isActive: boolean;
  balance?: string;
  metadata?: Record<string, unknown>;
}

export interface UserGasPreferences {
  userId: string;
  preferredGasToken: string | null;
  autoOptimize: boolean;
  maxGasPrice: string | null;
  priorityLevel: string;
  batchTransactions: boolean;
  notificationsEnabled: boolean;
  customSettings?: Record<string, unknown>;
}

export interface BatchedTransaction {
  batchId: string;
  userId: string;
  transactions: Array<{
    id: string;
    type: string;
    data: Record<string, unknown>;
  }>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  targetGasPrice?: string;
  maxExecutionTime?: Date;
  gasSaved?: string;
}

// Get all active gas tokens
export async function getActiveGasTokens(chain?: string): Promise<GasToken[]> {
  if (typeof db === 'undefined' || !db) {
    // Return from config if no database
    const tokens = Object.entries(GAS_CONFIG.GAS_TOKENS).map(([symbol, config]) => ({
      symbol,
      name: config.name,
      contractAddress: config.contractAddresses.ethereum || '',
      chain: 'ethereum',
      network: 'mainnet',
      decimals: 18,
      tokenType: symbol.toLowerCase(),
      discountPercent: config.discountPercent,
      isActive: true,
    }));
    
    if (chain) {
      return tokens.filter(t => {
        const config = getGasTokenConfig(t.symbol);
        return config?.supportedChains.includes(chain);
      });
    }
    
    return tokens;
  }

  try {
    let query = db
      .select()
      .from(gasTokens)
      .where(eq(gasTokens.isActive, true));
    
    if (chain) {
      query = query.where(eq(gasTokens.chain, chain));
    }
    
    const results = await query.orderBy(desc(gasTokens.discountPercent));
    
    return results.map((row: {
      symbol: string;
      name: string;
      contractAddress: string;
      chain: string;
      network: string;
      decimals: number;
      tokenType: string;
      discountPercent: number;
      isActive: boolean;
      metadata: string | Record<string, unknown> | null;
    }) => ({
      symbol: row.symbol,
      name: row.name,
      contractAddress: row.contractAddress,
      chain: row.chain,
      network: row.network,
      decimals: row.decimals,
      tokenType: row.tokenType,
      discountPercent: row.discountPercent,
      isActive: row.isActive,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    }));
  } catch (error) {
    console.error('Error fetching gas tokens:', error);
    return [];
  }
}

// Get gas token by symbol
export async function getGasToken(symbol: string): Promise<GasToken | null> {
  if (typeof db === 'undefined' || !db) {
    const config = getGasTokenConfig(symbol);
    if (!config) return null;
    
    return {
      symbol,
      name: config.name,
      contractAddress: config.contractAddresses.ethereum || '',
      chain: 'ethereum',
      network: 'mainnet',
      decimals: 18,
      tokenType: symbol.toLowerCase(),
      discountPercent: config.discountPercent,
      isActive: true,
    };
  }

  try {
    const results = await db
      .select()
      .from(gasTokens)
      .where(eq(gasTokens.symbol, symbol))
      .limit(1);
    
    if (results.length === 0) return null;
    
    const row = results[0];
    return {
      symbol: row.symbol,
      name: row.name,
      contractAddress: row.contractAddress,
      chain: row.chain,
      network: row.network,
      decimals: row.decimals,
      tokenType: row.tokenType,
      discountPercent: row.discountPercent,
      isActive: row.isActive,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    };
  } catch (error) {
    console.error('Error fetching gas token:', error);
    return null;
  }
}

// Get or create user gas preferences
export async function getUserGasPreferences(userId: string): Promise<UserGasPreferences> {
  if (typeof db === 'undefined' || !db) {
    return {
      userId,
      preferredGasToken: null,
      autoOptimize: GAS_CONFIG.OPTIMIZATION.AUTO_OPTIMIZE_DEFAULT,
      maxGasPrice: null,
      priorityLevel: GAS_CONFIG.OPTIMIZATION.DEFAULT_PRIORITY_LEVEL,
      batchTransactions: false,
      notificationsEnabled: true,
    };
  }

  try {
    const results = await db
      .select()
      .from(userGasPreferences)
      .where(eq(userGasPreferences.userId, userId))
      .limit(1);
    
    if (results.length > 0) {
      const row = results[0];
      return {
        userId: row.userId,
        preferredGasToken: row.preferredGasToken,
        autoOptimize: row.autoOptimize,
        maxGasPrice: row.maxGasPrice,
        priorityLevel: row.priorityLevel,
        batchTransactions: row.batchTransactions,
        notificationsEnabled: row.notificationsEnabled,
        customSettings: typeof row.customSettings === 'string' 
          ? JSON.parse(row.customSettings) 
          : row.customSettings,
      };
    }
  } catch (error) {
    console.error('Error fetching user gas preferences:', error);
  }

  // Return defaults if not found
  return {
    userId,
    preferredGasToken: null,
    autoOptimize: GAS_CONFIG.OPTIMIZATION.AUTO_OPTIMIZE_DEFAULT,
    maxGasPrice: null,
    priorityLevel: GAS_CONFIG.OPTIMIZATION.DEFAULT_PRIORITY_LEVEL,
    batchTransactions: false,
    notificationsEnabled: true,
  };
}

// Update user gas preferences
export async function updateUserGasPreferences(
  userId: string,
  preferences: Partial<UserGasPreferences>
): Promise<UserGasPreferences> {
  const current = await getUserGasPreferences(userId);
  const updated = { ...current, ...preferences };
  
  if (typeof db === 'undefined' || !db) {
    return updated;
  }

  try {
    // Try to insert first
    try {
      await db
        .insert(userGasPreferences)
        .values({
          userId: updated.userId,
          preferredGasToken: updated.preferredGasToken,
          autoOptimize: updated.autoOptimize,
          maxGasPrice: updated.maxGasPrice,
          priorityLevel: updated.priorityLevel,
          batchTransactions: updated.batchTransactions,
          notificationsEnabled: updated.notificationsEnabled,
          customSettings: updated.customSettings,
          updatedAt: new Date(),
        });
    } catch (insertError) {
      // If insert fails (conflict), update existing
      await db
        .update(userGasPreferences)
        .set({
          preferredGasToken: updated.preferredGasToken,
          autoOptimize: updated.autoOptimize,
          maxGasPrice: updated.maxGasPrice,
          priorityLevel: updated.priorityLevel,
          batchTransactions: updated.batchTransactions,
          notificationsEnabled: updated.notificationsEnabled,
          customSettings: updated.customSettings,
          updatedAt: new Date(),
        })
        .where(eq(userGasPreferences.userId, userId));
    }
    
    return updated;
  } catch (error) {
    console.error('Error updating user gas preferences:', error);
    return current;
  }

}

// Calculate gas savings with token
export function calculateTokenSavings(
  gasAmount: number,
  tokenSymbol: string
): { saved: number; percent: number; tokenCost?: number } {
  const tokenConfig = getGasTokenConfig(tokenSymbol);
  
  if (!tokenConfig) {
    return { saved: 0, percent: 0 };
  }
  
  const discount = tokenConfig.discountPercent / 100;
  const saved = gasAmount * discount;
  
  // Estimate token cost (typically 10-20% of savings)
  const tokenCost = saved * 0.15;
  
  return {
    saved: saved - tokenCost,
    percent: tokenConfig.discountPercent,
    tokenCost,
  };
}

// Create a batch of transactions
export async function createBatch(
  userId: string,
  transactions: BatchedTransaction['transactions'],
  targetGasPrice?: string,
  maxExecutionTime?: Date
): Promise<BatchedTransaction | null> {
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const batch: BatchedTransaction = {
    batchId,
    userId,
    transactions,
    status: 'pending',
    targetGasPrice,
    maxExecutionTime,
  };
  
  if (typeof db === 'undefined' || !db) {
    return batch;
  }

  try {
    await db.insert(batchedTransactions).values({
      userId: batch.userId,
      batchId: batch.batchId,
      transactions: batch.transactions,
      status: batch.status,
      targetGasPrice: batch.targetGasPrice,
      maxExecutionTime: batch.maxExecutionTime,
      createdAt: new Date(),
    });
    
    return batch;
  } catch (error) {
    console.error('Error creating batch:', error);
    return null;
  }
}

// Get pending batches for a user
export async function getPendingBatches(userId: string): Promise<BatchedTransaction[]> {
  if (typeof db === 'undefined' || !db) {
    return [];
  }

  try {
    const results = await db
      .select()
      .from(batchedTransactions)
      .where(
        and(
          eq(batchedTransactions.userId, userId),
          eq(batchedTransactions.status, 'pending')
        )
      )
      .orderBy(desc(batchedTransactions.createdAt));
    
    return results.map((row: {
      batchId: string;
      userId: string;
      transactions: string | Array<{ id: string; type: string; data: Record<string, unknown> }>;
      status: string;
      targetGasPrice: string | null;
      maxExecutionTime: Date | null;
      gasSaved: string | null;
    }) => ({
      batchId: row.batchId,
      userId: row.userId,
      transactions: typeof row.transactions === 'string' 
        ? JSON.parse(row.transactions) 
        : row.transactions,
      status: row.status as BatchedTransaction['status'],
      targetGasPrice: row.targetGasPrice || undefined,
      maxExecutionTime: row.maxExecutionTime || undefined,
      gasSaved: row.gasSaved || undefined,
    }));
  } catch (error) {
    console.error('Error fetching pending batches:', error);
    return [];
  }
}

// Execute a batch (mark as processing)
export async function executeBatch(
  batchId: string,
  executionTxHash: string
): Promise<boolean> {
  if (typeof db === 'undefined' || !db) {
    return true;
  }

  try {
    await db
      .update(batchedTransactions)
      .set({
        status: 'processing',
        executionTxHash,
        executedAt: new Date(),
      })
      .where(eq(batchedTransactions.batchId, batchId));
    
    return true;
  } catch (error) {
    console.error('Error executing batch:', error);
    return false;
  }
}

// Complete a batch with gas savings
export async function completeBatch(
  batchId: string,
  gasSaved: string
): Promise<boolean> {
  if (typeof db === 'undefined' || !db) {
    return true;
  }

  try {
    await db
      .update(batchedTransactions)
      .set({
        status: 'completed',
        gasSaved,
        updatedAt: new Date(),
      })
      .where(eq(batchedTransactions.batchId, batchId));
    
    return true;
  } catch (error) {
    console.error('Error completing batch:', error);
    return false;
  }
}

// Get best gas token for a chain
export async function getBestGasToken(
  chain: string,
  userId?: string
): Promise<GasToken | null> {
  // If user has preferences, check their preferred token first
  if (userId) {
    const preferences = await getUserGasPreferences(userId);
    if (preferences.preferredGasToken) {
      const token = await getGasToken(preferences.preferredGasToken);
      if (token && token.isActive) {
        const config = getGasTokenConfig(token.symbol);
        if (config?.supportedChains.includes(chain)) {
          return token;
        }
      }
    }
  }
  
  // Otherwise, get the token with highest discount for this chain
  const tokens = await getActiveGasTokens(chain);
  if (tokens.length === 0) return null;
  
  // Sort by discount percent (highest first)
  return tokens.sort((a, b) => b.discountPercent - a.discountPercent)[0];
}

// Check if user should use gas token
export async function shouldUseGasToken(
  userId: string,
  chain: string,
  estimatedGas: number
): Promise<{
  shouldUse: boolean;
  token: GasToken | null;
  savings: { saved: number; percent: number; tokenCost?: number };
}> {
  const preferences = await getUserGasPreferences(userId);
  
  if (!preferences.autoOptimize) {
    return { shouldUse: false, token: null, savings: { saved: 0, percent: 0 } };
  }
  
  const bestToken = await getBestGasToken(chain, userId);
  
  if (!bestToken) {
    return { shouldUse: false, token: null, savings: { saved: 0, percent: 0 } };
  }
  
  const savings = calculateTokenSavings(estimatedGas, bestToken.symbol);
  
  // Only recommend if savings are significant (>5%)
  const shouldUse = savings.percent >= GAS_CONFIG.OPTIMIZATION.MIN_SAVINGS_PERCENT;
  
  return {
    shouldUse,
    token: bestToken,
    savings,
  };
}

// Format gas token info for display
export function formatGasTokenInfo(token: GasToken): string {
  return `${token.name} (${token.symbol}) - ${token.discountPercent}% discount`;
}

// Get gas token ABI
export function getGasTokenABI(symbol: string): string[] | null {
  const config = getGasTokenConfig(symbol);
  return config?.abi || null;
}
