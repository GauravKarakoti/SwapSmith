import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, notInArray, and, sql } from 'drizzle-orm';
import dotenv from 'dotenv';
import type { SideShiftOrder, SideShiftCheckoutResponse } from './sideshift-client';
import type { ParsedCommand } from './parseUserCommand'; // Fixed import path from groq-client

// Import all table schemas from shared schema file
import * as schema from '../../../shared/schema';
import {
  users,
  conversations,
  orders,
  checkouts,
  addressBook,
  watchedOrders,
  coinPriceCache,
  userSettings,
  swapHistory,
  chatHistory,
  dcaSchedules,
  limitOrders,
  courseProgress,
  rewardsLog,
} from '../../../shared/schema';

dotenv.config();

// In-memory fallback for development or connection issues
const memoryState = new Map<number, any>();

const connectionString = process.env.DATABASE_URL || 'postgres://mock:mock@localhost:5432/mock';
const client = neon(connectionString);
// Initialize drizzle with schema to fix type inference issues
export const db = drizzle(client, { schema });

// Re-export schemas for backward compatibility
export {
  users,
  conversations,
  orders,
  checkouts,
  addressBook,
  watchedOrders,
  coinPriceCache,
  userSettings,
  swapHistory,
  chatHistory,
  dcaSchedules,
  limitOrders,
  courseProgress,
  rewardsLog,
};

// Type exports for backward compatibility
export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Checkout = typeof checkouts.$inferSelect;
export type AddressBookEntry = typeof addressBook.$inferSelect;
export type WatchedOrder = typeof watchedOrders.$inferSelect;
export type CoinPriceCache = typeof coinPriceCache.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type SwapHistory = typeof swapHistory.$inferSelect;
export type ChatHistory = typeof chatHistory.$inferSelect;
export type DCASchedule = typeof dcaSchedules.$inferSelect;
export type LimitOrder = typeof limitOrders.$inferSelect;
export type CourseProgress = typeof courseProgress.$inferSelect;
export type RewardsLog = typeof rewardsLog.$inferSelect;

// --- UNIFIED ORDER TYPES ---

export interface DelayedOrder {
  id: number;
  telegramId: number;
  orderType: 'limit_order' | 'dca';
  fromAsset: string;
  fromChain: string;
  toAsset: string;
  toChain: string;
  amount: number;
  settleAddress: string | null;
  // Limit specific
  targetPrice?: number;
  condition?: 'above' | 'below';
  expiryDate?: Date;
  // DCA specific
  frequency?: string;
  maxExecutions?: number;
  executionCount?: number;
  nextExecutionAt?: Date;
}

// --- FUNCTIONS ---

// NEW: Address Book Resolution
export async function resolveNickname(telegramId: number, nickname: string): Promise<string | null> {
  try {
    const result = await db.select({ address: addressBook.address })
      .from(addressBook)
      .where(and(
        eq(addressBook.telegramId, telegramId),
        eq(addressBook.label, nickname.toLowerCase())
      ))
      .limit(1);
      
    return result[0]?.address || null;
  } catch (error) {
    console.error('Error resolving nickname:', error);
    return null;
  }
}

export async function getUser(telegramId: number): Promise<User | undefined> {
  const result = await db.select().from(users).where(eq(users.telegramId, telegramId));
  return result[0];
}

export async function setUserWalletAndSession(telegramId: number, walletAddress: string, sessionTopic: string) {
  await db.insert(users)
    .values({ telegramId, walletAddress, sessionTopic })
    .onConflictDoUpdate({
      target: users.telegramId,
      set: { walletAddress, sessionTopic }
    });
}

export async function getConversationState(telegramId: number) {
  try {
    const result = await db.select({ state: conversations.state, lastUpdated: conversations.lastUpdated })
        .from(conversations)
        .where(eq(conversations.telegramId, telegramId));
    
    if (!result[0]?.state) return null;

    const state = JSON.parse(result[0].state);
    const lastUpdated = result[0].lastUpdated;

    // Expire state after 1 hour
    if (lastUpdated && (Date.now() - new Date(lastUpdated).getTime()) > 60 * 60 * 1000) {
      await clearConversationState(telegramId);
      return null;
    }
    return state;
  } catch(err) {
    return memoryState.get(telegramId) || null;
  }
}

export async function setConversationState(telegramId: number, state: any) {
  try {
    await db.insert(conversations)
      .values({ telegramId, state: JSON.stringify(state), lastUpdated: new Date() })
      .onConflictDoUpdate({
        target: conversations.telegramId,
        set: { state: JSON.stringify(state), lastUpdated: new Date() }
      });
  } catch(err) {
    memoryState.set(telegramId, state);
  }
}

export async function clearConversationState(telegramId: number) {
  try {
    await db.delete(conversations).where(eq(conversations.telegramId, telegramId));
  } catch(err) {
    memoryState.delete(telegramId);
  }
}

