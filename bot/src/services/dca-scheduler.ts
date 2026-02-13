/**
 * DCA (Dollar Cost Averaging) Scheduler Service
 * Handles automated recurring swaps at specified intervals
 */

import { Telegraf } from 'telegraf';
import * as db from './database';
import { createQuote, createOrder } from './sideshift-client';
import { handleError } from './logger';

export class DCAScheduler {
  private bot: Telegraf;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_FREQUENCY = 60 * 1000; // Check every minute

  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  start() {
    console.log('🔄 DCA Scheduler started');
    this.checkInterval = setInterval(() => this.checkSchedules(), this.CHECK_FREQUENCY);
    // Run immediately on start
    this.checkSchedules();
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏸️  DCA Scheduler stopped');
    }
  }

  private async checkSchedules() {
    try {
      const schedules = await db.getActiveDCASchedules();
      const now = new Date();

      for (const schedule of schedules) {
        const nextExecution = new Date(schedule.nextExecution);
        
        // Check if it's time to execute
        if (now >= nextExecution) {
          await this.executeSchedule(schedule);
        }
      }
    } catch (error) {
      console.error('❌ DCA Scheduler error:', error);
      await handleError('DCASchedulerError', { error: error instanceof Error ? error.message : 'Unknown' }, null, false);
    }
  }

  private async executeSchedule(schedule: db.DCASchedule) {
    try {
      console.log(`⏰ Executing DCA schedule ${schedule.id} for user ${schedule.telegramId}`);

      // Create quote
      const quote = await createQuote(
        schedule.fromAsset,
        schedule.fromChain,
        schedule.toAsset,
        schedule.toChain,
        schedule.amount,
        '1.1.1.1'
      );

      if (quote.error) {
        throw new Error(`Quote error: ${quote.error.message}`);
      }

      if (!quote.id) {
        throw new Error('Quote returned no ID');
      }

      // Create order
      const order = await createOrder(quote.id, schedule.settleAddress, schedule.settleAddress);
      
      if (!order.id) {
        throw new Error('Failed to create order');
      }

      // Store order in database
      const orderCommand = {
        intent: 'swap' as const,
        fromAsset: schedule.fromAsset,
        fromChain: schedule.fromChain,
        toAsset: schedule.toAsset,
        toChain: schedule.toChain,
        amount: schedule.amount,
        settleAddress: schedule.settleAddress,
        success: true,
        confidence: 100,
        validationErrors: [],
        parsedMessage: `DCA: ${schedule.amount} ${schedule.fromAsset} → ${schedule.toAsset}`,
        settleAsset: null,
        settleNetwork: null,
        settleAmount: null,
        fromProject: null,
        fromYield: null,
        toProject: null,
        toYield: null
      };

      await db.createOrderEntry(schedule.telegramId, orderCommand, order, quote.settleAmount, quote.id);
      await db.addWatchedOrder(schedule.telegramId, order.id, 'pending');

      // Update schedule execution
      await db.updateDCAScheduleExecution(
        schedule.id,
        schedule.frequency,
        schedule.dayOfWeek || undefined,
        schedule.dayOfMonth || undefined
      );

      // Notify user
      const depositAddress = typeof order.depositAddress === 'string' 
        ? order.depositAddress 
        : order.depositAddress.address;

      const message = 
        `🔄 *DCA Execution*\n\n` +
        `Your recurring swap is ready!\n\n` +
        `*Send:* ${schedule.amount} ${schedule.fromAsset}\n` +
        `*Receive:* ~${quote.settleAmount} ${schedule.toAsset}\n` +
        `*Order ID:* \`${order.id}\`\n` +
        `*Deposit Address:* \`${depositAddress}\`\n\n` +
        `*Next execution:* ${new Date(schedule.nextExecution).toLocaleString()}\n\n` +
        `Please send ${schedule.amount} ${schedule.fromAsset} to the deposit address to complete this swap.`;

      await this.bot.telegram.sendMessage(schedule.telegramId, message, { parse_mode: 'Markdown' });

      console.log(`✅ DCA schedule ${schedule.id} executed successfully`);
    } catch (error) {
      console.error(`❌ Failed to execute DCA schedule ${schedule.id}:`, error);
      
      // Notify user of failure
      try {
        await this.bot.telegram.sendMessage(
          schedule.telegramId,
          `⚠️ *DCA Execution Failed*\n\n` +
          `Your recurring swap for ${schedule.amount} ${schedule.fromAsset} → ${schedule.toAsset} failed.\n\n` +
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
          `Use /dca_list to manage your schedules.`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.error('Failed to notify user of DCA failure:', notifyError);
      }

      await handleError('DCAExecutionError', { 
        scheduleId: schedule.id, 
        error: error instanceof Error ? error.message : 'Unknown' 
      }, null, false);
    }
  }
}
