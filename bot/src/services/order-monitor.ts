import type { SideShiftOrderStatus } from './sideshift-client';
import type { Order } from './database';

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

/** Dependencies injected into the monitor (makes it testable) */
export interface OrderMonitorDeps {
    getOrderStatus: (orderId: string) => Promise<SideShiftOrderStatus>;
    updateOrderStatus: (orderId: string, newStatus: string) => Promise<void>;
    getPendingOrders: () => Promise<Order[]>;
    onStatusChange: StatusChangeCallback;
}

// --- Constants ---

/** Terminal statuses — orders in these states stop being tracked */
export const TERMINAL_STATUSES = new Set(['settled', 'expired', 'refunded', 'failed']);

/** Maximum concurrent API calls to SideShift */
const MAX_CONCURRENT = 5;

/** How often the tick loop runs (ms) */
const TICK_INTERVAL = 10_000; // 10 seconds

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

    constructor(deps: OrderMonitorDeps) {
        this.deps = deps;
    }

    // --- Public API ---

    /** Start the background polling loop. */
    start(): void {
        if (this.tickTimer) return; // already running
        console.log(`[OrderMonitor] Started — tracking ${this.tracked.size} order(s)`);
        this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL);
    }

    /** Stop the polling loop. Safe to call multiple times. */
    stop(): void {
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
            console.log('[OrderMonitor] Stopped');
        }
    }

    /** Add a new order to the tracking map. */
    trackOrder(orderId: string, telegramId: number, createdAt?: Date): void {
        if (this.tracked.has(orderId)) return;
        this.tracked.set(orderId, {
            orderId,
            telegramId,
            createdAt: createdAt ?? new Date(),
            lastChecked: 0,
            lastStatus: 'pending',
        });
        console.log(`[OrderMonitor] Now tracking order ${orderId} (total: ${this.tracked.size})`);
    }

    /** Remove an order from the tracking map. */
    untrackOrder(orderId: string): void {
        this.tracked.delete(orderId);
    }

    /** Reload all non-terminal orders from the database (call on startup). */
    async loadPendingOrders(): Promise<void> {
        try {
            const pendingOrders = await this.deps.getPendingOrders();
            for (const order of pendingOrders) {
                this.trackOrder(
                    order.sideshiftOrderId,
                    order.telegramId,
                    order.createdAt ? new Date(order.createdAt) : undefined
                );
                // Preserve the DB status
                const tracked = this.tracked.get(order.sideshiftOrderId);
                if (tracked) tracked.lastStatus = order.status;
            }
            console.log(`[OrderMonitor] Loaded ${pendingOrders.length} pending order(s) from DB`);
        } catch (error) {
            console.error('[OrderMonitor] Failed to load pending orders:', error);
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
                // Status changed — update DB and notify
                order.lastStatus = newStatus;
                await this.deps.updateOrderStatus(order.orderId, newStatus);
                this.deps.onStatusChange(order.telegramId, order.orderId, oldStatus, newStatus, status);

                // If terminal, stop tracking
                if (TERMINAL_STATUSES.has(newStatus)) {
                    this.untrackOrder(order.orderId);
                    console.log(`[OrderMonitor] Order ${order.orderId} reached terminal state: ${newStatus}`);
                }
            }
        } catch (error) {
            console.error(`[OrderMonitor] Error polling order ${order.orderId}:`, error);
            // Don't remove — will retry on next tick
        } finally {
            this.activePollCount--;
        }
    }
}
