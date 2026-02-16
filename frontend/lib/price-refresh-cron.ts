import cron from 'node-cron';
import { getCoinPrices } from '@/utils/sideshift-client';
import { setCachedPrice, clearAllCachedPrices } from '@/lib/database';

const CACHE_TTL_MINUTES = 6 * 60; // 6 hours

let priceRefreshJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Fetches coin prices from CoinGecko API and stores them in the database
 */
async function refreshPricesFromSideShift() {
  console.log('[Price Refresh Cron] Starting price refresh from CoinGecko API...');
  
  try {
    // Step 1: Clear all existing cached prices
    console.log('[Price Refresh Cron] Clearing old cached prices...');
    await clearAllCachedPrices();
    
    // Step 2: Fetch fresh price data from CoinGecko (via getCoinPrices)
    console.log('[Price Refresh Cron] Fetching fresh coin prices from CoinGecko...');
    const freshPrices = await getCoinPrices();
    console.log(`[Price Refresh Cron] Fetched ${freshPrices.length} coins with prices`);
    
    // Log sample prices for debugging
    if (freshPrices.length > 0) {
      const sample = freshPrices[0];
      console.log(`[Price Refresh Cron] Sample: ${sample.coin} (${sample.name}) = $${sample.usdPrice || 'N/A'}`);
    }
    
    let cachedCount = 0;
    let failedCount = 0;
    
    // Step 3: Cache all prices with error handling
    for (const price of freshPrices) {
      try {
        await setCachedPrice(
          price.coin,
          price.network,
          price.name,
          price.usdPrice,
          price.btcPrice,
          price.available,
          CACHE_TTL_MINUTES
        );
        cachedCount++;
      } catch (err) {
        failedCount++;
        if (failedCount <= 5) { // Only log first 5 failures to avoid spam
          console.error(`[Price Refresh Cron] Failed to cache ${price.coin}/${price.network}:`, err);
        }
      }
    }
    
    console.log(`[Price Refresh Cron] Successfully cached ${cachedCount}/${freshPrices.length} prices (${failedCount} failed)`);
    console.log('[Price Refresh Cron] Price refresh completed successfully');
    
  } catch (error) {
    console.error('[Price Refresh Cron] Error during price refresh:', error);
    throw error;
  }
}

/**
 * Starts the cron job that refreshes prices every 6 hours
 */
export function startPriceRefreshCron() {
  if (priceRefreshJob) {
    console.log('[Price Refresh Cron] Cron job already running');
    return;
  }
  
  // Run every 6 hours at minute 0: "0 */6 * * *"
  // For testing, you can use "*/5 * * * *" for every 5 minutes
  priceRefreshJob = cron.schedule('0 */6 * * *', async () => {
    console.log('[Price Refresh Cron] Triggered scheduled price refresh');
    try {
      await refreshPricesFromSideShift();
    } catch (error) {
      console.error('[Price Refresh Cron] Scheduled refresh failed:', error);
    }
  });
  
  console.log('[Price Refresh Cron] Cron job started - will run every 6 hours');
  
  // Run immediately on startup to populate the cache
  console.log('[Price Refresh Cron] Running initial price refresh...');
  refreshPricesFromSideShift().catch(err => {
    console.error('[Price Refresh Cron] Initial refresh failed:', err);
  });
}

/**
 * Stops the cron job
 */
export function stopPriceRefreshCron() {
  if (priceRefreshJob) {
    priceRefreshJob.stop();
    priceRefreshJob = null;
    console.log('[Price Refresh Cron] Cron job stopped');
  }
}

/**
 * Manually trigger a price refresh (useful for testing or manual refresh)
 */
export async function triggerManualRefresh() {
  console.log('[Price Refresh Cron] Manual refresh triggered');
  await refreshPricesFromSideShift();
}
