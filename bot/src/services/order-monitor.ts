import type { SideShiftOrderStatus } from './sideshift-client';
import { RateLimitError } from './sideshift-client';
import type { Order } from './database';
import { TERMINAL_STATUSES_LIST } from '../constants';
import logger from './logger';
import { reputationService } from './reputation-service';

// --- Types ---

/** An order being tracked by the monitor */
interface TrackedOrder {
    orderId: string;
    telegramId: number;
    createdAt: Date;
    lastChecked: number;   // timestamp of last poll
    lastStatus: string;
}

/** Callback fired when an order's status changes */
export type StatusChangeCallback = (
    telegramId: number,
    orderId: string,
    oldStatus: string,
    newStatus: string,
    orderDetails: SideShiftOrderStatus
) => void;

/** Structural type for records returned by getPendingWatchedOrders */
export interface WatchedOrderRecord {
    sideshiftOrderId: string;
    telegramId: number;
    lastStatus: string;
    createdAt?: Date | null;
}

/** Dependencies injected into the monitor (makes it testable) */
export interface OrderMonitorDeps {
    getOrderStatus: (orderId: string) => Promise<SideShiftOrderStatus>;
    updateOrderStatus: (orderId: string, newStatus: string) => Promise<void>;
    updateWatchedOrderStatus: (orderId: string, newStatus: string) => Promise<void>;
    getPendingOrders: () => Promise<Order[]>;
    getPendingWatchedOrders: () => Promise<WatchedOrderRecord[]>;
    addWatchedOrder: (telegramId: number, orderId: string, initialStatus: string) => Promise<void>;
    onStatusChange: StatusChangeCallback;
}

// --- Constants ---

/** Terminal statuses — orders in these states stop being tracked */
export const TERMINAL_STATUSES = new Set(TERMINAL_STATUSES_LIST);

/** Maximum concurrent API calls to SideShift */
const MAX_CONCURRENT = parseInt(process.env['MAX_CONCURRENT_ORDERS']!, 10);

/** How often the tick loop runs (ms) */
const TICK_INTERVAL = parseInt(process.env['ORDER_MONITOR_TICK_INTERVAL_MS']!, 10);

// --- Backoff Logic ---

/**
 * Returns the polling interval (ms) for an order based on its age.
 * Fresher orders are polled more aggressively; older orders back off.
 *
 *   Age < 5 min   → every 15s
 *   Age < 30 min  → every 60s
 *   Age < 2 hr    → every 5 min
 *   Age >= 2 hr   → every 15 min
 */
export function getBackoffInterval(ageMs: number): number {
    if (ageMs < 5 * 60_000) return 15_000;          // < 5 min  → 15s
    if (ageMs < 30 * 60_000) return 60_000;          // < 30 min → 1 min
    if (ageMs < 2 * 3_600_000) return 5 * 60_000;    // < 2 hr   → 5 min
    return 15 * 60_000;                               // >= 2 hr  → 15 min
}

// --- OrderMonitor Class ---

export class OrderMonitor {
    private tracked: Map<string, TrackedOrder> = new Map();
    private tickTimer: ReturnType<typeof setInterval> | null = null;
    private activePollCount = 0;
    private deps: OrderMonitorDeps;
    private rateLimitCooldownUntil: number | null = null; // timestamp when cooldown ends
    private isShuttingDown = false;

    constructor(deps: OrderMonitorDeps) {
        this.deps = deps;
    }

    // --- Public API ---

