import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, notInArray, and, or, sql } from 'drizzle-orm';
import dotenv from 'dotenv';
import type { SideShiftOrder, SideShiftCheckoutResponse } from './sideshift-client';
import type { ParsedCommand } from './groq-client';
import logger from './logger';


// Import all table schemas from shared schema file
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
  stakeOrders,
  courseProgress,
  rewardsLog,
} from '../../../shared/schema';

dotenv.config();

// In-memory fallback for development or connection issues
const memoryState = new Map<number, any>();

const connectionString = process.env.DATABASE_URL || 'postgres://mock:mock@localhost:5432/mock';
const client = neon(connectionString);
export const db = drizzle(client);

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
  stakeOrders,
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
export type StakeOrder = typeof stakeOrders.$inferSelect;
export type CourseProgress = typeof courseProgress.$inferSelect;
export type RewardsLog = typeof rewardsLog.$inferSelect;

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
    logger.error('Error resolving nickname:', error);
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
    depositMemo: depositMemo || null
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
        logger.error("Failed to get active DCA schedules", error);
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
    // Logic to align with dayOfWeek could be more robust here, 
    // but assuming simple +7 days for now if already aligned.
  } else if (frequency === 'monthly') {
    nextExecution.setMonth(nextExecution.getMonth() + 1);
    // Logic to align with dayOfMonth
  }

  await db.update(dcaSchedules)
    .set({
      nextExecutionAt: nextExecution,
      ordersExecuted: sql`orders_executed + 1`,
    })
    .where(eq(dcaSchedules.id, id));
}

// --- NEW: Limit Order Update ---
export async function updateLimitOrderStatus(
  orderId: number, 
  isActive: number,
  currentPrice?: string
) {
  const updateData: Partial<LimitOrder> = {
    isActive,
    ...(currentPrice && { currentPrice }),
    lastCheckedAt: new Date(),
  };

  await db.update(limitOrders)
    .set(updateData)
    .where(eq(limitOrders.id, orderId));
}

// --- Create DCA Schedule ---
export async function createDCASchedule(
  telegramId: number | null,
  fromAsset: string,
  fromChain: string,
  toAsset: string,
  toChain: string,
  amount: number,
  frequency: 'daily' | 'weekly' | 'monthly',
  settleAddress: string,
  dayOfWeek?: string,
  dayOfMonth?: string
): Promise<DCASchedule> {
  const now = new Date();
  let nextExecution = new Date(now);

  // Calculate next execution time
  if (frequency === 'daily') {
    nextExecution.setDate(nextExecution.getDate() + 1);
  } else if (frequency === 'weekly' && dayOfWeek) {
    const dayMap: { [key: string]: number } = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 0
    };
    const targetDay = dayMap[dayOfWeek.toLowerCase()];
    const currentDay = nextExecution.getDay();
    let daysToAdd = (targetDay - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7; // If today is the day, schedule for next week
    nextExecution.setDate(nextExecution.getDate() + daysToAdd);
  } else if (frequency === 'monthly' && dayOfMonth) {
    const targetDay = parseInt(dayOfMonth, 10);
    nextExecution.setMonth(nextExecution.getMonth() + 1);
    nextExecution.setDate(targetDay);
  }

  const result = await db.insert(dcaSchedules).values({
    telegramId: telegramId || 0,
    fromAsset,
    fromChain,
    toAsset,
    toChain,
    amount,
    frequency,
    dayOfWeek: dayOfWeek || undefined,
    dayOfMonth: dayOfMonth || undefined,
    settleAddress,
    nextExecution,
  }).returning();

  return result[0] as DCASchedule;
}

// --- Create Limit Order ---
export async function createLimitOrder(
  telegramId: number | null,
  fromAsset: string,
  fromChain: string,
  toAsset: string,
  toChain: string,
  amount: number,
  conditionOperator: 'gt' | 'lt',
  conditionValue: number,
  conditionAsset: string,
  settleAddress?: string
): Promise<LimitOrder> {
  const result = await db.insert(limitOrders).values({
    telegramId: telegramId || 0,
    fromAsset,
    fromChain,
    toAsset,
    toChain,
    amount,
    conditionOperator,
    conditionValue,
    conditionAsset,
    settleAddress: settleAddress || undefined,
    status: 'pending',
  }).returning();

  return result[0] as LimitOrder;
}

// --- Stake Orders (Swap + Stake) ---

export async function createStakeOrder(
  telegramId: number,
  sideshiftOrderId: string,
  swapFromAsset: string,
  swapFromNetwork: string,
  swapFromAmount: string,
  swapToAsset: string,
  swapToNetwork: string,
  stakingProtocol: string,
  stakerAddress: string,
  estimatedApy?: number
): Promise<StakeOrder> {
  const result = await db
    .insert(stakeOrders)
    .values({
      telegramId,
      sideshiftOrderId,
      swapFromAsset,
      swapFromNetwork,
      swapFromAmount,
      swapToAsset,
      swapToNetwork,
      stakingProtocol,
      stakingAsset: swapToAsset,
      stakingNetwork: swapToNetwork,
      stakerAddress,
      estimatedApy,
      swapStatus: 'pending',
      stakeStatus: 'pending',
    })
    .returning();

  return result[0] as StakeOrder;
}

export async function getPendingStakeOrders(): Promise<StakeOrder[]> {
  const result = await db
    .select()
    .from(stakeOrders)
    .where(
      or(
        eq(stakeOrders.swapStatus, 'pending'),
        eq(stakeOrders.stakeStatus, 'pending')
      )
    );
  return result;
}

export async function updateStakeOrderSwapStatus(
  sideshiftOrderId: string,
  status: string,
  txHash?: string,
  settleAmount?: string
): Promise<StakeOrder | null> {
  const result = await db
    .update(stakeOrders)
    .set({
      swapStatus: status,
      swapTxHash: txHash,
      swapSettleAmount: settleAmount,
      updatedAt: new Date(),
    })
    .where(eq(stakeOrders.sideshiftOrderId, sideshiftOrderId))
    .returning();

  return result[0] || null;
}

export async function updateStakeOrderStakeStatus(
  sideshiftOrderId: string,
  status: string,
  txHash?: string
): Promise<StakeOrder | null> {
  const result = await db
    .update(stakeOrders)
    .set({
      stakeStatus: status,
      stakeTxHash: txHash,
      updatedAt: new Date(),
    })
    .where(eq(stakeOrders.sideshiftOrderId, sideshiftOrderId))
    .returning();

  return result[0] || null;
}

export async function getStakeOrder(sideshiftOrderId: string): Promise<StakeOrder | null> {
  const result = await db
    .select()
    .from(stakeOrders)
    .where(eq(stakeOrders.sideshiftOrderId, sideshiftOrderId))
    .limit(1);

  return result[0] || null;
}
