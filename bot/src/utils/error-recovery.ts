/**
 * Bot Error Recovery System
 *
 * Provides:
 * - Error recovery strategies for different failure types
 * - Transaction rollback support
 * - Idempotent operation tracking
 * - Graceful degradation strategies
 */

import logger from '../services/logger';

/**
 * Error recovery strategy types
 */
export enum RecoveryStrategy {
  RETRY = 'RETRY',
  ROLLBACK = 'ROLLBACK',
  COMPENSATE = 'COMPENSATE',
  DEGRADE = 'DEGRADE',
  FAIL_SAFE = 'FAIL_SAFE',
}

/**
 * Idempotency key tracking for distributed operations
 */
interface IdempotencyRecord {
  key: string;
  operation: string;
  status: 'pending' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Transaction rollback handler
 */
export interface RollbackHandler {
  operation: string;
  execute: () => Promise<void>;
}

/**
 * Recovery context for error handling
 */
export interface RecoveryContext {
  operationId: string;
  operationName: string;
  idempotencyKey?: string;
  rollbackHandlers: RollbackHandler[];
  attempts: number;
  maxAttempts: number;
  lastError?: Error | string;
}

/**
 * Error recovery manager
 */
export class ErrorRecoveryManager {
  private idempotencyMap = new Map<string, IdempotencyRecord>();
  private pendingOperations = new Set<string>();
  private readonly IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Execute operation with recovery support
   */
  async executeWithRecovery<T>(
    operationName: string,
    fn: (context: RecoveryContext) => Promise<T>,
    idempotencyKey?: string
  ): Promise<T> {
    const operationId = this.generateOperationId();
    const context: RecoveryContext = {
      operationId,
      operationName,
      idempotencyKey,
      rollbackHandlers: [],
      attempts: 0,
      maxAttempts: 3,
    };

    // Check idempotency
    if (idempotencyKey && this.idempotencyMap.has(idempotencyKey)) {
      const record = this.idempotencyMap.get(idempotencyKey)!;
      if (record.status === 'completed') {
        logger.info(`[Recovery] Returning cached result for idempotent operation: ${idempotencyKey}`);
        return record.result as T;
      }
      if (record.status === 'pending') {
        throw new Error(`Operation still in progress: ${idempotencyKey}`);
      }
    }

    // Mark operation as pending
    if (idempotencyKey) {
      this.idempotencyMap.set(idempotencyKey, {
        key: idempotencyKey,
        operation: operationName,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.IDEMPOTENCY_TTL_MS),
      });
    }

    this.pendingOperations.add(operationId);

    try {
      const result = await this.executeWithRetry(fn, context);

      // Mark as completed
      if (idempotencyKey) {
        const record = this.idempotencyMap.get(idempotencyKey)!;
        record.status = 'completed';
        record.result = result;
      }

      return result;
    } catch (error) {
      // Mark as failed
      if (idempotencyKey) {
        const record = this.idempotencyMap.get(idempotencyKey)!;
        record.status = 'failed';
        record.error = error instanceof Error ? error.message : String(error);
      }

      // Execute rollback handlers
      await this.rollback(context);

      throw error;
    } finally {
      this.pendingOperations.delete(operationId);
      this.cleanupExpiredIdempotencyRecords();
    }
  }

