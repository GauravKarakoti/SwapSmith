/**
 * Cron Jobs Initialization
 * 
 * This file should be imported once during application startup
 * to initialize all background cron jobs with graceful shutdown handling.
 * 
 * Usage in Next.js:
 * - Import in middleware.ts or a layout component
 * - Or create an API route that gets called on app start
 */

import { initializeCronManager } from './cron-manager';
import logger from './logger';

// Track if initialization has been done
let initialized = false;

/**
 * Initialize cron jobs (call once on app startup)
 */
export function initCronJobs() {
  // Prevent multiple initializations
  if (initialized) {
    logger.warn('[Init] Cron jobs already initialized');
    return;
  }

  // Only initialize in server-side environment
  if (typeof window !== 'undefined') {
    logger.warn('[Init] Skipping cron initialization in browser');
    return;
  }

  // Only initialize in production or when explicitly enabled
  const shouldInitialize = 
    process.env.NODE_ENV === 'production' ||
    process.env.ENABLE_CRON_JOBS === 'true';

  if (!shouldInitialize) {
    logger.info('[Init] Cron jobs disabled (set ENABLE_CRON_JOBS=true to enable in development)');
    return;
  }

  try {
    logger.info('[Init] Initializing cron jobs');
    initializeCronManager();
    initialized = true;
    logger.info('[Init] Cron jobs initialized successfully');
  } catch (error) {
    logger.error('[Init] Failed to initialize cron jobs', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Auto-initialize if this module is imported
// This ensures cron jobs start when the app starts
if (process.env.AUTO_INIT_CRON !== 'false') {
  initCronJobs();
}