    /** Start the background polling loop. */
    start(): void {
        if (this.tickTimer) return; // already running
        this.isShuttingDown = false;
        logger.info(`[OrderMonitor] Started — tracking ${this.tracked.size} order(s)`);
        this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL);

    }

    /** Stop the polling loop. Safe to call multiple times. */
    stop(): void {
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
            logger.info('[OrderMonitor] Stopped');
        }

    }

    /** 
     * Gracefully stop the polling loop and wait for active polls to complete.
     * Returns a promise that resolves when all active operations are done.
     */
    async gracefulStop(timeoutMs: number = 10000): Promise<void> {
        logger.info('[OrderMonitor] Initiating graceful shutdown...');
        this.isShuttingDown = true;

        // Stop accepting new ticks
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }

        // Wait for active polls to complete with timeout
        const startTime = Date.now();
        while (this.activePollCount > 0) {
            if (Date.now() - startTime > timeoutMs) {
                logger.warn(`[OrderMonitor] Graceful shutdown timeout after ${timeoutMs}ms with ${this.activePollCount} active polls remaining`);
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        logger.info(`[OrderMonitor] Graceful shutdown complete. Tracked orders: ${this.tracked.size}, Active polls: ${this.activePollCount}`);
    }

    /** Add a new order to the tracking map and persist it. */
    trackOrder(orderId: string, telegramId: number, createdAt?: Date): void {
        if (this.tracked.has(orderId)) return;
        this.tracked.set(orderId, {
            orderId,
            telegramId,
            createdAt: createdAt ?? new Date(),
            lastChecked: 0,
            lastStatus: 'pending',
        });

        // Persist to watched_orders database table for crash recovery
        this.deps.addWatchedOrder(telegramId, orderId, 'pending').catch(err => {
            logger.error(`[OrderMonitor] Failed to persist watched order ${orderId}:`, err);
        });

        logger.info(`[OrderMonitor] Now tracking order ${orderId} (total: ${this.tracked.size})`);
    }


    /** Remove an order from the tracking map. */
    untrackOrder(orderId: string): void {
        this.tracked.delete(orderId);
    }

    /** Reload all non-terminal orders from the database (call on startup). */
    async loadPendingOrders(): Promise<void> {
        try {
            // Load from original orders table
            const pendingOrders = await this.deps.getPendingOrders();
            let loadedCount = 0;

            for (const order of pendingOrders) {
                if (!this.tracked.has(order.sideshiftOrderId)) {
                    this.tracked.set(order.sideshiftOrderId, {
                        orderId: order.sideshiftOrderId,
                        telegramId: order.telegramId,
                        createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
                        lastChecked: 0,
                        lastStatus: order.status,
                    });
                    loadedCount++;
                }
            }

            // Also load from watched_orders table (which captures mid-flight swaps)
            const pendingWatched = await this.deps.getPendingWatchedOrders();
            for (const order of pendingWatched) {
                if (!this.tracked.has(order.sideshiftOrderId)) {
                    this.tracked.set(order.sideshiftOrderId, {
                        orderId: order.sideshiftOrderId,
                        telegramId: order.telegramId,
                        createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
                        lastChecked: 0,
                        lastStatus: order.lastStatus,
                    });
                    loadedCount++;
                }
            }

            logger.info(`[OrderMonitor] Loaded ${loadedCount} pending order(s) from DB`);
        } catch (error) {
            logger.error('[OrderMonitor] Failed to load pending orders:', error);
        }

    }

    /** Reconcile in-memory state with the database and API. Useful for missed webhooks or crashed states. */
    async reconcile(): Promise<void> {
        logger.info(`[OrderMonitor] Running hourly reconciliation...`);
        try {
            await this.loadPendingOrders(); // Reload any missing from DB

            // Force a poll on all pending orders immediately, but respect MAX_CONCURRENT
            const allTracked = Array.from(this.tracked.values());
            const total = allTracked.length;
            const batchSize = MAX_CONCURRENT;

            for (let i = 0; i < total; i += batchSize) {
                const batch = allTracked.slice(i, i + batchSize);
                await Promise.allSettled(batch.map(order => this.pollOrder(order)));
            }
            logger.info(`[OrderMonitor] Reconciliation complete for ${allTracked.length} orders.`);
        } catch (error) {
            logger.error(`[OrderMonitor] Reconciliation failed:`, error);
        }
    }

    /** Returns the number of orders currently being tracked. */
    get trackedCount(): number {
        return this.tracked.size;
    }

    /** Returns a snapshot of tracked order IDs (useful for testing/debugging). */
    getTrackedOrderIds(): string[] {
        return Array.from(this.tracked.keys());
    }

    // --- Internal ---

    /** Single tick: evaluate which orders need polling and poll them. */
    private async tick(): Promise<void> {
        // Skip polling if rate-limited
        if (this.rateLimitCooldownUntil !== null) {
            const now = Date.now();
            if (now < this.rateLimitCooldownUntil) {
                const remainingMs = this.rateLimitCooldownUntil - now;
                const remainingSec = Math.ceil(remainingMs / 1000);
                logger.debug(`[OrderMonitor] Skipping tick — rate-limited for ${remainingSec} more seconds.`);
                return;
            }
            // Cooldown expired
            this.rateLimitCooldownUntil = null;
            logger.info('[OrderMonitor] Rate-limit cooldown expired. Resuming polling.');
        }
        
        // Skip tick if shutting down
        if (this.isShuttingDown) {
            return;
        }

        const now = Date.now();
        const toPoll: TrackedOrder[] = [];

        for (const order of this.tracked.values()) {
            const ageMs = now - order.createdAt.getTime();
            const interval = getBackoffInterval(ageMs);
            const elapsed = now - order.lastChecked;

            if (elapsed >= interval) {
                toPoll.push(order);
            }
        }

        if (toPoll.length === 0) return;

        // Respect concurrency cap
        const batch = toPoll.slice(0, MAX_CONCURRENT - this.activePollCount);
        if (batch.length === 0) return;

        await Promise.allSettled(batch.map(order => this.pollOrder(order)));
    }

    /** Poll a single order's status from SideShift. */
    private async pollOrder(order: TrackedOrder): Promise<void> {
        this.activePollCount++;
        try {
            const status = await this.deps.getOrderStatus(order.orderId);
            order.lastChecked = Date.now();

            const newStatus = status.status;
            const oldStatus = order.lastStatus;

            if (newStatus !== oldStatus) {
                // Status changed — persist to DB first, then notify
                order.lastStatus = newStatus;

                try {
                    await Promise.all([
                        this.deps.updateOrderStatus(order.orderId, newStatus),
                        this.deps.updateWatchedOrderStatus(order.orderId, newStatus)
                    ]);
                } catch (err) {
                    logger.error(`[OrderMonitor] Failed to persist status update for ${order.orderId}:`, err);
                    return; // Don't notify when DB write failed — the next polling cycle will retry
                }

                this.deps.onStatusChange(order.telegramId, order.orderId, oldStatus, newStatus, status);

                // If terminal, stop tracking
                if (TERMINAL_STATUSES.has(newStatus)) {
                    this.untrackOrder(order.orderId);
                    logger.info(`[OrderMonitor] Order ${order.orderId} reached terminal state: ${newStatus}`);

                    // Hook into reputation system
                    if (newStatus === 'settled') {
                        reputationService.recordSwapOutcome(order.telegramId.toString(), true);
                    } else if (newStatus === 'failed' || newStatus === 'return_completed') {
                        reputationService.recordSwapOutcome(order.telegramId.toString(), false);
                    }
                }
            }
        } catch (error) {
            // Handle rate-limit errors specially
            if (error instanceof RateLimitError) {
                const cooldownMs = error.retryAfter * 1000;
                this.rateLimitCooldownUntil = Date.now() + cooldownMs;
                logger.warn(
                    `[OrderMonitor] ⚠️  SideShift API rate limit exceeded (HTTP 429). ` +
                    `Pausing all polling for ${error.retryAfter} seconds.`
                );
                // Don't remove order — will retry after cooldown
            } else {
                logger.error(`[OrderMonitor] Error polling order ${order.orderId}:`, error);
                // Don't remove — will retry on next tick
            }
        } finally {
            this.activePollCount--;
        }
    }
}
