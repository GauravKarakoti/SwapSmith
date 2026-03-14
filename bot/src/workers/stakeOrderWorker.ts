import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import * as db from '../services/database';
import { getOrderStatus } from '../services/sideshift-client';
import { handleError, default as logger } from '../services/logger';
import type { StakeOrder } from '../services/database';

// Worker configuration
const WORKER_INTERVAL = '*/2 * * * *'; // Run every 2 minutes

// Telegram bot instance (will be set from bot.ts)
let bot: Telegraf | null = null;
let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Initialize the stake order worker with a Telegram bot instance
 */
export function initializeStakeWorker(telegrafBot: Telegraf) {
  bot = telegrafBot;

  if (scheduledTask) {
    logger.warn('[StakeWorker] initializeStakeWorker called but task already scheduled');
    return;
  }

  // Schedule stake order checks every 2 minutes
  scheduledTask = cron.schedule(WORKER_INTERVAL, async () => {
    logger.info('[StakeWorker] Checking stake orders...');
    await checkAndProcessStakeOrders();
  });

  logger.info('[StakeWorker] Stake order worker initialized with cron job');
}

/**
 * Check pending stake orders and process those where swap has completed
 */
export async function checkAndProcessStakeOrders(): Promise<void> {
  try {
    // Get all stake orders where swap is pending or processing
    const pendingOrders = await db.getPendingStakeOrders();

    for (const order of pendingOrders) {
      await processStakeOrder(order);
    }
  } catch (error) {
    await handleError('StakeOrderCheckError', {
      error: error instanceof Error ? error.message : 'Unknown error'
    }, null, false, 'medium');
  }
}

/**
 * Process a single stake order
 */
async function processStakeOrder(order: StakeOrder): Promise<void> {
  try {
    logger.info(`[StakeWorker] Processing stake order ${order.id} for user ${order.telegramId}`);

    // Check the swap status via SideShift
    const swapStatus = await getOrderStatus(order.sideshiftOrderId);

    // Update swap status in database
    if (swapStatus.status !== order.swapStatus) {
      await db.updateStakeOrderSwapStatus(
        order.sideshiftOrderId,
        swapStatus.status,
        swapStatus.settleAmount || undefined
      );

      // Notify user of swap status change
      if (bot) {
        await notifySwapStatusChange(order, swapStatus.status);
      }
    }

    // If swap is settled, initiate staking
    if (swapStatus.status === 'settled' && order.stakeStatus === 'pending') {
      await initiateStaking(order, swapStatus);
    }

  } catch (error) {
    logger.error(`[StakeWorker] Error processing stake order ${order.id}:`, error);

    // Update order with error status
    await db.updateStakeOrderStakeStatus(
      order.sideshiftOrderId,
      'failed'
    );

    // Notify user of failure
    if (bot) {
      await bot.telegram.sendMessage(
        order.telegramId,
        `❌ *Stake Order Failed*\n\n` +
        `Order ID: \`${order.sideshiftOrderId}\`\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Your swapped tokens have been sent to your wallet.`,
        { parse_mode: 'Markdown' }
      );
    }
  }
}

/**
 * Initiate the staking process after swap completes
 */
async function initiateStaking(order: StakeOrder, swapStatus: any): Promise<void> {
  logger.info(`[StakeWorker] Initiating staking for order ${order.id}`);

  try {
    const {
      buildStakingTransaction,
      isAutoStakingAvailable,
      getEstimatedStakingFee,
    } = await import('../services/stake-client');

    const settleAmount = swapStatus.settleAmount || order.settleAmount || '0';

    // Check if auto-staking is available for this protocol
    const canAutoStake = isAutoStakingAvailable(order.stakeProtocol, order.stakeNetwork);

    if (canAutoStake && order.stakeAddress) {
      logger.info(
        `[StakeWorker] Attempting auto-stake for order ${order.id} on ${order.stakeProtocol}`
      );

      try {
        // Build the staking transaction
        const stakeTx = await buildStakingTransaction(
          order.stakeProtocol,
          settleAmount,
          order.stakeAddress,
          order.depositAddress
        );

        // Mark as submitted and ready for execution
        await db.updateStakeOrderStakeStatus(
          order.sideshiftOrderId,
          'submitted'
        );

        // Calculate gas fee estimate
        const estimatedFee = getEstimatedStakingFee(order.stakeProtocol, settleAmount);

        // Notify user of staking in progress
        await notifyStakingProcessing(order, settleAmount, estimatedFee, stakeTx);
      } catch (stakingError) {
        logger.error(`[StakeWorker] Error building staking tx: ${stakingError}`);
        // Fall back to manual instructions
        await provideManualStakingInstructions(order, settleAmount);
      }
    } else {
      // Provide manual staking instructions
      await provideManualStakingInstructions(order, settleAmount);
    }
  } catch (error) {
    logger.error(`[StakeWorker] Error in initiateStaking: ${error}`);

    // Still notify user with instructions as fallback
    try {
      const settleAmount = swapStatus.settleAmount || order.settleAmount || '0';
      await provideManualStakingInstructions(order, settleAmount);
    } catch (fallbackError) {
      logger.error(`[StakeWorker] Fallback instruction failed: ${fallbackError}`);
    }
  }
}

