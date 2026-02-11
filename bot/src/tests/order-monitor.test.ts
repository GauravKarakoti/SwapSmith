import { OrderMonitor } from '../services/order-monitor';
import * as db from '../services/database';
import { getOrderStatus } from '../services/sideshift-client';
import { Telegraf } from 'telegraf';

// Mock dependencies
jest.mock('../services/database');
jest.mock('../services/sideshift-client');
jest.mock('../services/logger');

describe('OrderMonitor', () => {
  let mockBot: any;
  let orderMonitor: OrderMonitor;

  beforeEach(() => {
    // Create mock bot with telegram.sendMessage
    mockBot = {
      telegram: {
        sendMessage: jest.fn().mockResolvedValue({}),
      },
    };

    orderMonitor = new OrderMonitor(mockBot as Telegraf);
    jest.clearAllMocks();
  });

  afterEach(() => {
    orderMonitor.stop();
  });

  describe('Order Status Monitoring', () => {
    it('should detect status change from pending to settled', async () => {
      const mockWatchedOrder = {
        id: 1,
        telegramId: 123456,
        sideshiftOrderId: 'test-order-123',
        lastStatus: 'pending',
        lastChecked: new Date(),
        createdAt: new Date(),
      };

      const mockOrderStatus = {
        id: 'test-order-123',
        status: 'settled',
        depositCoin: 'ETH',
        depositNetwork: 'ethereum',
        settleCoin: 'USDC',
        settleNetwork: 'polygon',
        depositAddress: { address: '0xabc...', memo: null },
        settleAddress: { address: '0xdef...', memo: null },
        depositAmount: '1.0',
        settleAmount: '2500.0',
        depositHash: '0x123...',
        settleHash: '0x456...',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (db.getAllWatchedOrders as jest.Mock).mockResolvedValue([mockWatchedOrder]);
      (getOrderStatus as jest.Mock).mockResolvedValue(mockOrderStatus);
      (db.updateOrderStatus as jest.Mock).mockResolvedValue(undefined);
      (db.updateWatchedOrderStatus as jest.Mock).mockResolvedValue(undefined);
      (db.removeWatchedOrder as jest.Mock).mockResolvedValue(undefined);

      // Manually trigger check
      await (orderMonitor as any).checkOrders();

      // Verify status was updated
      expect(db.updateOrderStatus).toHaveBeenCalledWith('test-order-123', 'settled');
      expect(db.updateWatchedOrderStatus).toHaveBeenCalledWith('test-order-123', 'settled');

      // Verify user was notified
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('Your swap is complete'),
        expect.any(Object)
      );

      // Verify order was removed from watch list
      expect(db.removeWatchedOrder).toHaveBeenCalledWith('test-order-123');
    });

    it('should not notify if status has not changed', async () => {
      const mockWatchedOrder = {
        id: 1,
        telegramId: 123456,
        sideshiftOrderId: 'test-order-123',
        lastStatus: 'pending',
        lastChecked: new Date(),
        createdAt: new Date(),
      };

      const mockOrderStatus = {
        id: 'test-order-123',
        status: 'pending',
        depositCoin: 'ETH',
        depositNetwork: 'ethereum',
        settleCoin: 'USDC',
        settleNetwork: 'polygon',
        depositAddress: { address: '0xabc...', memo: null },
        settleAddress: { address: '0xdef...', memo: null },
        depositAmount: null,
        settleAmount: null,
        depositHash: null,
        settleHash: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (db.getAllWatchedOrders as jest.Mock).mockResolvedValue([mockWatchedOrder]);
      (getOrderStatus as jest.Mock).mockResolvedValue(mockOrderStatus);
      (db.updateOrderStatus as jest.Mock).mockResolvedValue(undefined);
      (db.updateWatchedOrderStatus as jest.Mock).mockResolvedValue(undefined);

      await (orderMonitor as any).checkOrders();

      // Verify status was updated but user was not notified
      expect(db.updateWatchedOrderStatus).toHaveBeenCalledWith('test-order-123', 'pending');
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
      expect(db.removeWatchedOrder).not.toHaveBeenCalled();
    });

    it('should handle refunded orders', async () => {
      const mockWatchedOrder = {
        id: 1,
        telegramId: 123456,
        sideshiftOrderId: 'test-order-123',
        lastStatus: 'pending',
        lastChecked: new Date(),
        createdAt: new Date(),
      };

      const mockOrderStatus = {
        id: 'test-order-123',
        status: 'refunded',
        depositCoin: 'ETH',
        depositNetwork: 'ethereum',
        settleCoin: 'USDC',
        settleNetwork: 'polygon',
        depositAddress: { address: '0xabc...', memo: null },
        settleAddress: { address: '0xdef...', memo: null },
        depositAmount: '1.0',
        settleAmount: null,
        depositHash: '0x123...',
        settleHash: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (db.getAllWatchedOrders as jest.Mock).mockResolvedValue([mockWatchedOrder]);
      (getOrderStatus as jest.Mock).mockResolvedValue(mockOrderStatus);
      (db.updateOrderStatus as jest.Mock).mockResolvedValue(undefined);
      (db.updateWatchedOrderStatus as jest.Mock).mockResolvedValue(undefined);
      (db.removeWatchedOrder as jest.Mock).mockResolvedValue(undefined);

      await (orderMonitor as any).checkOrders();

      // Verify user was notified about refund
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('Your swap was refunded'),
        expect.any(Object)
      );

      // Verify order was removed from watch list
      expect(db.removeWatchedOrder).toHaveBeenCalledWith('test-order-123');
    });

    it('should remove order from watch list if not found', async () => {
      const mockWatchedOrder = {
        id: 1,
        telegramId: 123456,
        sideshiftOrderId: 'test-order-123',
        lastStatus: 'pending',
        lastChecked: new Date(),
        createdAt: new Date(),
      };

      (db.getAllWatchedOrders as jest.Mock).mockResolvedValue([mockWatchedOrder]);
      (getOrderStatus as jest.Mock).mockRejectedValue(new Error('Order not found'));
      (db.removeWatchedOrder as jest.Mock).mockResolvedValue(undefined);

      await (orderMonitor as any).checkOrders();

      // Verify order was removed from watch list
      expect(db.removeWatchedOrder).toHaveBeenCalledWith('test-order-123');
    });
  });

  describe('Monitor Lifecycle', () => {
    it('should start and stop monitoring', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      orderMonitor.start();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Starting order monitor'));

      orderMonitor.stop();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Order monitor stopped'));

      consoleSpy.mockRestore();
    });

    it('should not start if already running', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      orderMonitor.start();
      orderMonitor.start(); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already running'));

      consoleSpy.mockRestore();
    });
  });
});
