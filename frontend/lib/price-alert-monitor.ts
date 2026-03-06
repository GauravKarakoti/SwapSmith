import logger from './logger';

// Track the interval ID so we can stop it gracefully
let monitorInterval: NodeJS.Timeout | null = null;

// Runs every 5 minutes (as specified in cron-manager.ts)
const MONITOR_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Core logic to check prices and trigger alerts
 */
async function processPriceAlerts() {
  try {
    logger.info('[Price Alert Monitor] Running price alert checks...');
    
    // TODO: Implement your actual price alert logic here. 
    // Example flow:
    // 1. Fetch active alerts from your database (e.g., MongoDB/Postgres)
    // 2. Fetch current prices for the relevant assets
    // 3. Compare current prices against alert thresholds
    // 4. Trigger notifications (Email, Push, or in-app) for met conditions
    // 5. Mark triggered alerts as 'completed' or 'notified' in the database

  } catch (error) {
    logger.error('[Price Alert Monitor] Error processing price alerts', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Starts the background price alert monitor
 */
export function startPriceAlertMonitor() {
  if (monitorInterval) {
    logger.warn('[Price Alert Monitor] Monitor is already running');
    return;
  }

  logger.info('[Price Alert Monitor] Starting monitor (interval: 5 minutes)');

  // Run immediately on startup
  processPriceAlerts();

  // Schedule recurring execution
  monitorInterval = setInterval(processPriceAlerts, MONITOR_INTERVAL_MS);
}

/**
 * Stops the background price alert monitor
 */
export function stopPriceAlertMonitor() {
  if (!monitorInterval) {
    logger.warn('[Price Alert Monitor] Monitor is not running, nothing to stop');
    return;
  }

  logger.info('[Price Alert Monitor] Stopping monitor');
  clearInterval(monitorInterval);
  monitorInterval = null;
}