export async function createOrderEntry(
  telegramId: number,
  parsedCommand: ParsedCommand,
  order: SideShiftOrder,
  settleAmount: string | number,
  quoteId: string
) {
  const depositAddr = typeof order.depositAddress === 'string' ? order.depositAddress : order.depositAddress?.address;
  const depositMemo = typeof order.depositAddress === 'object' ? order.depositAddress?.memo : null;

  await db.insert(orders).values({
    telegramId,
    sideshiftOrderId: order.id,
    quoteId,
    fromAsset: parsedCommand.fromAsset!,
    fromNetwork: parsedCommand.fromChain!,
    fromAmount: parsedCommand.amount!.toString(),
    toAsset: parsedCommand.toAsset!,
    toNetwork: parsedCommand.toChain!,
    settleAmount: settleAmount.toString(),
    depositAddress: depositAddr!,
    depositMemo: depositMemo || null,
    status: 'pending'
  });
}

export async function getUserHistory(telegramId: number): Promise<Order[]> {
  return await db.select().from(orders)
    .where(eq(orders.telegramId, telegramId))
    .orderBy(desc(orders.createdAt))
    .limit(10);
}

export async function getLatestUserOrder(telegramId: number): Promise<Order | undefined> {
  const result = await db.select().from(orders)
    .where(eq(orders.telegramId, telegramId))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return result[0];
}

export async function updateOrderStatus(sideshiftOrderId: string, newStatus: string) {
  await db.update(orders)
    .set({ status: newStatus })
    .where(eq(orders.sideshiftOrderId, sideshiftOrderId));
}

export async function createCheckoutEntry(telegramId: number, checkout: SideShiftCheckoutResponse) {
  // Fix: Convert number to float if needed or ensure parsing is safe
  const amount = typeof checkout.settleAmount === 'string' ? parseFloat(checkout.settleAmount) : checkout.settleAmount;
  
  await db.insert(checkouts).values({
    telegramId,
    checkoutId: checkout.id,
    settleAsset: checkout.settleCoin,
    settleNetwork: checkout.settleNetwork,
    settleAmount: amount,
    settleAddress: checkout.settleAddress,
    status: 'pending'
  });
}

export async function getUserCheckouts(telegramId: number): Promise<Checkout[]> {
  return await db.select().from(checkouts)
    .where(eq(checkouts.telegramId, telegramId))
    .orderBy(desc(checkouts.createdAt))
    .limit(10);
}

// --- ORDER MONITOR HELPERS ---

const TERMINAL_STATUSES = ['settled', 'expired', 'refunded', 'failed'];

export async function getPendingOrders(): Promise<Order[]> {
  return await db.select().from(orders)
    .where(notInArray(orders.status, TERMINAL_STATUSES));
}

export async function getOrderBySideshiftId(sideshiftOrderId: string): Promise<Order | undefined> {
  const result = await db.select().from(orders)
    .where(eq(orders.sideshiftOrderId, sideshiftOrderId))
    .limit(1);
  return result[0];
}

// --- NEW FUNCTIONS FOR DCA & WATCHED ORDERS ---

/**
 * Adds an order to the watched orders table.
 */
export async function addWatchedOrder(telegramId: number, sideshiftOrderId: string, initialStatus: string) {
  await db.insert(watchedOrders).values({
    telegramId,
    sideshiftOrderId,
    lastStatus: initialStatus,
  }).onConflictDoNothing();
}

/**
 * Retrieves active DCA schedules.
 */
export async function getActiveDCASchedules(): Promise<DCASchedule[]> {
    try {
        return await db.select().from(dcaSchedules).where(eq(dcaSchedules.isActive, 1));
    } catch (error) {
        console.error("Failed to get active DCA schedules", error);
        return [];
    }
}

/**
 * Updates a DCA schedule after execution.
 * Calculates the next execution time based on frequency.
 */
export async function updateDCAScheduleExecution(
  id: number,
  frequency: string,
  dayOfWeek?: string,
  dayOfMonth?: string
) {
  const now = new Date();
  let nextExecution = new Date(now);

  // Calculate next execution date
  if (frequency === 'daily') {
    nextExecution.setDate(nextExecution.getDate() + 1);
  } else if (frequency === 'weekly') {
    nextExecution.setDate(nextExecution.getDate() + 7);
  } else if (frequency === 'monthly') {
    nextExecution.setMonth(nextExecution.getMonth() + 1);
  }

  await db.update(dcaSchedules)
    .set({
      nextExecutionAt: nextExecution,
      ordersExecuted: sql`orders_executed + 1`,
    })
    .where(eq(dcaSchedules.id, id));
}

// --- NEW: Limit Order & Delayed Order Management ---

