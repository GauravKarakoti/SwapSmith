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

/**
 * Initialize the stake order worker with a Telegram bot instance
 */
export function initializeStakeWorker(telegrafBot: Telegraf) {
  bot = telegrafBot;

  // Schedule stake order checks every 2 minutes
  cron.schedule(WORKER_INTERVAL, async () => {
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
    }, null, false);
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

  // Update status to submitted
  await db.updateStakeOrderStakeStatus(
    order.sideshiftOrderId,
    'submitted'
  );

  // In a real implementation, this would:
  // 1. Generate the staking transaction calldata
  // 2. Either:
  //    a) Send the transaction if we have custody (not recommended)
  //    b) Generate a transaction for the user to sign
  //    c) Use a smart contract to auto-stake on receipt
  
  // For now, we'll provide instructions to the user
  if (bot) {
    const settleAmount = swapStatus.settleAmount || order.settleAmount || '0';
    
    await bot.telegram.sendMessage(
      order.telegramId,
      `✅ *Swap Complete - Ready to Stake!*\n\n` +
      `*Order ID:* \`${order.sideshiftOrderId}\`\n\n` +
      `*Received:* ${settleAmount} ${order.stakeAsset}\n` +
      `*Protocol:* ${order.stakeProtocol}\n` +
      `*Network:* ${order.stakeNetwork}\n\n` +
      `📋 *Next Steps:*\n` +
      `1. Your ${order.stakeAsset} has been sent to your wallet\n` +
      `2. Visit the ${order.stakeProtocol} platform to stake your tokens\n` +
      `3. Deposit address: \`${order.depositAddress}\`\n\n` +
      `💡 *Tip:* You can also stake directly through the protocol's website for the best rates!`,
      { parse_mode: 'Markdown' }
    );

    // Mark as confirmed (user needs to manually stake)
    await db.updateStakeOrderStakeStatus(
      order.sideshiftOrderId,
      'confirmed'
    );
  }
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

  await bot.telegram.sendMessage(
    order.telegramId,
    `${emoji} *Swap & Stake Update*\n\n` +
    `*Order:* \`${order.sideshiftOrderId}\`\n` +
    `*Swap Status:* ${newStatus.toUpperCase()}\n` +
    `*From:* ${order.fromAmount} ${order.fromAsset}\n` +
    `*To:* ${order.stakeAsset} (${order.stakeProtocol})\n\n` +
    (newStatus === 'settled' 
      ? `Next: Preparing to stake your tokens... 📈` 
      : `Waiting for swap to complete...`),
    { parse_mode: 'Markdown' }
  );
}

/**
 * Stop the worker (for graceful shutdown)
 */
export function stopStakeWorker(): void {
  logger.info('[StakeWorker] Stopping stake order worker');
  // Cron jobs are automatically stopped when the process exits
}

// Export for testing
export const _test = {
  processStakeOrder,
  initiateStaking,
};