  /**
   * Execute with exponential backoff retry
   */
  private async executeWithRetry<T>(
    fn: (context: RecoveryContext) => Promise<T>,
    context: RecoveryContext
  ): Promise<T> {
    while (context.attempts < context.maxAttempts) {
      try {
        context.attempts++;
        logger.info(`[Recovery] Executing ${context.operationName} (attempt ${context.attempts}/${context.maxAttempts})`);
        return await fn(context);
      } catch (error) {
        context.lastError = error instanceof Error ? error : new Error(String(error));

        if (context.attempts < context.maxAttempts && this.isRetryable(error)) {
          const delay = this.calculateBackoffDelay(context.attempts);
          logger.warn(
            `[Recovery] ${context.operationName} failed, retrying in ${delay}ms`,
            { error: error instanceof Error ? error.message : error }
          );
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }

    throw new Error(`Max retries exceeded for ${context.operationName}`);
  }

  /**
   * Register rollback handler
   */
  registerRollback(context: RecoveryContext, handler: RollbackHandler): void {
    context.rollbackHandlers.push(handler);
    logger.debug(`[Recovery] Registered rollback handler: ${handler.operation}`);
  }

  /**
   * Execute rollback handlers in reverse order (LIFO)
   */
  private async rollback(context: RecoveryContext): Promise<void> {
    if (context.rollbackHandlers.length === 0) {
      return;
    }

    logger.info(`[Recovery] Executing rollback for ${context.operationName} (${context.rollbackHandlers.length} handlers)`);

    // LIFO - execute in reverse order
    for (let i = context.rollbackHandlers.length - 1; i >= 0; i--) {
      const handler = context.rollbackHandlers[i];
      try {
        logger.info(`[Recovery] Rolling back: ${handler?.operation}`);
        await handler?.execute();
      } catch (error) {
        logger.error(`[Recovery] Rollback failed for ${handler?.operation}`, error);
        // Continue with other rollbacks even if one fails
      }
    }
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Retry on network/timeout errors, not on validation/auth errors
      return (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('econnrefused') ||
        message.includes('enotfound')
      );
    }
    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    let delay = baseDelay * Math.pow(2, attempt - 1);
    delay = Math.min(delay, maxDelay);
    // Add jitter (±10%)
    delay = delay * (0.9 + Math.random() * 0.2);
    return delay;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up expired idempotency records
   */
  private cleanupExpiredIdempotencyRecords(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    this.idempotencyMap.forEach((record, key) => {
      if (record.expiresAt < now) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.idempotencyMap.delete(key);
    });

    if (keysToDelete.length > 0) {
      logger.debug(`[Recovery] Cleaned up ${keysToDelete.length} expired idempotency records`);
    }
  }

  /**
   * Get operation status
   */
  getOperationStatus(idempotencyKey: string): IdempotencyRecord | undefined {
    return this.idempotencyMap.get(idempotencyKey);
  }

  /**
   * Cancel pending operation
   */
  cancelOperation(operationId: string): void {
    this.pendingOperations.delete(operationId);
    logger.info(`[Recovery] Cancelled operation: ${operationId}`);
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      pendingOperations: this.pendingOperations.size,
      idempotencyRecords: this.idempotencyMap.size,
      expiredRecords: Array.from(this.idempotencyMap.values()).filter(
        r => r.expiresAt < new Date()
      ).length,
    };
  }
}

/**
 * DCA scheduler error recovery
 */
export class DCARecoveryStrategy {
  /**
   * Handle DCA execution failure with recovery
   */
  static async handleDCAFailure(
    scheduleId: number | string,
    userId: number | string,
    error: unknown,
    updateNextExecution: (scheduleId: number | string, nextExecution: Date) => Promise<void>
  ): Promise<{
    strategy: RecoveryStrategy;
    action: string;
    nextRetry?: Date;
  }> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[DCA Recovery] Schedule ${scheduleId} failed:`, error);

    // Transient network error - retry with backoff
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('ECONNREFUSED')
    ) {
      const nextRetry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      await updateNextExecution(scheduleId, nextRetry);
      return {
        strategy: RecoveryStrategy.RETRY,
        action: 'Scheduled retry in 5 minutes',
        nextRetry,
      };
    }

    // Quote error - retry but with longer backoff
    if (errorMessage.includes('quote')) {
      const nextRetry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await updateNextExecution(scheduleId, nextRetry);
      return {
        strategy: RecoveryStrategy.RETRY,
        action: 'Quote unavailable, retrying in 30 minutes',
        nextRetry,
      };
    }

    // Order creation failed - compensate by releasing lock
    if (errorMessage.includes('order')) {
      const nextRetry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await updateNextExecution(scheduleId, nextRetry);
      return {
        strategy: RecoveryStrategy.COMPENSATE,
        action: 'Order creation failed, will retry next interval',
        nextRetry,
      };
    }

    // Validation error - fail safe, disable schedule
    if (errorMessage.includes('wallet') || errorMessage.includes('invalid')) {
      return {
        strategy: RecoveryStrategy.FAIL_SAFE,
        action: 'Configuration issue detected, manual intervention required',
      };
    }

    // Unknown error - degrade gracefully
    return {
      strategy: RecoveryStrategy.DEGRADE,
      action: 'Unexpected error, skipping this execution',
    };
  }
}

/**
 * Order monitor error recovery
 */
export class OrderRecoveryStrategy {
  /**
   * Handle order monitoring failure
   */
  static async handleOrderFailure(
    orderId: string,
    error: unknown,
    maxRetries: number = 3
  ): Promise<{
    strategy: RecoveryStrategy;
    shouldRetry: boolean;
    reason: string;
  }> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[Order Recovery] Order ${orderId} monitoring failed:`, error);

    // Network issues - retry
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('ENOTFOUND')
    ) {
      return {
        strategy: RecoveryStrategy.RETRY,
        shouldRetry: true,
        reason: 'Transient network error, will retry',
      };
    }

    // API rate limit - back off
    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return {
        strategy: RecoveryStrategy.RETRY,
        shouldRetry: true,
        reason: 'Rate limited, backing off',
      };
    }

    // Order not found - check state
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return {
        strategy: RecoveryStrategy.COMPENSATE,
        shouldRetry: false,
        reason: 'Order not found, checking alternate sources',
      };
    }

    // Invalid response - don't retry
    if (errorMessage.includes('invalid') || errorMessage.includes('parse')) {
      return {
        strategy: RecoveryStrategy.FAIL_SAFE,
        shouldRetry: false,
        reason: 'Invalid response format, manual review needed',
      };
    }

    return {
      strategy: RecoveryStrategy.DEGRADE,
      shouldRetry: false,
      reason: 'Skipping this check, will retry next interval',
    };
  }
}

// Export singleton instance
export const errorRecoveryManager = new ErrorRecoveryManager();