/**
 * Provide manual staking instructions to the user
 */
async function provideManualStakingInstructions(
  order: StakeOrder,
  settleAmount: string
): Promise<void> {
  if (!bot) return;

  const { formatStakingInstructions } = await import('../services/stake-client');

  const instructionsMessage = formatStakingInstructions(order as any, settleAmount);

  await bot.telegram.sendMessage(
    order.telegramId,
    instructionsMessage,
    { parse_mode: 'Markdown' }
  );

  // Mark as awaiting user action
  await db.updateStakeOrderStakeStatus(
    order.sideshiftOrderId,
    'pending'
  );
}

/**
 * Notify user of staking being processed
 */
async function notifyStakingProcessing(
  order: StakeOrder,
  settleAmount: string,
  estimatedFee: number,
  stakeTx: { to: string; data: string; value: string }
): Promise<void> {
  if (!bot) return;

  await bot.telegram.sendMessage(
    order.telegramId,
    `⚙️ *Staking in Progress*\n\n` +
    `*Order:* \`${order.sideshiftOrderId}\`\n` +
    `*Amount:* ${settleAmount} ${order.stakeAsset}\n` +
    `*Protocol:* ${order.stakeProtocol}\n` +
    `*Network:* ${order.stakeNetwork}\n\n` +
    `📊 *Transaction Details:*\n` +
    `To: \`${stakeTx.to}\`\n` +
    `Est. Fee: $${estimatedFee.toFixed(2)}\n\n` +
    `⏳ Processing your staking transaction...\n` +
    `I'll notify you when it completes!`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Notify user of swap status change
 */
async function notifySwapStatusChange(order: StakeOrder, newStatus: string): Promise<void> {
  if (!bot) return;

  const emojiMap: Record<string, string> = {
    waiting: '⏳',
    pending: '⏳',
    processing: '⚙️',
    settling: '📤',
    settled: '✅',
    refunded: '↩️',
    expired: '⏰',
    failed: '❌',
  };

  const emoji = emojiMap[newStatus] || '🔔';

  // Build message based on status
  let statusMessage = '';
  if (newStatus === 'settled') {
    statusMessage = `\n\nGreat news! Your swap is complete. Preparing to stake your tokens...`;
  } else if (newStatus === 'failed') {
    statusMessage = `\n\n⚠️ Your swap failed. Funds will be refunded to your original address.`;
  } else if (newStatus === 'refunded') {
    statusMessage = `\n\n✅ Refund initiated. You'll receive your original tokens shortly.`;
  }

  await bot.telegram.sendMessage(
    order.telegramId,
    `${emoji} *Swap & Stake Update*\n\n` +
    `*Order:* \`${order.sideshiftOrderId}\`\n` +
    `*Status:* ${newStatus.toUpperCase()}\n` +
    `*From:* ${order.fromAmount} ${order.fromAsset}\n` +
    `*To:* ${order.stakeAsset} (${order.stakeProtocol})\n` +
    `*Network:* ${order.stakeNetwork}` +
    statusMessage,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Stop the worker (for graceful shutdown)
 */
export function stopStakeWorker(): void {
  logger.info('[StakeWorker] Stopping stake order worker');
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  bot = null;
}