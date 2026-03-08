# Graceful Shutdown Pattern

This document explains how to implement graceful shutdown for bot workers and services.

## Problem

Without proper shutdown handling:
- Background intervals continue running after process termination
- Database operations may be interrupted mid-transaction
- Active API calls are aborted without cleanup
- Memory leaks and orphaned processes

## Solution

The bot uses a centralized `ShutdownManager` that coordinates graceful shutdown across all services.

## Implementation Guide

### 1. For Services with Intervals (like OrderMonitor)

```typescript
export class MyWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private activeTasks = 0;
  private isShuttingDown = false;

  start(): void {
    this.isShuttingDown = false;
    this.intervalId = setInterval(() => this.tick(), 60000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async gracefulStop(timeoutMs: number = 10000): Promise<void> {
    this.isShuttingDown = true;
    
    // Stop accepting new work
    this.stop();
    
    // Wait for active tasks to complete
    const startTime = Date.now();
    while (this.activeTasks > 0) {
      if (Date.now() - startTime > timeoutMs) {
        logger.warn(`Timeout with ${this.activeTasks} tasks remaining`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async tick(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.activeTasks++;
    try {
      // Do work
    } finally {
      this.activeTasks--;
    }
  }
}
```

### 2. Register with ShutdownManager

In `bot.ts`:

```typescript
import { shutdownManager } from './services/shutdown-manager';

const myWorker = new MyWorker();
myWorker.start();

shutdownManager.register({
  name: 'MyWorker',
  stop: () => myWorker.gracefulStop(10000),
  timeout: 15000 // Max time to wait for shutdown
});
```

### 3. For Simple Services

If your service doesn't need to wait for active operations:

```typescript
shutdownManager.register({
  name: 'SimpleService',
  stop: () => {
    // Cleanup code
    clearInterval(myInterval);
  },
  timeout: 5000
});
```

## Existing Workers

The following workers should implement graceful shutdown:

### ✅ Implemented
- `OrderMonitor` - Waits for active polls to complete

### ⚠️ Needs Implementation
- `LimitOrderWorker` - Has `stop()` but doesn't wait for active checks
- `PriceAlertWorker` - Has `stop()` but doesn't wait for active checks
- `PortfolioRebalanceWorker` - Has `stop()` but doesn't wait for active rebalances
- `TrailingStopWorker` - Has `stop()` but doesn't wait for active checks
- `StakeOrderWorker` - Uses cron, needs graceful stop

## Testing Graceful Shutdown

```bash
# Start the bot
npm start

# In another terminal, send SIGTERM
kill -TERM <pid>

# Check logs for:
# - "Initiating graceful shutdown"
# - "Waiting for active operations"
# - "Graceful shutdown complete"
```

## Best Practices

1. **Track Active Operations**: Use a counter to track in-flight operations
2. **Set Timeouts**: Don't wait forever - set reasonable timeouts
3. **Stop Accepting New Work**: Set a flag to prevent new operations during shutdown
4. **Log Everything**: Log shutdown progress for debugging
5. **Test Regularly**: Ensure shutdown works under load

## Database Connections

Neon serverless connections don't need explicit closing, but ensure:
- All pending queries complete
- No transactions are left open
- Connection pool is drained

## Signal Handling

The bot handles these signals:
- `SIGTERM` - Graceful shutdown (Docker, Kubernetes)
- `SIGINT` - Ctrl+C in terminal
- `SIGUSR2` - Nodemon restart
- `uncaughtException` - Unhandled errors
- `unhandledRejection` - Unhandled promise rejections

## Troubleshooting

### Worker Won't Stop
- Check if `isShuttingDown` flag is being respected
- Verify timeout is sufficient for your operations
- Look for infinite loops or blocking operations

### Database Errors on Shutdown
- Ensure all queries use proper error handling
- Check for transactions that aren't committed
- Verify connection pool settings

### Process Hangs
- Increase timeout values
- Check for event listeners that aren't removed
- Look for intervals that aren't cleared

## Future Improvements

- [ ] Add metrics for shutdown duration
- [ ] Implement health checks during shutdown
- [ ] Add graceful shutdown to all workers
- [ ] Create automated tests for shutdown scenarios
