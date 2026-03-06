import cron from 'node-cron';
import { getAllActivePriceAlerts, getCachedPrice, markPriceAlertTriggered } from '@/lib/database';
import { sendPriceAlertEmail } from '@/lib/email';
import logger from '@/lib/logger';

let priceAlertMonitorJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Check all active price alerts and trigger notifications when thresholds are crossed
 */
async function checkPriceAlerts() {
  logger.info('[Price Alert Monitor] Checking active price alerts');
  
  try {
    const activeAlerts = await getAllActivePriceAlerts();
    
    if (activeAlerts.length === 0) {
      logger.debug('[Price Alert Monitor] No active alerts to check');
      return;
    }
    
    logger.info('[Price Alert Monitor] Checking alerts', { count: activeAlerts.length });
    
    let triggeredCount = 0;
    let errorCount = 0;
    
    for (const alert of activeAlerts) {
      try {
        // Fetch current price from cache
        const priceData = await getCachedPrice(alert.coin, alert.network);
        
        if (!priceData || !priceData.usdPrice) {
          logger.warn('[Price Alert Monitor] No price data available', {
            coin: alert.coin,
            network: alert.network
          });
          continue;
        }
        
        const currentPrice = parseFloat(priceData.usdPrice);
        const targetPrice = parseFloat(alert.targetPrice as string);
        
        // Check if alert condition is met
        let shouldTrigger = false;
        let priceChange = '';
        
        if (alert.condition === 'gt' && currentPrice >= targetPrice) {
          shouldTrigger = true;
          const percentChange = ((currentPrice - targetPrice) / targetPrice * 100).toFixed(2);
          priceChange = `+${percentChange}%`;
        } else if (alert.condition === 'lt' && currentPrice <= targetPrice) {
          shouldTrigger = true;
          const percentChange = ((targetPrice - currentPrice) / targetPrice * 100).toFixed(2);
          priceChange = `-${percentChange}%`;
        }
        
        if (shouldTrigger) {
          logger.info('[Price Alert Monitor] Alert triggered', {
            alertId: alert.id,
            coin: alert.coin,
            condition: alert.condition,
            targetPrice,
            currentPrice
          });
          
          // Send email notification (if we have user email)
          // Note: We need to fetch user email from users table
          // For now, we'll just mark as triggered
          
          // Mark alert as triggered (deactivates it)
          await markPriceAlertTriggered(alert.id);
          triggeredCount++;
          
          // TODO: Send email notification
          // This requires fetching user email from users table
          // await sendPriceAlertEmail(userEmail, userName, alert.name, currentPrice.toString(), priceChange);
        }
        
      } catch (error) {
        errorCount++;
        logger.error('[Price Alert Monitor] Error checking alert', {
          alertId: alert.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    logger.info('[Price Alert Monitor] Alert check completed', {
      total: activeAlerts.length,
      triggered: triggeredCount,
      errors: errorCount
    });
    
  } catch (error) {
    logger.error('[Price Alert Monitor] Error in price alert monitoring', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Start the price alert monitoring cron job
 * Runs every 5 minutes to check price alerts
 */
export function startPriceAlertMonitor() {
  if (priceAlertMonitorJob) {
    logger.info('[Price Alert Monitor] Monitor already running');
    return;
  }
  
  // Run every 5 minutes: "*/5 * * * *"
  priceAlertMonitorJob = cron.schedule('*/5 * * * *', async () => {
    logger.info('[Price Alert Monitor] Triggered scheduled alert check');
    try {
      await checkPriceAlerts();
    } catch (error) {
      logger.error('[Price Alert Monitor] Scheduled check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  logger.info('[Price Alert Monitor] Monitor started - will run every 5 minutes');
  
  // Run immediately on startup
  logger.info('[Price Alert Monitor] Running initial alert check');
  checkPriceAlerts().catch(err => {
    logger.error('[Price Alert Monitor] Initial check failed', {
      error: err instanceof Error ? err.message : String(err)
    });
  });
}

/**
 * Stop the price alert monitoring cron job
 */
export function stopPriceAlertMonitor() {
  if (priceAlertMonitorJob) {
    priceAlertMonitorJob.stop();
    priceAlertMonitorJob = null;
    logger.info('[Price Alert Monitor] Monitor stopped');
  }
}

/**
 * Manually trigger a price alert check (useful for testing)
 */
export async function triggerManualAlertCheck() {
  logger.info('[Price Alert Monitor] Manual check triggered');
  await checkPriceAlerts();
}
