import { eq, lte, and, sql, gt } from 'drizzle-orm';
import { db, dcaSchedules, orders, watchedOrders, getUser } from './database';
import { createQuote, createOrder } from './sideshift-client';
import logger from './logger';

const RETRY_DELAY_MINUTES = 5;
const MAX_PROCESSING_TIME_MINUTES = 10;

export class DCAScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.processSchedules(), 60 * 1000);
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
      const dueSchedules = await db.select().from(dcaSchedules)
        .where(and(eq(dcaSchedules.isActive, 1), lte(dcaSchedules.nextExecutionAt, now)));

      logger.info(`Checking DCA schedules: found ${dueSchedules.length} due.`);

      for (const schedule of dueSchedules) {
        this.executeSchedule(schedule).catch(error => {
          logger.error(`Failed to execute DCA ${schedule.id}`, error);
        });
      }
    } catch (e) {
       logger.error('Error in DCA loop', e);
    }
  }

  private async executeSchedule(schedule: any) {
    const lockAcquired = await this.acquireLock(schedule.id, schedule.nextExecutionAt);
    
    if (!lockAcquired) {
      logger.info(`DCA ${schedule.id} already being processed, skipping`);
      return;
    }

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
        throw new Error(quote.error.message);
      }

      const order = await createOrder(quote.id, user.walletAddress, user.walletAddress);

      if (!order.id) {
        throw new Error('Failed to create order');
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

        await tx.insert(watchedOrders).values({
          telegramId: schedule.telegramId,
          sideshiftOrderId: order.id,
          lastStatus: 'pending',
        }).onConflictDoNothing();

        await tx.update(dcaSchedules)
          .set({ ordersExecuted: sql`orders_executed + 1` })
          .where(eq(dcaSchedules.id, schedule.id));
      });

      logger.info(`Executed DCA Schedule #${schedule.id}, Order: ${order.id}`);

    } catch (e) {
      logger.error(`Failed to execute DCA ${schedule.id}`, e);
      await this.scheduleRetry(schedule.id);
    }
  }

  private async acquireLock(scheduleId: number, currentNextExecution: Date): Promise<boolean> {
    const lockTime = new Date();
    lockTime.setMinutes(lockTime.getMinutes() + MAX_PROCESSING_TIME_MINUTES);

    const result = await db.update(dcaSchedules)
      .set({ nextExecutionAt: lockTime })
      .where(and(
        eq(dcaSchedules.id, scheduleId),
        eq(dcaSchedules.nextExecutionAt, currentNextExecution)
      ))
      .returning({ id: dcaSchedules.id });

    return result.length > 0;
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