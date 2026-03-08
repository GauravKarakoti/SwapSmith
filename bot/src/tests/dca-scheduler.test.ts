import { DCAScheduler } from '../services/dca-scheduler';

// ── Database mock ──────────────────────────────────────────────────────────
const mockTransaction = jest.fn();
const mockDbUpdate = jest.fn();

jest.mock('../services/database', () => ({
  db: {
    transaction: (...args: any[]) => mockTransaction(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
  },
  dcaSchedules: {},
  orders: {},
  watchedOrders: {},
  getUser: jest.fn(),
}));

jest.mock('../services/sideshift-client', () => ({
  createQuote: jest.fn(),
  createOrder: jest.fn(),
}));

jest.mock('../services/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(() => ({})),
  lte: jest.fn(() => ({})),
  and: jest.fn(() => ({})),
  gt: jest.fn(() => ({})),
  inArray: jest.fn(() => ({})),
  sql: Object.assign(jest.fn((..._args: any[]) => ({})), { placeholder: jest.fn() }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTx() {
  const chain = { where: jest.fn().mockReturnThis() };
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          for: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue(chain) }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({ onConflictDoNothing: jest.fn().mockResolvedValue(undefined) }),
    }),
  };
}

function makeSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    telegramId: '12345',
    isActive: 1,
    fromAsset: 'USDC',
    fromNetwork: 'ethereum',
    toAsset: 'BTC',
    toNetwork: 'bitcoin',
    amountPerOrder: '50',
    intervalHours: 168,
    nextExecutionAt: new Date('2024-01-01T00:00:00Z'),
    ordersExecuted: 0,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DCAScheduler', () => {
  let scheduler: DCAScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new DCAScheduler();
  });

  describe('processSchedules — claim semantics', () => {
    it('claims due schedules by advancing nextExecutionAt inside a transaction', async () => {
      const schedule = makeSchedule();
      const tx = makeTx();

      // Simulate FOR UPDATE SKIP LOCKED returning one schedule
      tx.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest.fn().mockResolvedValue([schedule]),
          }),
        }),
      });

      // mockTransaction calls the callback with the tx object
      mockTransaction.mockImplementationOnce((cb: (tx: any) => Promise<any>) => cb(tx));

      // Stop executeSchedule from running (no user found → releaseLock path)
      const { getUser } = require('../services/database');
      (getUser as jest.Mock).mockResolvedValue(null);

      // releaseLock calls db.update
      const updateChain = { set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) };
      mockDbUpdate.mockReturnValue(updateChain);

      await scheduler.processSchedules();

      // The transaction was opened
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      // nextExecutionAt was updated (claim) inside the tx
      expect(tx.update).toHaveBeenCalled();
    });

    it('skips the update step when no schedules are due', async () => {
      const tx = makeTx();
      // FOR UPDATE SKIP LOCKED returns empty array
      tx.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockTransaction.mockImplementationOnce((cb: (tx: any) => Promise<any>) => cb(tx));

      await scheduler.processSchedules();

      // tx.update should NOT be called when there are no due schedules
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('handles concurrent access: only the first caller claims, the second sees empty result', async () => {
      const schedule = makeSchedule();

      const tx1 = makeTx();
      tx1.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest.fn().mockResolvedValue([schedule]),
          }),
        }),
      });

      const tx2 = makeTx();
      tx2.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest.fn().mockResolvedValue([]), // locked row skipped
          }),
        }),
      });

      // First call claims the row, second sees nothing (SKIP LOCKED)
      mockTransaction
        .mockImplementationOnce((cb: (tx: any) => Promise<any>) => cb(tx1))
        .mockImplementationOnce((cb: (tx: any) => Promise<any>) => cb(tx2));

      const { getUser } = require('../services/database');
      (getUser as jest.Mock).mockResolvedValue(null);

      const updateChain = { set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) };
      mockDbUpdate.mockReturnValue(updateChain);

      // Run two "concurrent" instances
      await scheduler.processSchedules();
      await scheduler.processSchedules();

      // Instance 1 claimed the row (tx.update called)
      expect(tx1.update).toHaveBeenCalled();
      // Instance 2 found nothing (tx.update not called)
      expect(tx2.update).not.toHaveBeenCalled();
    });

    it('logs an error when the transaction throws', async () => {
      mockTransaction.mockRejectedValueOnce(new Error('DB connection lost'));

      // Should not throw — error is caught internally
      await expect(scheduler.processSchedules()).resolves.not.toThrow();

      const logger = require('../services/logger').default;
      expect(logger.error).toHaveBeenCalledWith(
        'Error in DCA loop',
        expect.any(Error),
      );
    });
  });
});
