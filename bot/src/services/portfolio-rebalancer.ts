import { eq } from 'drizzle-orm';
import { db } from './database';
import { portfolioTargets, rebalanceHistory } from '../../../shared/schema';
import { analyzePortfolioDrift, type RebalancePlan, type DriftAnalysis } from './portfolio-analyzer';
import { createOrder, createQuote } from './sideshift-client';
import logger from './logger';

export interface SwapExecution {
  fromAsset: string;
  toAsset: string;
  fromAmount: number;
  toAmount: number;
  sideshiftOrderId?: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

/**
 * Execute a single swap for rebalancing
 */
async function executeRebalanceSwap(
  fromAsset: string,
  toAsset: string,
  fromNetwork: string,
  toNetwork: string,
  amount: number,
  settleAddress: string
): Promise<SwapExecution> {
  try {
    logger.info(`Executing rebalance swap: ${amount} ${fromAsset} -> ${toAsset}`);

    // Get a quote first
    const quote = await createQuote(
      fromAsset,
      fromNetwork,
      toAsset,
      toNetwork,
      amount
    );

    if (!quote?.id) {
      throw new Error('Failed to get quote for rebalance swap');
    }

    // Create the order
    const order = await createOrder(quote.id, settleAddress, settleAddress);

    return {
      fromAsset,
      toAsset,
      fromAmount: amount,
      toAmount: parseFloat(quote.settleAmount || '0'),
      sideshiftOrderId: order.id,
      status: 'completed'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Rebalance swap failed: ${errorMessage}`);
    return {
      fromAsset,
      toAsset,
      fromAmount: amount,
      toAmount: 0,
      status: 'failed',
      error: errorMessage
    };
  }
}

/**
 * Calculate optimal rebalancing swaps based on drift analysis
 */
function calculateRebalanceSwaps(
  drifts: DriftAnalysis[],
  totalPortfolioValue: number
): Array<{
  fromAsset: string;
  toAsset: string;
  fromNetwork: string;
  toNetwork: string;
  amount: number;
}> {
  const swaps: Array<{
    fromAsset: string;
    toAsset: string;
    fromNetwork: string;
    toNetwork: string;
    amount: number;
  }> = [];

  // Separate assets that need selling and buying
  const sellAssets = drifts.filter(d => d.suggestedAction === 'sell' && d.amountToTrade > 0);
  const buyAssets = drifts.filter(d => d.suggestedAction === 'buy' && d.amountToTrade > 0);

  // Match sells with buys
  for (const sell of sellAssets) {
    for (const buy of buyAssets) {
      if (sell.amountToTrade <= 0) continue;

      const tradeAmount = Math.min(sell.amountToTrade, buy.amountToTrade);
      
      if (tradeAmount > 0) {
        swaps.push({
          fromAsset: sell.asset,
          toAsset: buy.asset,
          fromNetwork: sell.network,
          toNetwork: buy.network,
          amount: tradeAmount
        });

        sell.amountToTrade -= tradeAmount;
        buy.amountToTrade -= tradeAmount;
      }
    }
  }

  // Any remaining buy amounts need to be converted from USD (stablecoin)
  const remainingBuys = buyAssets.filter(b => b.amountToTrade > 10); // Min $10
  if (remainingBuys.length > 0) {
    // Convert to a stablecoin (USDC) - would need user's preferred stable
    const stablecoin = 'USDC';
    for (const buy of remainingBuys) {
      swaps.push({
        fromAsset: stablecoin,
        toAsset: buy.asset,
        fromNetwork: 'ethereum', // Default network
        toNetwork: buy.network,
        amount: buy.amountToTrade
      });
    }
  }

  return swaps;
}

/**
 * Execute full portfolio rebalancing
 */
export async function executePortfolioRebalance(
  portfolioTargetId: number,
  triggerType: 'manual' | 'auto' | 'threshold' = 'manual',
  settleAddress?: string
): Promise<{
  success: boolean;
  rebalanceId?: number;
  swapsExecuted: SwapExecution[];
  error?: string;
}> {
  try {
    // Get portfolio target
    const targets = await db.select().from(portfolioTargets)
      .where(eq(portfolioTargets.id, portfolioTargetId));

    if (!targets[0]) {
      return { success: false, swapsExecuted: [], error: 'Portfolio target not found' };
    }

    const target = targets[0];
    const userId = target.userId;

    // Analyze current drift
    const analysis = await analyzePortfolioDrift(portfolioTargetId);
    
    if (!analysis) {
      return { success: false, swapsExecuted: [], error: 'Failed to analyze portfolio' };
    }

    if (!analysis.needsRebalance) {
      logger.info(`Portfolio ${portfolioTargetId} does not need rebalancing`);
      return { success: true, swapsExecuted: [], error: undefined };
    }

    // Get settle address from user settings if not provided
    if (!settleAddress) {
      // Would need to get from user settings
      settleAddress = '0x0000000000000000000000000000000000000000'; // Placeholder
    }

    // Create rebalance history entry
    const rebalanceRecord = await db.insert(rebalanceHistory).values({
      portfolioTargetId,
      userId,
      telegramId: target.telegramId,
      triggerType,
      totalPortfolioValue: analysis.currentPortfolio.totalValue.toString(),
      swapsExecuted: [],
      totalFees: '0',
      status: 'pending',
      startedAt: new Date()
    }).returning();

    const rebalanceId = rebalanceRecord[0].id;

    // Calculate optimal swaps
    const swaps = calculateRebalanceSwaps(analysis.drifts, analysis.currentPortfolio.totalValue);

    logger.info(`Executing ${swaps.length} rebalance swaps for portfolio ${portfolioTargetId}`);

    // Execute swaps
    const executedSwaps: SwapExecution[] = [];
    let totalFees = 0;

    for (const swap of swaps) {
      const result = await executeRebalanceSwap(
        swap.fromAsset,
        swap.toAsset,
        swap.fromNetwork,
        swap.toNetwork,
        swap.amount,
        settleAddress
      );

      executedSwaps.push(result);

      if (result.status === 'failed') {
        logger.error(`Rebalance swap failed: ${result.error}`);
      } else {
        // Estimate fees (would need actual fee tracking)
        totalFees += result.toAmount * 0.003; // Approximate 0.3% fee
      }
    }

    // Determine overall status
    const allSucceeded = executedSwaps.every(s => s.status === 'completed');
    const anySucceeded = executedSwaps.some(s => s.status === 'completed');
    const status = allSucceeded ? 'completed' : (anySucceeded ? 'partial' : 'failed');

    // Update rebalance history
    await db.update(rebalanceHistory)
      .set({
        swapsExecuted: executedSwaps,
        totalFees: totalFees.toString(),
        status,
        completedAt: new Date()
      })
      .where(eq(rebalanceHistory.id, rebalanceId));

    // Update last rebalanced timestamp
    await db.update(portfolioTargets)
      .set({ lastRebalancedAt: new Date() })
      .where(eq(portfolioTargets.id, portfolioTargetId));

    return {
      success: allSucceeded,
      rebalanceId,
      swapsExecuted: executedSwaps,
      error: allSucceeded ? undefined : 'Some swaps failed'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Portfolio rebalance failed: ${errorMessage}`);
    return {
      success: false,
      swapsExecuted: [],
      error: errorMessage
    };
  }
}

/**
 * Check if any portfolio needs rebalancing and execute if auto-rebalance is enabled
 */
export async function checkAndRebalancePortfolios(): Promise<{
  checked: number;
  rebalanced: number;
  errors: string[];
}> {
  const result = { checked: 0, rebalanced: 0, errors: [] as string[] };

  try {
    // Get all active portfolios
    const activePortfolios = await db.select().from(portfolioTargets)
      .where(eq(portfolioTargets.isActive, true));

    for (const portfolio of activePortfolios) {
      result.checked++;

      // Analyze drift
      const analysis = await analyzePortfolioDrift(portfolio.id);
      
      if (!analysis || !analysis.needsRebalance) {
        continue;
      }

      // If auto-rebalance is enabled and threshold exceeded
      if (portfolio.autoRebalance) {
        const rebalanceResult = await executePortfolioRebalance(
          portfolio.id,
          'auto'
        );

        if (rebalanceResult.success) {
          result.rebalanced++;
        } else if (rebalanceResult.error) {
          result.errors.push(`Portfolio ${portfolio.id}: ${rebalanceResult.error}`);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error checking portfolios for rebalance: ${errorMessage}`);
    result.errors.push(errorMessage);
  }

  return result;
}
