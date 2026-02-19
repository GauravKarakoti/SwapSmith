import { eq, lte, and } from 'drizzle-orm';
import { db, dcaSchedules, updateDCAScheduleExecution, getUser } from './database';
import { createQuote, createOrder } from './sideshift-client';
import logger from './logger';

export class DCAScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.processSchedules(), 60 * 1000); // Check every minute
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
      // Find active schedules that are due (nextExecutionAt <= now)
      const dueSchedules = await db.select().from(dcaSchedules)
        .where(and(eq(dcaSchedules.isActive, 1), lte(dcaSchedules.nextExecutionAt, now)));

      logger.info(`Checking DCA schedules: found ${dueSchedules.length} due.`);

      for (const schedule of dueSchedules) {
        try {
          let settleAddress = '';

          // Fetch user to get wallet address if needed
          if (schedule.telegramId) {
             const user = await getUser(Number(schedule.telegramId));
             if (user?.walletAddress) {
                 settleAddress = user.walletAddress;
             }
          }

          if (!settleAddress) {
              logger.warn(`Skipping DCA ${schedule.id}: No settle address found for user.`);
              continue;
          }

          // Execute Swap Logic
          // 1. Create Quote
          const quote = await createQuote(
              schedule.fromAsset, 
              schedule.fromNetwork, 
              schedule.toAsset, 
              schedule.toNetwork, 
              parseFloat(schedule.amountPerOrder)
          );

          // 2. Create Order
          // For DCA, we usually want an automated order, but SideShift needs user deposit. 
          // If this is a non-custodial bot, we likely generate a new deposit address and notify the user to pay? 
          // OR if it's automated (custodial or approved), we proceed. 
          // Assuming notification model:
          const order = await createOrder(quote.id, settleAddress, settleAddress); 

          // 3. Update Schedule
          await updateDCAScheduleExecution(schedule.id, this.getFrequency(schedule.intervalHours));

          logger.info(`Executed DCA Schedule #${schedule.id}, Order: ${order.id}`);

        } catch (e) {
          logger.error(`Failed to execute DCA ${schedule.id}`, e);
        }
      }
    } catch (e) {
       logger.error('Error in DCA loop', e);
    }
  }

  private getFrequency(hours: number): string {
      if (hours >= 720) return 'monthly';
      if (hours >= 168) return 'weekly';
      return 'daily';
  }
}