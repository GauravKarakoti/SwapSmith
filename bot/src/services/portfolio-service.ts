import { createQuote, createOrder } from './sideshift-client';
import { db, orders, watchedOrders } from './database';
import logger from './logger';
import type { ParsedCommand } from './parseUserCommand';

interface PortfolioExecutionResult {
  success: any;
  orderIds: any;
  error: string;
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

interface QuoteOrderPair {
  quote: any;
  order: any;
  allocation: any;
  swapAmount: number;
}

export async function executePortfolioStrategy(
<<<<<<< HEAD
userId: number, parsedCommand: any, fromChain: any, amount: any, portfolio: any, settleAddress: any, bot: Telegraf<Context<Update>>): Promise<PortfolioExecutionResult> {
=======
  userId: number,
  parsedCommand: ParsedCommand

  if (!portfolio || portfolio.length === 0) {
    throw new Error('No portfolio allocation found');

  const quotesAndOrders: QuoteOrderPair[] = [];
  let remainingAmount = amount!;

  for (let i = 0; i < portfolio.length; i++) {
    const allocation = portfolio[i];
    const isLast = i === portfolio.length - 1;

    let swapAmount = (amount! * allocation.percentage) / 100;

    if (isLast) {
      swapAmount = remainingAmount;
    } else {
      remainingAmount -= swapAmount;
    }

    if (swapAmount <= 0) {
      throw new Error(`Calculated amount too small for ${allocation.toAsset}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    const quote = await createQuote(
      fromAsset!,
      fromChain!,
      allocation.toAsset,
      allocation.toChain,
      swapAmount
    );

    if (quote.error) {
      throw new Error(`Quote failed for ${allocation.toAsset}: ${quote.error.message}`);
    }

    const order = await createOrder(quote.id!, settleAddress!, settleAddress!);

    if (!order.id) {
      throw new Error(`Order creation failed for ${allocation.toAsset}`);
    }

    quotesAndOrders.push({ quote, order, allocation, swapAmount });
  }

  await db.transaction(async (tx) => {
    for (const { quote, order, allocation, swapAmount } of quotesAndOrders) {
      const depositAddr = typeof order.depositAddress === 'string' 
        ? order.depositAddress 
        : order.depositAddress?.address;
      const depositMemo = typeof order.depositAddress === 'object' 
        ? order.depositAddress?.memo 
        : null;

      await tx.insert(orders).values({
        telegramId: userId,
        sideshiftOrderId: order.id,
        quoteId: quote.id!,
        fromAsset: fromAsset!,
        fromNetwork: fromChain!,
        fromAmount: swapAmount.toString(),
        toAsset: allocation.toAsset,
        toNetwork: allocation.toChain,
        settleAmount: quote.settleAmount.toString(),
        depositAddress: depositAddr!,
        depositMemo: depositMemo || null,
        status: 'pending'
      });

      await tx.insert(watchedOrders).values({
        telegramId: userId,
        sideshiftOrderId: order.id,
        lastStatus: 'pending',
      }).onConflictDoNothing();

      logger.info('Portfolio swap executed', {
        userId,
        asset: allocation.toAsset,
        amount: swapAmount,
        quoteId: quote.id,
        orderId: order.id
      });
    }
  });

  const successfulOrders = quotesAndOrders.map(({ quote, order, allocation, swapAmount }) => ({
    order,
    allocation,
    quoteId: quote.id!,
    swapAmount
  }));

  return { successfulOrders, failedSwaps: [] };
}
