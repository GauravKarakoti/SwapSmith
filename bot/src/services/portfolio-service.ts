import { createQuote, createOrder } from './sideshift-client';
import * as db from './database';
import logger from './logger';

interface PortfolioExecutionResult {
  successfulOrders: Array<{
    order: any;
    allocation: any;
    quoteId: string;
    swapAmount: number;
  }>;
  failedSwaps: Array<{
    asset: string;
    reason: string;
  }>;
}

export async function executePortfolioStrategy(
  userId: number,
  parsedCommand: any
): Promise<PortfolioExecutionResult> {
  const { fromAsset, fromChain, amount, portfolio, settleAddress } = parsedCommand;
  const successfulOrders: PortfolioExecutionResult['successfulOrders'] = [];
  const failedSwaps: PortfolioExecutionResult['failedSwaps'] = [];

  let remainingAmount = amount;

  // Validate Input (Basic checks, handler does UI checks)
  if (!portfolio || portfolio.length === 0) {
    throw new Error('No portfolio allocation found');
  }

  for (let i = 0; i < portfolio.length; i++) {
    const allocation = portfolio[i];
    const isLast = i === portfolio.length - 1;

    // Calculate split amount
    let swapAmount = (amount * allocation.percentage) / 100;

    // Handle rounding / remainder for last asset
    if (isLast) {
      swapAmount = remainingAmount;
    } else {
      remainingAmount -= swapAmount;
    }

    // Ensure positive amount
    if (swapAmount <= 0) {
      failedSwaps.push({ asset: allocation.toAsset, reason: "Calculated amount too small" });
      continue;
    }

    try {
      // Rate limit delay (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create Quote
      const quote = await createQuote(
        fromAsset!,
        fromChain!,
        allocation.toAsset,
        allocation.toChain,
        swapAmount
      );

      if (quote.error) throw new Error(quote.error.message);

      // Execute Swap (Create Order)
      // Using settleAddress as refundAddress for simplicity
      const order = await createOrder(quote.id!, settleAddress!, settleAddress!);

      if (!order.id) throw new Error('Failed to create order ID');

      // Store Order in DB
      const orderCommand = {
        ...parsedCommand,
        toAsset: allocation.toAsset,
        toChain: allocation.toChain,
        amount: swapAmount
      };

      await db.createOrderEntry(userId, orderCommand, order, quote.settleAmount, quote.id!);
      await db.addWatchedOrder(userId, order.id, 'pending');

      successfulOrders.push({
        order,
        allocation,
        quoteId: quote.id!,
        swapAmount
      });

      // Log success
      logger.info('Portfolio swap executed', {
        userId,
        asset: allocation.toAsset,
        amount: swapAmount,
        quoteId: quote.id,
        orderId: order.id
      });

    } catch (error) {
      // Handle partial failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      failedSwaps.push({ asset: allocation.toAsset, reason: errorMessage });

      logger.error('Portfolio swap failed', {
        userId,
        asset: allocation.toAsset,
        error: errorMessage
      });
    }
  }

  return { successfulOrders, failedSwaps };
}
