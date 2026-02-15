import { OrderMonitor, getBackoffInterval, TERMINAL_STATUSES } from '../services/order-monitor';
import type { OrderMonitorDeps } from '../services/order-monitor';
import type { SideShiftOrderStatus } from '../services/sideshift-client';

// --- Helpers ---

function createMockDeps(overrides?: Partial<OrderMonitorDeps>): OrderMonitorDeps {
    return {
        getOrderStatus: jest.fn().mockResolvedValue({ id: 'test', status: 'pending' } as SideShiftOrderStatus),
        updateOrderStatus: jest.fn().mockResolvedValue(undefined),
        getPendingOrders: jest.fn().mockResolvedValue([]),
        onStatusChange: jest.fn(),
        ...overrides,
    };
}

function createMockOrder(overrides?: Record<string, unknown>) {
    return {
        id: 1,
        telegramId: 12345,
        sideshiftOrderId: 'order-abc',
        quoteId: 'quote-1',
        fromAsset: 'ETH',
        fromNetwork: 'ethereum',
        fromAmount: 1,
        toAsset: 'BTC',
        toNetwork: 'bitcoin',
        settleAmount: '0.05',
        depositAddress: '0xabc',
        depositMemo: null,
        status: 'pending',
        txHash: null,
        createdAt: new Date(),
        ...overrides,
    };
}

// --- Tests ---

describe('getBackoffInterval', () => {
    it('returns 15s for orders younger than 5 minutes', () => {
        expect(getBackoffInterval(0)).toBe(15_000);
        expect(getBackoffInterval(60_000)).toBe(15_000);        // 1 min
        expect(getBackoffInterval(4 * 60_000)).toBe(15_000);    // 4 min
    });

    it('returns 60s for orders between 5 and 30 minutes old', () => {
        expect(getBackoffInterval(5 * 60_000)).toBe(60_000);    // exactly 5 min
        expect(getBackoffInterval(15 * 60_000)).toBe(60_000);   // 15 min
        expect(getBackoffInterval(29 * 60_000)).toBe(60_000);   // 29 min
    });

    it('returns 5 min for orders between 30 min and 2 hours old', () => {
        expect(getBackoffInterval(30 * 60_000)).toBe(5 * 60_000);   // 30 min
        expect(getBackoffInterval(60 * 60_000)).toBe(5 * 60_000);   // 1 hr
        expect(getBackoffInterval(119 * 60_000)).toBe(5 * 60_000);  // 1h59m
    });

    it('returns 15 min for orders older than 2 hours', () => {
        expect(getBackoffInterval(2 * 3_600_000)).toBe(15 * 60_000);   // exactly 2 hr
        expect(getBackoffInterval(5 * 3_600_000)).toBe(15 * 60_000);   // 5 hr
        expect(getBackoffInterval(24 * 3_600_000)).toBe(15 * 60_000);  // 24 hr
    });
});

describe('TERMINAL_STATUSES', () => {
    it('contains settled, expired, refunded, and failed', () => {
        expect(TERMINAL_STATUSES.has('settled')).toBe(true);
        expect(TERMINAL_STATUSES.has('expired')).toBe(true);
        expect(TERMINAL_STATUSES.has('refunded')).toBe(true);
        expect(TERMINAL_STATUSES.has('failed')).toBe(true);
    });

    it('does not contain non-terminal statuses', () => {
        expect(TERMINAL_STATUSES.has('pending')).toBe(false);
        expect(TERMINAL_STATUSES.has('waiting')).toBe(false);
        expect(TERMINAL_STATUSES.has('processing')).toBe(false);
    });
});

