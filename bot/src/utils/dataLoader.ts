/**
 * DataLoader utility for batch loading and caching database records.
 * Prevents N+1 query problems by batching similar queries.
 */

import { db, users, type User } from '../services/database';
import { eq, inArray } from 'drizzle-orm';

/**
 * Batch load users by their IDs
 * @param userIds Array of user IDs to load
 * @returns Promise<Map<number, User>> - Map of userId to User
 */
export async function batchLoadUsersByIds(userIds: number[]): Promise<Map<number, User>> {
  if (userIds.length === 0) return new Map();

  // Remove duplicates
  const uniqueIds = Array.from(new Set(userIds));

  // Batch fetch all users in a single query
  const loadedUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, uniqueIds));

  // Create a map for O(1) lookups
  const userMap = new Map<number, User>();
  for (const user of loadedUsers) {
    userMap.set(user.id, user);
  }

  return userMap;
}

/**
 * Batch load users by their Telegram IDs
 * @param telegramIds Array of Telegram IDs to load
 * @returns Promise<Map<number, User>> - Map of telegramId to User
 */
export async function batchLoadUsersByTelegramIds(telegramIds: number[]): Promise<Map<number, User>> {
  if (telegramIds.length === 0) return new Map();

  // Remove duplicates
  const uniqueIds = Array.from(new Set(telegramIds));

  // Batch fetch all users in a single query
  const loadedUsers = await db
    .select()
    .from(users)
    .where(inArray(users.telegramId, uniqueIds));

  // Create a map for O(1) lookups
  const userMap = new Map<number, User | undefined>();
  for (const user of loadedUsers) {
    userMap.set(user.telegramId as number, user);
  }

  return userMap;
}

/**
 * Batch load users and return augmented records with user data included
 * @param records Array of records with a telegramId or userId field
 * @param idField The field name that contains the user ID ('telegramId' or 'userId')
 * @returns Promise<Array<T & { user?: User }>> - Original records with user attached
 */
export async function enrichRecordsWithUsers<T extends Record<string, any>>(
  records: T[],
  idField: keyof T
): Promise<Array<T & { user?: User }>> {
  if (records.length === 0) return [];

  // Determine if we're loading by telegramId or userId
  const isTelegramId = idField === 'telegramId';
  const userIds = records.map((r) => r[idField] as number).filter(Boolean);

  // Batch load users
  const userMap = isTelegramId
    ? await batchLoadUsersByTelegramIds(userIds)
    : await batchLoadUsersByIds(userIds);

  // Attach user to each record
  return records.map((record) => ({
    ...record,
    user: userMap.get(record[idField] as number)
  }));
}
