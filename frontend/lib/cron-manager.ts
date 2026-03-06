/**
 * Centralized Cron Job Manager
 * 
 * Manages all background cron jobs and handles graceful shutdown
 * to prevent orphaned processes, memory leaks, and incomplete operations.
 */

import { startPriceRefreshCron, stopPriceRefreshCron } from './price-refresh-cron';
import { stopAllJobs as stopNotificationJobs } from './notification-scheduler';
import logger from './logger';

// Track if shutdown is in progress
let isShuttingDown = false;

// Track if cron jobs have been started
let cronjobsStarted = false;

/**
 * Start all background cron jobs
 */
export function startAllCronJobs() {
  if (cronjobsStarted) {
    logger.warn('[Cron Manager] Cron jobs already started');
    return;
  }

  logger.info('[Cron Manager] Starting all background cron jobs');

  try {
    // Start price refresh cron (runs every 6 hours)
    startPriceRefreshCron();
    logger.info('[Cron Manager] Price refresh cron started');

    // Start price alert monitor if available (runs every 5 minutes)
    try {
      const { startPriceAlertMonitor } = require('./price-alert-monitor');
      startPriceAlertMonitor();
      logger.info('[Cron Manager] Price alert monitor started');
    } catch (error) {
      logger.warn('[Cron Manager] Price alert monitor not available');
    }

    cronjobsStarted = true;
    logger.info('[Cron Manager] All cron jobs started successfully');
  } catch (error) {
    logger.error('[Cron Manager] Error starting cron jobs', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Stop all background cron jobs
 */
export function stopAllCronJobs() {
  if (!cronjobsStarted) {
    logger.warn('[Cron Manager] Cron jobs not started, nothing to stop');
    return;
  }

  logger.info('[Cron Manager] Stopping all background cron jobs');

  try {
    // Stop price refresh cron
    stopPriceRefreshCron();
    logger.info('[Cron Manager] Price refresh cron stopped');

    // Stop price alert monitor if available
    try {
      const { stopPriceAlertMonitor } = require('./price-alert-monitor');
      stopPriceAlertMonitor();
      logger.info('[Cron Manager] Price alert monitor stopped');
    } catch (error) {
      logger.warn('[Cron Manager] Price alert monitor not available');
    }

    // Stop notification scheduler jobs
    stopNotificationJobs();
    logger.info('[Cron Manager] Notification jobs stopped');

    cronjobsStarted = false;
    logger.info('[Cron Manager] All cron jobs stopped successfully');
  } catch (error) {
    logger.error('[Cron Manager] Error stopping cron jobs', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Graceful shutdown handler
 * Stops all cron jobs and cleans up resources
 */
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn('[Cron Manager] Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info('[Cron Manager] Graceful shutdown initiated', { signal });

  try {
    // Stop all cron jobs
    stopAllCronJobs();

    // Give ongoing operations time to complete
    logger.info('[Cron Manager] Waiting for ongoing operations to complete');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Note: Database connections are managed by Neon serverless
    // and don't need explicit closing in serverless environments

    logger.info('[Cron Manager] Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('[Cron Manager] Error during graceful shutdown', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

/**
 * Register process signal handlers for graceful shutdown
 */
export function registerShutdownHandlers() {
  // SIGTERM - Graceful shutdown (Docker, Kubernetes, systemd)
  process.on('SIGTERM', () => {
    logger.info('[Cron Manager] SIGTERM received');
    gracefulShutdown('SIGTERM');
  });

  // SIGINT - Ctrl+C in terminal
  process.on('SIGINT', () => {
    logger.info('[Cron Manager] SIGINT received');
    gracefulShutdown('SIGINT');
  });

  // SIGUSR2 - Used by nodemon for restarts
  process.on('SIGUSR2', () => {
    logger.info('[Cron Manager] SIGUSR2 received (nodemon restart)');
    gracefulShutdown('SIGUSR2');
  });

  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('[Cron Manager] Uncaught exception', {
      error: error.message,
      stack: error.stack
    });
    gracefulShutdown('uncaughtException');
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('[Cron Manager] Unhandled promise rejection', {
      reason: String(reason),
      promise: String(promise)
    });
    gracefulShutdown('unhandledRejection');
  });

  logger.info('[Cron Manager] Shutdown handlers registered');
}

/**
 * Initialize cron manager
 * Call this once during application startup
 */
export function initializeCronManager() {
  logger.info('[Cron Manager] Initializing cron manager');

  // Register shutdown handlers
  registerShutdownHandlers();

  // Start all cron jobs
  startAllCronJobs();

  logger.info('[Cron Manager] Cron manager initialized successfully');
}

/**
 * Get status of cron jobs
 */
export function getCronJobsStatus() {
  return {
    started: cronjobsStarted,
    shuttingDown: isShuttingDown
  };
}