describe('OrderMonitor', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    describe('trackOrder / untrackOrder', () => {
        it('adds an order to the tracked map', () => {
            const monitor = new OrderMonitor(createMockDeps());
            monitor.trackOrder('order-1', 100);
            expect(monitor.trackedCount).toBe(1);
            expect(monitor.getTrackedOrderIds()).toContain('order-1');
        });

        it('does not duplicate an already-tracked order', () => {
            const monitor = new OrderMonitor(createMockDeps());
            monitor.trackOrder('order-1', 100);
            monitor.trackOrder('order-1', 100);
            expect(monitor.trackedCount).toBe(1);
        });

        it('removes an order from tracking', () => {
            const monitor = new OrderMonitor(createMockDeps());
            monitor.trackOrder('order-1', 100);
            monitor.untrackOrder('order-1');
            expect(monitor.trackedCount).toBe(0);
        });
    });

    describe('loadPendingOrders', () => {
        it('loads orders from the database', async () => {
            const mockOrders = [
                createMockOrder({ sideshiftOrderId: 'order-a', status: 'waiting' }),
                createMockOrder({ sideshiftOrderId: 'order-b', status: 'processing' }),
            ];
            const deps = createMockDeps({ getPendingOrders: jest.fn().mockResolvedValue(mockOrders) });
            const monitor = new OrderMonitor(deps);

            await monitor.loadPendingOrders();

            expect(monitor.trackedCount).toBe(2);
            expect(monitor.getTrackedOrderIds()).toContain('order-a');
            expect(monitor.getTrackedOrderIds()).toContain('order-b');
        });

        it('handles DB errors gracefully', async () => {
            const deps = createMockDeps({ getPendingOrders: jest.fn().mockRejectedValue(new Error('DB down')) });
            const monitor = new OrderMonitor(deps);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await monitor.loadPendingOrders();

            expect(monitor.trackedCount).toBe(0);
            consoleSpy.mockRestore();
        });
    });

    describe('start / stop', () => {
        it('starts and stops without errors', () => {
            const monitor = new OrderMonitor(createMockDeps());
            monitor.start();
            monitor.stop();
        });

        it('is idempotent on multiple start calls', () => {
            const monitor = new OrderMonitor(createMockDeps());
            monitor.start();
            monitor.start(); // should not throw
            monitor.stop();
        });

        it('is idempotent on multiple stop calls', () => {
            const monitor = new OrderMonitor(createMockDeps());
            monitor.start();
            monitor.stop();
            monitor.stop(); // should not throw
        });
    });

    describe('status change detection', () => {
        it('calls onStatusChange when status changes', async () => {
            jest.useFakeTimers();

            const onStatusChange = jest.fn();
            const getOrderStatus = jest.fn().mockResolvedValue({
                id: 'order-1', status: 'settled',
                depositCoin: 'ETH', depositNetwork: 'ethereum',
                settleCoin: 'BTC', settleNetwork: 'bitcoin',
            } as unknown as SideShiftOrderStatus);

            const deps = createMockDeps({ getOrderStatus, onStatusChange });
            const monitor = new OrderMonitor(deps);

            // Track an order created "just now"
            monitor.trackOrder('order-1', 100, new Date());
            monitor.start();

            // Advance past the tick interval (10s)
            jest.advanceTimersByTime(11_000);
            // Wait for promises to flush
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            monitor.stop();

            expect(getOrderStatus).toHaveBeenCalledWith('order-1');
            expect(onStatusChange).toHaveBeenCalledWith(
                100, 'order-1', 'pending', 'settled',
                expect.objectContaining({ status: 'settled' })
            );
        });

        it('removes orders that reach a terminal state', async () => {
            jest.useFakeTimers();

            const getOrderStatus = jest.fn().mockResolvedValue({
                id: 'order-x', status: 'expired',
            } as unknown as SideShiftOrderStatus);

            const deps = createMockDeps({ getOrderStatus });
            const monitor = new OrderMonitor(deps);

            monitor.trackOrder('order-x', 200, new Date());
            expect(monitor.trackedCount).toBe(1);

            monitor.start();
            jest.advanceTimersByTime(11_000);
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            monitor.stop();

            // Order should have been removed from tracking
            expect(monitor.trackedCount).toBe(0);
        });

        it('does NOT call onStatusChange when status is unchanged', async () => {
            jest.useFakeTimers();

            const onStatusChange = jest.fn();
            const getOrderStatus = jest.fn().mockResolvedValue({
                id: 'order-1', status: 'pending', // same as initial
            } as unknown as SideShiftOrderStatus);

            const deps = createMockDeps({ getOrderStatus, onStatusChange });
            const monitor = new OrderMonitor(deps);

            monitor.trackOrder('order-1', 100, new Date());
            monitor.start();

            jest.advanceTimersByTime(11_000);
            await Promise.resolve();
            await Promise.resolve();

            monitor.stop();

            expect(onStatusChange).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('keeps polling after an API error', async () => {
            jest.useFakeTimers();

            const getOrderStatus = jest.fn()
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({ id: 'order-1', status: 'settled' } as unknown as SideShiftOrderStatus);

            const deps = createMockDeps({ getOrderStatus });
            const monitor = new OrderMonitor(deps);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            monitor.trackOrder('order-1', 100, new Date());
            monitor.start();

            // First tick — error
            jest.advanceTimersByTime(11_000);
            await Promise.resolve();
            await Promise.resolve();
            expect(monitor.trackedCount).toBe(1); // still tracked

            // Second tick — success with terminal state
            jest.advanceTimersByTime(16_000);
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            monitor.stop();
            consoleSpy.mockRestore();
        });
    });
});
