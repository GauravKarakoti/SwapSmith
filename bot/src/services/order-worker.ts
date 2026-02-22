import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import * as db from './database';
import * as priceMonitor from './price-monitor';
import { createQuote, createOrder } from './sideshift-client';
import { handleError, default as logger } from './logger';
import type { DelayedOrder } from './database';

// Worker configuration
const WORKER_INTERVAL = '*/5 * * * *'; // Run every 5 minutes
const DCA_CHECK_INTERVAL = '0 */6 * * *'; // Check DCA every 6 hours

// Telegram bot instance (will be set from bot.ts)
let bot: Telegraf | null = null;

/**
 * Initialize the order worker with a Telegram bot instance
 */
export function initializeWorker(telegrafBot: Telegraf) {
  bot = telegrafBot;

  // Schedule limit order checks every 5 minutes
  cron.schedule(WORKER_INTERVAL, async () => {
    logger.info('[OrderWorker] Checking limit orders...');
    await checkAndExecuteLimitOrders();
  });

  // Schedule DCA checks every 6 hours
  cron.schedule(DCA_CHECK_INTERVAL, async () => {
    logger.info('[OrderWorker] Checking DCA schedules...');
    await checkAndExecuteDCA();
  });

  logger.info('[OrderWorker] Order worker initialized with cron jobs');
}

/**
 * Check pending limit orders and execute those that meet conditions
 */
export async function checkAndExecuteLimitOrders(): Promise<void> {
  try {
    const triggeredOrders = await priceMonitor.checkPendingLimitOrders();

    for (const order of triggeredOrders) {
      await executeLimitOrder(order);
    }
  } catch (error) {
    await handleError('LimitOrderCheckError', {
      error: error instanceof Error ? error.message : 'Unknown error'
    }, null, false);
  }
}

/**
 * Execute a single limit order
 */