export async function createDelayedOrder(data: Partial<DelayedOrder>) {
    if (data.orderType === 'limit_order') {
        await db.insert(limitOrders).values({
            telegramId: data.telegramId!,
            fromAsset: data.fromAsset!,
            fromNetwork: data.fromChain!,
            toAsset: data.toAsset!,
            toNetwork: data.toChain!,
            fromAmount: data.amount!.toString(),
            targetPrice: data.targetPrice!.toString(),
            currentPrice: null,
            isActive: 1,
            lastCheckedAt: new Date(),
        });
    } else if (data.orderType === 'dca') {
        // Approximate interval hours from frequency string
        let intervalHours = 24;
        if(data.frequency === 'weekly') intervalHours = 168;
        if(data.frequency === 'monthly') intervalHours = 720;
        
        await db.insert(dcaSchedules).values({
            telegramId: data.telegramId!,
            fromAsset: data.fromAsset!,
            fromNetwork: data.fromChain!,
            toAsset: data.toAsset!,
            toNetwork: data.toChain!,
            amountPerOrder: data.amount!.toString(),
            intervalHours: intervalHours,
            totalOrders: data.maxExecutions || 10,
            ordersExecuted: 0,
            isActive: 1,
            nextExecutionAt: data.nextExecutionAt || new Date()
        });
    }
}

export async function getPendingDelayedOrders(): Promise<DelayedOrder[]> {
  const allOrders: DelayedOrder[] = [];

  // Fetch Limit Orders
  const pendingLimits = await db.select({
      id: limitOrders.id,
      telegramId: limitOrders.telegramId,
      fromAsset: limitOrders.fromAsset,
      fromChain: limitOrders.fromNetwork,
      toAsset: limitOrders.toAsset,
      toChain: limitOrders.toNetwork,
      amount: limitOrders.fromAmount,
      targetPrice: limitOrders.targetPrice,
      walletAddress: users.walletAddress
  })
  .from(limitOrders)
  .leftJoin(users, eq(limitOrders.telegramId, users.telegramId))
  .where(eq(limitOrders.isActive, 1));

  pendingLimits.forEach(o => {
      allOrders.push({
          id: o.id,
          telegramId: o.telegramId,
          orderType: 'limit_order',
          fromAsset: o.fromAsset,
          fromChain: o.fromChain,
          toAsset: o.toAsset,
          toChain: o.toChain,
          amount: parseFloat(o.amount),
          settleAddress: o.walletAddress,
          targetPrice: parseFloat(o.targetPrice),
          condition: 'below', // Defaulting as schema is missing this field
      });
  });

  // Fetch DCA Orders
  const pendingDCA = await db.select({
      id: dcaSchedules.id,
      telegramId: dcaSchedules.telegramId,
      fromAsset: dcaSchedules.fromAsset,
      fromChain: dcaSchedules.fromNetwork,
      toAsset: dcaSchedules.toAsset,
      toChain: dcaSchedules.toNetwork,
      amountPerOrder: dcaSchedules.amountPerOrder,
      intervalHours: dcaSchedules.intervalHours,
      totalOrders: dcaSchedules.totalOrders,
      ordersExecuted: dcaSchedules.ordersExecuted,
      nextExecutionAt: dcaSchedules.nextExecutionAt,
      walletAddress: users.walletAddress
  })
  .from(dcaSchedules)
  .leftJoin(users, eq(dcaSchedules.telegramId, users.telegramId))
  .where(eq(dcaSchedules.isActive, 1));

  pendingDCA.forEach(o => {
    // Map interval back to string frequency for compatibility
    let frequency = 'daily';
    if (o.intervalHours >= 168) frequency = 'weekly';
    if (o.intervalHours >= 720) frequency = 'monthly';

    allOrders.push({
        id: o.id,
        telegramId: o.telegramId,
        orderType: 'dca',
        fromAsset: o.fromAsset,
        fromChain: o.fromChain,
        toAsset: o.toAsset,
        toChain: o.toChain,
        amount: parseFloat(o.amountPerOrder),
        settleAddress: o.walletAddress,
        frequency,
        maxExecutions: o.totalOrders,
        executionCount: o.ordersExecuted,
        nextExecutionAt: o.nextExecutionAt
    });
  });

  return allOrders;
}

export async function updateDelayedOrderStatus(
  orderId: number, 
  status: 'active' | 'completed' | 'pending' | 'expired',
  executionCount?: number,
  nextExecutionAt?: Date
) {
  // Try updating Limit Orders
  if (status === 'completed' || status === 'expired') {
      await db.update(limitOrders)
        .set({ isActive: 0 })
        .where(eq(limitOrders.id, orderId));
  }

  // Try updating DCA Schedules
  if (status === 'completed') {
    await db.update(dcaSchedules)
        .set({ isActive: 0 })
        .where(eq(dcaSchedules.id, orderId));
  } else if (executionCount !== undefined && nextExecutionAt) {
      // Update execution progress
      await db.update(dcaSchedules)
        .set({ 
            ordersExecuted: executionCount,
            nextExecutionAt: nextExecutionAt
        })
        .where(eq(dcaSchedules.id, orderId));
  }
}

export async function cancelDelayedOrder(id: number, type: 'limit_order' | 'dca') {
    if (type === 'limit_order') {
        await db.update(limitOrders).set({ isActive: 0 }).where(eq(limitOrders.id, id));
    } else {
        await db.update(dcaSchedules).set({ isActive: 0 }).where(eq(dcaSchedules.id, id));
    }
}