import { Telegraf } from 'telegraf';
import { priceMonitor } from '../services/price-monitor';

const CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

export class OrderWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  public async start(bot: Telegraf) {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('🚀 Starting Order Worker...');

    // Initialize price monitor
    priceMonitor.setBot(bot);
    if (typeof priceMonitor.init === 'function') {
        await priceMonitor.init();
    }

    // Run immediately
    this.executeCheck();

    this.intervalId = setInterval(() => {
      this.executeCheck();
    }, CHECK_INTERVAL_MS);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Order Worker stopped.');
  }

  private async executeCheck() {
      // Fix Safely as per issue #238
      if (typeof priceMonitor.checkPendingLimitOrders === 'function') {
          await priceMonitor.checkPendingLimitOrders();
      } else {
          console.error("⚠️ priceMonitor.checkPendingLimitOrders is not a function!");
      }
  }
}

export const orderWorker = new OrderWorker();
