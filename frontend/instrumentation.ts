/**
 * Next.js Instrumentation Hook
 * This file is automatically executed on server startup
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run in Node.js runtime (not Edge runtime)
    const { startPriceRefreshCron } = await import('./lib/price-refresh-cron');
    
    console.log('[Instrumentation] Starting price refresh cron service on server startup...');
    startPriceRefreshCron();
  }
}
