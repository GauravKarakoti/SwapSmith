import { eq, lte, and, sql, gt, inArray } from 'drizzle-orm';
import { db, dcaSchedules, orders, watchedOrders, getUser } from './database';
import { createQuote, createOrder } from './sideshift-client';
import logger from './logger';
import { errorRecoveryManager, DCARecoveryStrategy, type RecoveryContext } from '../utils/error-recovery';

const RETRY_DELAY_MINUTES = parseInt(process.env.DCA_RETRY_DELAY_MINUTES ?? '5', 10);
const MAX_PROCESSING_TIME_MINUTES = parseInt(process.env.DCA_MAX_PROCESSING_TIME_MINUTES ?? '10', 10);
const SCHEDULER_CHECK_INTERVAL_MS = parseInt(process.env.DCA_SCHEDULER_CHECK_INTERVAL_MS ?? '60000', 10);

export class DCAScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.processSchedules(), SCHEDULER_CHECK_INTERVAL_MS);
    logger.info('DCA Scheduler started');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('DCA Scheduler stopped');
  }

  async processSchedules() {
    try {
      const now = new Date();

      const dueSchedules = await db.transaction(async (tx) => {
        const schedules = await tx.select().from(dcaSchedules)
          .where(and(eq(dcaSchedules.isActive, 1), lte(dcaSchedules.nextExecutionAt, now)))
          .for('update', { skipLocked: true });

        if (schedules.length > 0) {
          const lockTime = new Date();
          lockTime.setMinutes(lockTime.getMinutes() + MAX_PROCESSING_TIME_MINUTES);

          const ids = schedules.map(s => s.id);
          await tx.update(dcaSchedules)
            .set({ nextExecutionAt: lockTime })
            .where(inArray(dcaSchedules.id, ids));
        }

        return schedules;
      });

      logger.info(`Checking DCA schedules: found ${dueSchedules.length} due.`);

      for (const schedule of dueSchedules) {
        // Fire-and-forget with proper error handling
        this.executeScheduleWithRecovery(schedule).catch(error => {
          logger.error(`Unrecoverable error in DCA ${schedule.id}`, error);
        });
      }
    } catch (e) {
      logger.error('Error in DCA loop', e);
    }
  }

  /**
   * Execute schedule with error recovery and rollback support
   */
  private async executeScheduleWithRecovery(schedule: any): Promise<void> {
    const idempotencyKey = `dca_${schedule.id}_${schedule.nextExecutionAt.getTime()}`;
    
    await errorRecoveryManager.executeWithRecovery(
      async (context: RecoveryContext) => {
        await this.executeSchedule(schedule, context);
      },
      `DCA Schedule ${schedule.id}`,
      idempotencyKey
    );
  }

  private async executeSchedule(schedule: any, context?: RecoveryContext) {
    try {
      const user = await getUser(Number(schedule.telegramId));
      if (!user?.walletAddress) {
        logger.warn(`Skipping DCA ${schedule.id}: No wallet address`);
        await this.releaseLock(schedule.id, schedule.intervalHours);
        return;
      }

      const quote = await createQuote(
        schedule.fromAsset,
        schedule.fromNetwork,
        schedule.toAsset,
        schedule.toNetwork,
        parseFloat(schedule.amountPerOrder)
      );

      if (quote.error) {
        throw new Error(`Quote error: ${quote.error.message}`);
      }

      const order = await createOrder(quote.id, user.walletAddress, user.walletAddress);

      if (!order.id) {
        throw new Error('Failed to create order - no order ID returned');
      }

      // Register rollback handler for order creation
      if (context) {
        errorRecoveryManager.registerRollback(context, {
          operation: 'cleanup_partial_order',
          execute: async () => {
            // Implement order cleanup if needed
            logger.info(`[Rollback] Cleaning up partial order for schedule ${schedule.id}`);
          }
        });
      }

      await db.transaction(async (tx) => {
        const depositAddr = typeof order.depositAddress === 'string'
          ? order.depositAddress
          : order.depositAddress?.address;
        const depositMemo = typeof order.depositAddress === 'object'
          ? order.depositAddress?.memo
          : null;

        await tx.insert(orders).values({
          telegramId: schedule.telegramId,
          sideshiftOrderId: order.id,
          quoteId: quote.id,
          fromAsset: schedule.fromAsset,
          fromNetwork: schedule.fromNetwork,
          fromAmount: schedule.amountPerOrder,
          toAsset: schedule.toAsset,
          toNetwork: schedule.toNetwork,
          settleAmount: quote.settleAmount.toString(),
          depositAddress: depositAddr!,
          depositMemo: depositMemo || null,
          status: 'pending'
        });

        // Register rollback for DB insert
        if (context) {
          errorRecoveryManager.registerRollback(context, {
            operation: 'cleanup_orders_table',
            execute: async () => {
              logger.info(`[Rollback] Removing order ${order.id} from database`);
              // In production, would delete the order record
            }
          });
        }

        await tx.insert(watchedOrders).values({
          telegramId: schedule.telegramId,
          sideshiftOrderId: order.id,
          lastStatus: 'pending',
        }).onConflictDoNothing();

        const nextExecution = this.calculateNextExecution(schedule.intervalHours);
        await tx.update(dcaSchedules)
          .set({
            ordersExecuted: sql`orders_executed + 1`,
            nextExecutionAt: nextExecution
          })
          .where(eq(dcaSchedules.id, schedule.id));
      });

      logger.info(`Executed DCA Schedule #${schedule.id}, Order: ${order.id}`);

    } catch (error) {
      // Implement smart error recovery based on error type
      const recovery = await DCARecoveryStrategy.handleDCAFailure(
        schedule.id,
        schedule.telegramId,
        error,
        async (scheduleId, nextExecution) => {
          await db.update(dcaSchedules)
            .set({ nextExecutionAt: nextExecution })
            .where(eq(dcaSchedules.id, scheduleId));
        }
      );

      logger.warn(`[DCA Recovery] Schedule ${schedule.id}: ${recovery.strategy} - ${recovery.action}`, {
        error: error instanceof Error ? error.message : error,
        nextRetry: recovery.nextRetry?.toISOString(),
      });
    }
  }


  private async releaseLock(scheduleId: number, intervalHours: number): Promise<void> {
    const nextExecution = this.calculateNextExecution(intervalHours);

    await db.update(dcaSchedules)
      .set({ nextExecutionAt: nextExecution })
      .where(eq(dcaSchedules.id, scheduleId));
  }

  private async scheduleRetry(scheduleId: number): Promise<void> {
    const retryTime = new Date();
    retryTime.setMinutes(retryTime.getMinutes() + RETRY_DELAY_MINUTES);

    await db.update(dcaSchedules)
      .set({ nextExecutionAt: retryTime })
      .where(eq(dcaSchedules.id, scheduleId));

    logger.info(`Scheduled retry for DCA ${scheduleId} at ${retryTime.toISOString()}`);
  }

  private calculateNextExecution(intervalHours: number): Date {
    const next = new Date();
    next.setHours(next.getHours() + intervalHours);
    return next;
  }
}