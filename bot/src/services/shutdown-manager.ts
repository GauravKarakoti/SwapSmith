/**
 * Shutdown Manager
 * 
 * Centralized graceful shutdown handler for all bot workers and services.
 * Ensures all background processes complete before process termination.
 */

import logger from './logger';

export interface ShutdownHandler {
  name: string;
  stop: () => Promise<void> | void;
  timeout?: number;
}

export class ShutdownManager {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;

  /**
   * Register a service or worker for graceful shutdown
   */
  register(handler: ShutdownHandler): void {
    this.handlers.push(handler);
    logger.info(`[ShutdownManager] Registered: ${handler.name}`);
  }

  /**
   * Execute graceful shutdown for all registered handlers
   */
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('[ShutdownManager] Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`[ShutdownManager] Initiating graceful shutdown (${signal})`);

    const results: Array<{ name: string; success: boolean; error?: Error }> = [];

    for (const handler of this.handlers) {
      const timeout = handler.timeout || 10000;
      
      try {
        logger.info(`[ShutdownManager] Stopping ${handler.name}...`);
        
        // Wrap stop call with timeout
        await Promise.race([
          Promise.resolve(handler.stop()),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
          )
        ]);

        results.push({ name: handler.name, success: true });
        logger.info(`[ShutdownManager] ✅ ${handler.name} stopped successfully`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        results.push({ name: handler.name, success: false, error: err });
        logger.error(`[ShutdownManager] ❌ ${handler.name} failed to stop:`, err.message);
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    logger.info(`[ShutdownManager] Shutdown complete: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
      logger.warn('[ShutdownManager] Some services failed to stop gracefully:', 
        results.filter(r => !r.success).map(r => r.name)
      );
    }
  }

  /**
   * Get shutdown status
   */
  isShutdown(): boolean {
    return this.isShuttingDown;
  }
}

/**
 * Global shutdown manager instance
 */
export const shutdownManager = new ShutdownManager();

/**
 * Register process signal handlers for graceful shutdown
 */
export function registerProcessHandlers(onShutdown: (signal: string) => Promise<void>): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

  signals.forEach(signal => {
    process.once(signal, async () => {
      logger.info(`[Process] Received ${signal}`);
      try {
        await onShutdown(signal);
        process.exit(0);
      } catch (error) {
        logger.error('[Process] Shutdown error:', error);
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('[Process] Uncaught exception:', error);
    onShutdown('uncaughtException').finally(() => process.exit(1));
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('[Process] Unhandled promise rejection:', { reason, promise });
    onShutdown('unhandledRejection').finally(() => process.exit(1));
  });

  logger.info('[Process] Signal handlers registered');
}