async function executeLimitOrder(order: DelayedOrder): Promise<void> {
  try {
    logger.info(`[OrderWorker] Executing limit order ${order.id} for user ${order.telegramId}`);

    // Validate settle address
    if (!order.settleAddress) {
      throw new Error('No settle address provided for order');
    }

    // Store in const to satisfy TypeScript
    const settleAddress: string = order.settleAddress;

    // Update status to active (though for limits active is default, this might lock it)
    // For now we just proceed

    // Ensure required fields are present
    const fromAsset = order.fromAsset || 'USDC';
    const fromChain = order.fromChain || 'ethereum';
    const toChain = order.toChain || 'ethereum';

    // Create quote
    const quote = await createQuote(
      fromAsset,
      fromChain,
      order.toAsset,
      toChain,
      order.amount,
      process.env.SIDESHIFT_CLIENT_IP || '127.0.0.1' // Use configured IP or localhost placeholder
    );

    if (quote.error) {
      throw new Error(`Quote error: ${quote.error.message}`);
    }

    // Create order
    const sideshiftOrder = await createOrder(quote.id, settleAddress, settleAddress);

    if (!sideshiftOrder.id) {
      throw new Error('Failed to create SideShift order');
    }

    // Update order status to completed
    await db.updateDelayedOrderStatus(order.id, 'completed');

    // Notify user
    await notifyUser(order.telegramId,
      `✅ *Limit Order Executed!*\n\n` +
      `Your limit order to buy ${order.amount} ${order.toAsset} at $${order.targetPrice} has been executed.\n\n` +
      `Order ID: \`${sideshiftOrder.id}\`\n` +
      `Please complete the transaction by sending ${quote.depositAmount} ${quote.depositCoin} to the deposit address.`
    );

    logger.info(`[OrderWorker] Limit order ${order.id} executed successfully`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await handleError('LimitOrderExecutionError', {
      error: errorMessage,
      orderId: order.id,
      telegramId: order.telegramId
    }, null, false);

    // Notify user of failure
    await notifyUser(order.telegramId,
      `⚠️ *Limit Order Failed*\n\n` +
      `Your limit order for ${order.amount} ${order.toAsset} could not be executed.\n` +
      `Error: ${errorMessage}\n\n` +
      `The order will remain active and retry later.`
    );
  }
}

/**
 * Check and execute DCA orders
 */
export async function checkAndExecuteDCA(): Promise<void> {
  try {
    const pendingOrders = await db.getPendingDelayedOrders();
    const dcaOrders = pendingOrders.filter(order => order.orderType === 'dca');

    const now = new Date();

    for (const order of dcaOrders) {
      // Check if it's time for next execution
      if (!order.nextExecutionAt || new Date(order.nextExecutionAt) > now) {
        continue;
      }

      // Check if DCA is complete
      if (order.executionCount !== undefined && order.maxExecutions !== undefined && order.executionCount >= order.maxExecutions) {
        await db.updateDelayedOrderStatus(order.id, 'completed');
        await notifyUser(order.telegramId,
          `✅ *DCA Complete!*\n\n` +
          `Your DCA for ${order.toAsset} has completed all ${order.maxExecutions} purchases.`
        );
        continue;
      }

      await executeDCAPurchase(order);
    }
  } catch (error) {
    await handleError('DCACheckError', {
      error: error instanceof Error ? error.message : 'Unknown error'
    }, null, false);
  }
}

/**
 * Execute a single DCA purchase
 */
async function executeDCAPurchase(order: DelayedOrder): Promise<void> {
  try {
    const currentCount = order.executionCount || 0;
    const maxCount = order.maxExecutions || 10;
    logger.info(`[OrderWorker] Executing DCA purchase ${currentCount + 1}/${maxCount} for order ${order.id}`);

    // Validate settle address
    if (!order.settleAddress) {
      throw new Error('No settle address provided for order');
    }

    // Store in const to satisfy TypeScript
    const settleAddress: string = order.settleAddress;

    // Ensure required fields are present
    const fromAsset = order.fromAsset || 'USDC';
    const fromChain = order.fromChain || 'ethereum';
    const toChain = order.toChain || 'ethereum';

    // Create quote
    const quote = await createQuote(
      fromAsset,
      fromChain,
      order.toAsset,
      toChain,
      order.amount,
      '1.1.1.1'
    );

    if (quote.error) {
      throw new Error(`Quote error: ${quote.error.message}`);
    }

    // Create order
    const sideshiftOrder = await createOrder(quote.id, settleAddress, settleAddress);

    if (!sideshiftOrder.id) {
      throw new Error('Failed to create SideShift order');
    }

    // Calculate next execution time
    const frequency = order.frequency || 'weekly';
    const nextExecutionAt = calculateNextExecution(frequency, order.nextExecutionAt);

    // Update order status and increment execution count
    const newExecutionCount = currentCount + 1;
    await db.updateDelayedOrderStatus(order.id, 'pending', newExecutionCount, nextExecutionAt);

    // Notify user
    await notifyUser(order.telegramId,
      `✅ *DCA Purchase Executed!*\n\n` +
      `Purchase ${newExecutionCount}/${maxCount} completed.\n` +
      `Bought ${order.amount} worth of ${order.toAsset}.\n\n` +
      `Order ID: \`${sideshiftOrder.id}\`\n` +
      `Next purchase: ${nextExecutionAt ? nextExecutionAt.toLocaleDateString() : 'N/A'}`
    );

    logger.info(`[OrderWorker] DCA purchase for order ${order.id} executed successfully`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await handleError('DCAExecutionError', {
      error: errorMessage,
      orderId: order.id,
      telegramId: order.telegramId
    }, null, false);

    // Notify user of failure
    await notifyUser(order.telegramId,
      `⚠️ *DCA Purchase Failed*\n\n` +
      `Purchase ${(order.executionCount || 0) + 1}/${order.maxExecutions} for ${order.toAsset} could not be executed.\n` +
      `Error: ${errorMessage}\n\n` +
      `Will retry at next scheduled time.`
    );
  }
}

/**
 * Calculate next execution time based on frequency
 */
function calculateNextExecution(frequency: string, currentDate: Date | undefined | null): Date {
  const baseDate = currentDate ? new Date(currentDate) : new Date();

  switch (frequency.toLowerCase()) {
    case 'daily':
      baseDate.setDate(baseDate.getDate() + 1);
      break;
    case 'weekly':
      baseDate.setDate(baseDate.getDate() + 7);
      break;
    case 'monthly':
      baseDate.setMonth(baseDate.getMonth() + 1);
      break;
    default:
      baseDate.setDate(baseDate.getDate() + 7); // Default to weekly
  }

  return baseDate;
}

/**
 * Send notification to user via Telegram
 */
async function notifyUser(telegramId: number, message: string): Promise<void> {
  if (!bot) {
    logger.warn('[OrderWorker] Bot not initialized, cannot send notification');
    return;
  }

  try {
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    await handleError('NotificationError', {
      error: error instanceof Error ? error.message : 'Unknown error',
      telegramId,
      message: message.substring(0, 100)
    }, null, false);
  }
}

/**
 * Manually trigger a limit order check (for testing)
 */
export async function manualLimitOrderCheck(): Promise<db.DelayedOrder[]> {
  await checkAndExecuteLimitOrders();
  return db.getPendingDelayedOrders();
}

/**
 * Manually trigger a DCA check (for testing)
 */
export async function manualDCACheck(): Promise<db.DelayedOrder[]> {
  await checkAndExecuteDCA();
  return db.getPendingDelayedOrders();
}

/**
 * Get worker status
 */
export function getWorkerStatus(): {
  initialized: boolean;
  limitOrderInterval: string;
  dcaInterval: string;
} {
  return {
    initialized: bot !== null,
    limitOrderInterval: WORKER_INTERVAL,
    dcaInterval: DCA_CHECK_INTERVAL,
  };
}