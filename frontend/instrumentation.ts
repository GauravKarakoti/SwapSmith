/**
 * Next.js Instrumentation Hook
 * Runs only in production Node.js runtime
 */

export async function register() {
  // 🚨 Prevent running during Next dev server
  if (process.env.NODE_ENV !== "production") {
    console.log("[Instrumentation] Skipping cron in dev mode");
    return;
  }

  // Run only in Node runtime
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { startPriceRefreshCron } = await import("./lib/price-refresh-cron");

    console.log("[Instrumentation] Starting price refresh cron...");
    startPriceRefreshCron();
  } catch (err) {
    console.log("[Instrumentation] Cron skipped:", err);
  }
}
