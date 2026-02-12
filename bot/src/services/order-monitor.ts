import { Telegraf } from 'telegraf';
import { getOrderStatus } from './sideshift-client';
import * as db from './database';
import { handleError } from './logger';

const POLL_INTERVAL = 60000; // Check every 60 seconds
const COMPLETED_STATUSES = ['settled', 'refunded'];

export class OrderMonitor {
  private bot: Telegraf;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Order monitor is already running');
      return;
    }

    console.log('🔍 Starting order monitor...');
    this.isRunning = true;
    
    // Run immediately on start
    this.checkOrders();
    
    // Then run on interval
    this.intervalId = setInterval(() => {
      this.checkOrders();
    }, POLL_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Order monitor stopped');
  }

  private async checkOrders() {
    try {
      const watchedOrders = await db.getAllWatchedOrders();
      
      if (watchedOrders.length === 0) {
        return;
      }

      console.log(`🔍 Checking ${watchedOrders.length} watched orders...`);

      for (const watchedOrder of watchedOrders) {
        try {
          await this.checkSingleOrder(watchedOrder);
        } catch (error) {
          console.error(`Error checking order ${watchedOrder.sideshiftOrderId}:`, error);
          await handleError('OrderMonitorError', {
            orderId: watchedOrder.sideshiftOrderId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, null, false);
        }
      }
    } catch (error) {
      console.error('Error in order monitor:', error);
      await handleError('OrderMonitorError', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, null, false);
    }
  }

  private async checkSingleOrder(watchedOrder: db.WatchedOrder) {
    const { sideshiftOrderId, telegramId, lastStatus } = watchedOrder;

    try {
      const status = await getOrderStatus(sideshiftOrderId);
      
      // Update the order status in the orders table
      await db.updateOrderStatus(sideshiftOrderId, status.status);

      // Check if status has changed
      if (status.status !== lastStatus) {
        console.log(`📊 Order ${sideshiftOrderId} status changed: ${lastStatus} → ${status.status}`);
        
        // Update watched order status
        await db.updateWatchedOrderStatus(sideshiftOrderId, status.status);

        // Notify user of status change
        await this.notifyUser(telegramId, sideshiftOrderId, status.status, status);

        // If order is completed, remove from watch list
        if (COMPLETED_STATUSES.includes(status.status.toLowerCase())) {
          await db.removeWatchedOrder(sideshiftOrderId);
          console.log(`✅ Order ${sideshiftOrderId} completed and removed from watch list`);
        }
      } else {
        // Just update the last checked time
        await db.updateWatchedOrderStatus(sideshiftOrderId, status.status);
      }
    } catch (error) {
      console.error(`Failed to check order ${sideshiftOrderId}:`, error);
      
      // If order not found (404), remove from watch list
      if (error instanceof Error && error.message.includes('not found')) {
        await db.removeWatchedOrder(sideshiftOrderId);
        console.log(`🗑️ Order ${sideshiftOrderId} not found, removed from watch list`);
      }
    }
  }

  private async notifyUser(telegramId: number, orderId: string, newStatus: string, statusData: any) {
    try {
      let message = `🔔 *Order Update*\n\n`;
      message += `*Order ID:* \`${orderId}\`\n`;
      message += `*Status:* \`${newStatus.toUpperCase()}\`\n\n`;

      if (newStatus.toLowerCase() === 'settled') {
        message += `✅ *Your swap is complete!*\n\n`;
        message += `*Sent:* ${statusData.depositAmount || '?'} ${statusData.depositCoin} (${statusData.depositNetwork})\n`;
        message += `*Received:* ${statusData.settleAmount || '?'} ${statusData.settleCoin} (${statusData.settleNetwork})\n`;
        
        if (statusData.settleHash) {
          message += `*Transaction Hash:* \`${statusData.settleHash}\`\n`;
        }
        
        message += `\n🎉 Funds have been delivered to your wallet!`;
      } else if (newStatus.toLowerCase() === 'refunded') {
        message += `⚠️ *Your swap was refunded*\n\n`;
        message += `*Sent:* ${statusData.depositAmount || '?'} ${statusData.depositCoin}\n`;
        
        if (statusData.depositHash) {
          message += `*Refund Hash:* \`${statusData.depositHash}\`\n`;
        }
        
        message += `\nPlease check your wallet for the refunded amount.`;
      } else if (newStatus.toLowerCase() === 'processing') {
        message += `⏳ *Your swap is being processed*\n\n`;
        message += `Deposit received and swap is in progress...`;
      } else {
        message += `Status changed to: *${newStatus}*`;
      }

      await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error(`Failed to notify user ${telegramId}:`, error);
    }
  }
}
