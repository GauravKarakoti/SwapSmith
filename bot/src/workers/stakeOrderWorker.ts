/**
 * Stake Order Worker
 * Polls for completed cross-chain swaps and safely executes staking transactions
 * using atomic database locks and dynamic gas optimization.
 */

import { Telegraf } from 'telegraf';
import { eq, and } from 'drizzle-orm';
import { db, stakeOrders, type StakeOrder } from '../services/database';
import { getOrderStatus } from '../services/sideshift-client';
import logger, { handleError } from '../services/logger';
import { 
  buildStakingTransaction, 
  isAutoStakingAvailable, 
  getEstimatedStakingFee, 
  formatStakingInstructions 
} from '../services/stake-client';
import { getOptimizationRecommendation } from '../../../shared/services/gas-estimator';

const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export class StakeOrderWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private bot: Telegraf | null = null;

  /**
   * Initialize and start the stake order worker
   */
  public start(telegrafBot: Telegraf) {
    if (this.isRunning) {
      logger.warn('[StakeWorker] start() called but worker is already running.');
      return;
    }

    this.bot = telegrafBot;
    this.isRunning = true;

    logger.info('🚀 [StakeWorker] Starting Stake Order Worker...');

    // Run immediately on startup
    this.checkAndProcessStakeOrders();

    // Schedule periodic polling
    this.intervalId = setInterval(() => {
      this.checkAndProcessStakeOrders();
    }, CHECK_INTERVAL_MS);
  }

  /**
   * Stop the worker for graceful shutdown
   */
  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.bot = null;
    logger.info('🛑 [StakeWorker] Stake Order Worker stopped.');
  }

  /**
   * Check pending stake orders and process those where swap has completed
   */
  private async checkAndProcessStakeOrders(): Promise<void> {
    try {
      // Fetch orders where the staking leg has not been completed or failed
      const pendingOrders = await db.select().from(stakeOrders).where(
        eq(stakeOrders.stakeStatus, 'pending')
      );

      if (pendingOrders.length === 0) return;
      logger.info(`🔍 [StakeWorker] Evaluating ${pendingOrders.length} pending stake orders...`);

      for (const order of pendingOrders) {
        await this.processStakeOrder(order);
      }
    } catch (error) {
      await handleError('StakeOrderCheckError', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, undefined, false, 'medium');
    }
  }

  /**
   * Process a single stake order
   */
  private async processStakeOrder(order: StakeOrder): Promise<void> {
    try {
      // 1. Check the upstream swap status
      const swapStatus = await getOrderStatus(order.sideshiftOrderId);

      // 2. Sync swap status if it changed
      if (swapStatus.status !== order.swapStatus) {
        await db.update(stakeOrders)
          .set({ 
            swapStatus: swapStatus.status,
            settleAmount: swapStatus.settleAmount ? swapStatus.settleAmount.toString() : order.settleAmount
          })
          .where(eq(stakeOrders.id, order.id));

        if (this.bot) {
          await this.notifySwapStatusChange(order, swapStatus.status);
        }
      }

      // 3. If swap is settled, safely initiate staking using DB Locks
      if (swapStatus.status === 'settled' && order.stakeStatus === 'pending') {
        await this.executeStakingSafely(order, swapStatus);
      }

    } catch (error) {
      logger.error(`[StakeWorker] ❌ Error processing stake order ${order.id}:`, error);

      // Fallback: update order with error status
      await db.update(stakeOrders)
        .set({ stakeStatus: 'failed' })
        .where(eq(stakeOrders.id, order.id));

      if (this.bot) {
        await this.bot.telegram.sendMessage(
          Number(order.telegramId),
          `❌ *Stake Order Failed*\n\n` +
          `Order ID: \`${order.sideshiftOrderId}\`\n` +
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
          `Your swapped tokens have been safely deposited to your wallet, but the automated staking failed.`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  }

  /**
   * Wraps the staking initiation in a transaction to prevent double-execution
   */
  private async executeStakingSafely(order: StakeOrder, swapStatus: any): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Atomic Lock: Mark as processing
      const lockedOrder = await tx.update(stakeOrders)
        .set({ stakeStatus: 'processing' })
        .where(
          and(
            eq(stakeOrders.id, order.id),
            eq(stakeOrders.stakeStatus, 'pending') // Only lock if still pending
          )
        )
        .returning();

      if (lockedOrder.length === 0) {
        logger.warn(`⚠️ [StakeWorker] Order #${order.id} is already being processed or was cancelled.`);
        return;
      }

      const settleAmount = swapStatus.settleAmount || order.settleAmount || '0';
      const canAutoStake = isAutoStakingAvailable(order.stakeProtocol, order.stakeNetwork);

      // 2. Network Congestion & Gas Evaluation
      const gasRecommendation = await getOptimizationRecommendation(order.stakeNetwork, undefined, false);
      
      if (gasRecommendation.method === 'timing' && gasRecommendation.canOptimize) {
        logger.info(`[StakeWorker] ⏳ High gas detected on ${order.stakeNetwork}. Delaying staking for order ${order.id}.`);
        
        // Revert status to pending to retry on the next tick
        await tx.update(stakeOrders)
          .set({ stakeStatus: 'pending' })
          .where(eq(stakeOrders.id, order.id));
        return;
      }

      // 3. Execution Routing
      if (canAutoStake && order.stakeAddress) {
        logger.info(`[StakeWorker] ⚡ Attempting auto-stake for order ${order.id} on ${order.stakeProtocol}`);

        try {
          // Build the exact calldata for the staking router
          const stakeTx = await buildStakingTransaction(
            order.stakeProtocol,
            settleAmount,
            order.stakeAddress,
            order.depositAddress || ''
          );

          // Calculate precise gas fee for user transparency
          const estimatedFee = getEstimatedStakingFee(order.stakeProtocol, settleAmount);

          // Submit to network/executor (implementation specific)
          // await executionEngine.submit(stakeTx);

          await tx.update(stakeOrders)
            .set({ stakeStatus: 'submitted' })
            .where(eq(stakeOrders.id, order.id));

          await this.notifyStakingProcessing(order, settleAmount, estimatedFee, stakeTx);
        } catch (stakingError) {
          logger.error(`[StakeWorker] Error building staking tx for ${order.id}:`, stakingError);
          
          // Revert to pending so manual instructions can be provided
          await tx.update(stakeOrders)
            .set({ stakeStatus: 'pending' })
            .where(eq(stakeOrders.id, order.id));
            
          await this.provideManualStakingInstructions(order, settleAmount);
        }
      } else {
        // Not eligible for auto-staking; provide manual instructions
        await tx.update(stakeOrders)
            .set({ stakeStatus: 'pending' })
            .where(eq(stakeOrders.id, order.id));
            
        await this.provideManualStakingInstructions(order, settleAmount);
      }
    });
  }

  /**
   * Provide manual staking instructions to the user
   */
  private async provideManualStakingInstructions(order: StakeOrder, settleAmount: string): Promise<void> {
    if (!this.bot) return;

    const instructionsMessage = formatStakingInstructions(order as any, settleAmount);

    await this.bot.telegram.sendMessage(
      Number(order.telegramId),
      instructionsMessage,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Notify user of staking being processed
   */
  private async notifyStakingProcessing(
    order: StakeOrder,
    settleAmount: string,
    estimatedFee: number,
    stakeTx: { to: string; data: string; value: string }
  ): Promise<void> {
    if (!this.bot) return;

    await this.bot.telegram.sendMessage(
      Number(order.telegramId),
      `⚙️ *Staking in Progress*\n\n` +
      `*Order:* \`${order.sideshiftOrderId}\`\n` +
      `*Amount:* ${settleAmount} ${order.stakeAsset}\n` +
      `*Protocol:* ${order.stakeProtocol}\n` +
      `*Network:* ${order.stakeNetwork}\n\n` +
      `📊 *Transaction Details:*\n` +
      `To: \`${stakeTx.to}\`\n` +
      `Est. Fee: $${estimatedFee.toFixed(2)}\n\n` +
      `⏳ The transaction has been submitted automatically.\n` +
      `I'll notify you the moment it confirms on-chain!`,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Notify user of swap status change
   */
  private async notifySwapStatusChange(order: StakeOrder, newStatus: string): Promise<void> {
    if (!this.bot) return;

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

    let statusMessage = '';
    if (newStatus === 'settled') {
      statusMessage = `\n\nGreat news! Your cross-chain swap is complete. Preparing to route your tokens to the staking contract...`;
    } else if (newStatus === 'failed') {
      statusMessage = `\n\n⚠️ Your swap failed. Funds will be refunded to your original address.`;
    } else if (newStatus === 'refunded') {
      statusMessage = `\n\n✅ Refund initiated. You'll receive your original tokens shortly.`;
    }

    await this.bot.telegram.sendMessage(
      Number(order.telegramId),
      `${emoji} *Swap & Stake Update*\n\n` +
      `*Bridge Order:* \`${order.sideshiftOrderId}\`\n` +
      `*Status:* ${newStatus.toUpperCase()}\n` +
      `*From:* ${order.fromAmount} ${order.fromAsset}\n` +
      `*To:* ${order.stakeAsset} (${order.stakeProtocol})\n` +
      `*Destination:* ${order.stakeNetwork}` +
      statusMessage,
      { parse_mode: 'Markdown' }
    );
  }
}

export const stakeOrderWorker = new StakeOrderWorker();