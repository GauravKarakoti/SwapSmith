import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, and, inArray, sql as drizzleSql } from 'drizzle-orm';

// Import all table schemas from shared schema file
import {
  coinPriceCache,
  userSettings,
  swapHistory,
  chatHistory,
  discussions,
  users,
  courseProgress,
  rewardsLog,
  watchlist,
  priceAlerts,
} from '../../shared/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Re-export schemas for backward compatibility
export {
  coinPriceCache,
  userSettings,
  swapHistory,
  chatHistory,
  discussions,
  users,
  courseProgress,
  rewardsLog,
  watchlist,
  priceAlerts,
};

export type User = typeof users.$inferSelect;
export type CourseProgress = typeof courseProgress.$inferSelect;
export type RewardsLog = typeof rewardsLog.$inferSelect;
export type CoinPriceCache = typeof coinPriceCache.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type SwapHistory = typeof swapHistory.$inferSelect;
export type ChatHistory = typeof chatHistory.$inferSelect;
export type Discussion = typeof discussions.$inferSelect;
export type Watchlist = typeof watchlist.$inferSelect;
export type PriceAlert = typeof priceAlerts.$inferSelect;

// --- COIN PRICE CACHE FUNCTIONS ---

export async function getCachedPrice(coin: string, network: string): Promise<CoinPriceCache | undefined> {
  if (!db) {
    console.warn('Database not configured');
    return undefined;
  }
  
  const result = await db.select().from(coinPriceCache)
    .where(and(
      eq(coinPriceCache.coin, coin),
      eq(coinPriceCache.network, network)
    ))
    .limit(1);
  
  const cached = result[0];
  if (!cached) return undefined;
  
  // Check if cache is still valid
  if (new Date(cached.expiresAt) < new Date()) {
    return undefined; // Expired
  }
  
  return cached;
}

export async function setCachedPrice(
  coin: string,
  network: string,
  name: string,
  usdPrice: string | undefined,
  btcPrice: string | undefined,
  available: boolean,
  ttlMinutes: number = 5
) {
  if (!db) {
    console.warn('Database not configured');
    return;
  }
  
  // Validate required fields
  if (!coin || typeof coin !== 'string' || coin.trim() === '') {
    throw new Error('Invalid coin: must be a non-empty string');
  }
  if (!network || typeof network !== 'string' || network.trim() === '') {
    throw new Error('Invalid network: must be a non-empty string');
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('Invalid name: must be a non-empty string');
  }
  
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  
  await db.insert(coinPriceCache)
    .values({
      coin: coin.trim(),
      network: network.trim(),
      name: name.trim(),
      usdPrice: usdPrice || null,
      btcPrice: btcPrice || null,
      available: available ? 'true' : 'false',
      expiresAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [coinPriceCache.coin, coinPriceCache.network],
      set: {
        name: name.trim(),
        usdPrice: usdPrice || null,
        btcPrice: btcPrice || null,
        available: available ? 'true' : 'false',
        expiresAt,
        updatedAt: new Date(),
      }
    });
}

export async function getAllCachedPrices(): Promise<CoinPriceCache[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  return await db.select().from(coinPriceCache)
    .where(eq(coinPriceCache.available, 'true'));
}

export async function clearAllCachedPrices() {
  if (!db) {
    console.warn('Database not configured');
    return;
  }
  
  await db.delete(coinPriceCache);
  console.log('[Database] Cleared all cached prices');
}

// --- USER SETTINGS FUNCTIONS ---

export async function getUserSettings(userId: string): Promise<UserSettings | undefined> {
  if (!db) {
    console.warn('Database not configured');
    return undefined;
  }
  
  const result = await db.select().from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return result[0];
}

export async function createOrUpdateUserSettings(
  userId: string,
  walletAddress?: string,
  preferences?: string,
  emailNotifications?: string
) {
  if (!db) {
    console.warn('Database not configured');
    return;
  }
  
  await db.insert(userSettings)
    .values({
      userId,
      walletAddress,
      preferences,
      emailNotifications,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        walletAddress,
        preferences,
        emailNotifications,
        updatedAt: new Date(),
      }
    });
}

// --- SWAP HISTORY FUNCTIONS ---

export async function createSwapHistoryEntry(
  userId: string,
  walletAddress: string | undefined,
  swapData: {
    sideshiftOrderId: string;
    quoteId?: string;
    fromAsset: string;
    fromNetwork: string;
    fromAmount: number;
    toAsset: string;
    toNetwork: string;
    settleAmount: string;
    depositAddress?: string;
    status?: string;
    txHash?: string;
  }
) {
  if (!db) {
    console.warn('Database not configured');
    return;
  }
  
  await db.insert(swapHistory).values({
    userId,
    walletAddress,
    ...swapData,
    status: swapData.status || 'pending',
    updatedAt: new Date(),
  });
}

export async function getSwapHistory(userId: string, limit: number = 50): Promise<SwapHistory[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  return await db.select().from(swapHistory)
    .where(eq(swapHistory.userId, userId))
    .orderBy(desc(swapHistory.createdAt))
    .limit(limit);
}

export async function getSwapHistoryByWallet(walletAddress: string, limit: number = 50): Promise<SwapHistory[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  return await db.select().from(swapHistory)
    .where(eq(swapHistory.walletAddress, walletAddress))
    .orderBy(desc(swapHistory.createdAt))
    .limit(limit);
}

export async function updateSwapHistoryStatus(sideshiftOrderId: string, status: string, txHash?: string) {
  if (!db) {
    console.warn('Database not configured');
    return;
  }
  
  await db.update(swapHistory)
    .set({
      status,
      ...(txHash ? { txHash } : {}),
      updatedAt: new Date()
    })
    .where(eq(swapHistory.sideshiftOrderId, sideshiftOrderId));
}

// --- CHAT HISTORY FUNCTIONS ---

export async function addChatMessage(
  userId: string,
  walletAddress: string | undefined,
  role: 'user' | 'assistant',
  content: string,
  sessionId?: string,
  metadata?: Record<string, unknown>
) {
  if (!db) {
    console.warn('Database not configured');
    return;
  }
  
  await db.insert(chatHistory).values({
    userId,
    walletAddress,
    role,
    content,
    sessionId,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

export async function getChatHistory(userId: string, sessionId?: string, limit: number = 50): Promise<ChatHistory[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  if (sessionId) {
    return await db.select().from(chatHistory)
      .where(and(
        eq(chatHistory.userId, userId),
        eq(chatHistory.sessionId, sessionId)
      ))
      .orderBy(desc(chatHistory.createdAt))
      .limit(limit);
  }
  
  return await db.select().from(chatHistory)
    .where(eq(chatHistory.userId, userId))
    .orderBy(desc(chatHistory.createdAt))
    .limit(limit);
}

export async function clearChatHistory(userId: string, sessionId?: string) {
  if (!db) {
    console.warn('Database not configured');
    return;
  }
  
  if (sessionId) {
    await db.delete(chatHistory)
      .where(and(
        eq(chatHistory.userId, userId),
        eq(chatHistory.sessionId, sessionId)
      ));
  } else {
    await db.delete(chatHistory)
      .where(eq(chatHistory.userId, userId));
  }
}

export async function getChatSessions(userId: string): Promise<{ sessionId: string; title: string; lastMessage: string; timestamp: Date; messageCount: number }[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  const sessions = await db
    .select({
      sessionId: chatHistory.sessionId,
      content: chatHistory.content,
      role: chatHistory.role,
      createdAt: chatHistory.createdAt,
    })
    .from(chatHistory)
    .where(eq(chatHistory.userId, userId))
    .orderBy(desc(chatHistory.createdAt));

  // Group by sessionId
  const sessionMap = new Map<string, { messages: typeof sessions; lastTimestamp: Date }>();
  
  for (const msg of sessions) {
    const sid = msg.sessionId || 'default';
    if (!sessionMap.has(sid)) {
      sessionMap.set(sid, { messages: [], lastTimestamp: msg.createdAt || new Date() });
    }
    sessionMap.get(sid)!.messages.push(msg);
  }

  // Create session summaries
  return Array.from(sessionMap.entries()).map(([sessionId, { messages, lastTimestamp }]) => {
    const userMessages = messages.filter(m => m.role === 'user');
    const firstUserMessage = userMessages[userMessages.length - 1];
    
    // Generate title from first user message
    const title = firstUserMessage?.content 
      ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
      : 'New Chat';
    
    const lastMessage = messages[0]?.content.slice(0, 100) || '';
    
    return {
      sessionId,
      title,
      lastMessage,
      timestamp: lastTimestamp,
      messageCount: messages.length,
    };
  }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// --- DISCUSSION FUNCTIONS ---

export async function createDiscussion(
  userId: string,
  username: string,
  content: string,
  category: string = 'general'
) {
  if (!db) {
    console.warn('Database not configured');
    return null;
  }
  
  const result = await db.insert(discussions).values({
    userId,
    username,
    content,
    category,
    likes: '0',
    replies: '0',
    updatedAt: new Date(),
  }).returning();
  return result[0];
}

export async function getDiscussions(category?: string, limit: number = 50): Promise<Discussion[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  if (category) {
    return await db.select().from(discussions)
      .where(eq(discussions.category, category))
      .orderBy(desc(discussions.createdAt))
      .limit(limit);
  }
  
  return await db.select().from(discussions)
    .orderBy(desc(discussions.createdAt))
    .limit(limit);
}

export async function deleteDiscussion(id: number, userId: string) {
  if (!db) {
    console.warn('Database not configured');
    return;
  }
  
  await db.delete(discussions)
    .where(and(
      eq(discussions.id, id),
      eq(discussions.userId, userId)
    ));
}

export async function likeDiscussion(id: number) {
  if (!db) {
    console.warn('Database not configured');
    return;
  }
  
  const discussion = await db.select().from(discussions)
    .where(eq(discussions.id, id))
    .limit(1);
  
  if (discussion[0]) {
    const currentLikes = parseInt(discussion[0].likes || '0');
    await db.update(discussions)
      .set({ 
        likes: String(currentLikes + 1),
        updatedAt: new Date()
      })
      .where(eq(discussions.id, id));
  }
}

// --- REWARDS SYSTEM FUNCTIONS ---

export async function getUserByWalletOrId(identifier: string): Promise<User | undefined> {
  if (!db) {
    console.warn('Database not configured');
    return undefined;
  }
  
  const result = await db.select().from(users)
    .where(eq(users.walletAddress, identifier))
    .limit(1);
  return result[0];
}

export async function getUserRewardsStats(userId: number) {
  if (!db) {
    console.warn('Database not configured');
    return null;
  }
  
  const user = await db.select().from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user[0]) return null;
  
  // Get pending tokens sum
  const pendingTokens = await db.select({ 
    total: drizzleSql<string>`COALESCE(SUM(${rewardsLog.tokensPending}), 0)` 
  })
    .from(rewardsLog)
    .where(and(
      eq(rewardsLog.userId, userId),
      eq(rewardsLog.mintStatus, 'pending')
    ));
  
  // Get completed courses count
  const completedCourses = await db.select({ 
    count: drizzleSql<number>`COUNT(*)` 
  })
    .from(courseProgress)
    .where(and(
      eq(courseProgress.userId, userId),
      eq(courseProgress.isCompleted, true)
    ));
  
  // Get user rank
  const ranks = await db.select({
    userId: users.id,
    totalPoints: users.totalPoints,
  })
    .from(users)
    .orderBy(desc(users.totalPoints), desc(users.totalTokensClaimed));
  
  const rank = ranks.findIndex(r => r.userId === userId) + 1;
  
  return {
    totalPoints: user[0].totalPoints,
    totalTokensClaimed: user[0].totalTokensClaimed,
    totalTokensPending: pendingTokens[0]?.total || '0',
    rank: rank > 0 ? rank : null,
    completedCourses: completedCourses[0]?.count || 0,
  };
}

export async function getUserCourseProgress(userId: number): Promise<CourseProgress[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  return await db.select().from(courseProgress)
    .where(eq(courseProgress.userId, userId))
    .orderBy(desc(courseProgress.lastAccessed));
}

export async function updateCourseProgress(
  userId: number,
  courseId: string,
  courseTitle: string,
  moduleId: string,
  totalModules: number
): Promise<CourseProgress | null> {
  if (!db) {
    console.warn('Database not configured');
    return null;
  }
  
  // Get existing progress
  const existing = await db.select().from(courseProgress)
    .where(and(
      eq(courseProgress.userId, userId),
      eq(courseProgress.courseId, courseId)
    ))
    .limit(1);
  
  if (existing[0]) {
    // Update existing progress
    const completedModules = existing[0].completedModules;
    if (!completedModules.includes(moduleId)) {
      completedModules.push(moduleId);
      
      const isCompleted = completedModules.length >= totalModules;
      
      await db.update(courseProgress)
        .set({
          completedModules,
          isCompleted,
          completionDate: isCompleted ? new Date() : existing[0].completionDate,
          lastAccessed: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(courseProgress.id, existing[0].id));
      
      return { ...existing[0], completedModules, isCompleted };
    }
    return existing[0];
  } else {
    // Create new progress
    const result = await db.insert(courseProgress)
      .values({
        userId,
        courseId,
        courseTitle,
        completedModules: [moduleId],
        totalModules,
        isCompleted: 1 >= totalModules,
        completionDate: 1 >= totalModules ? new Date() : null,
      })
      .returning();
    
    return result[0];
  }
}

export async function addRewardActivity(
  userId: number,
  actionType: 'course_complete' | 'module_complete' | 'daily_login' | 'swap_complete' | 'referral' | 'wallet_connected' | 'terminal_used' | 'notification_enabled',
  pointsEarned: number,
  tokensPending: string = '0',
  metadata?: Record<string, unknown>
) {
  if (!db) {
    console.warn('Database not configured');
    return null;
  }
  
  // Add reward log entry
  const reward = await db.insert(rewardsLog)
    .values({
      userId,
      actionType,
      pointsEarned,
      tokensPending,
      actionMetadata: metadata || null,
    })
    .returning();
  
  // Update user total points
  await db.update(users)
    .set({
      totalPoints: drizzleSql`${users.totalPoints} + ${pointsEarned}`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  
  return reward[0];
}

export async function getUserRewardActivities(userId: number, limit: number = 50): Promise<RewardsLog[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  return await db.select().from(rewardsLog)
    .where(eq(rewardsLog.userId, userId))
    .orderBy(desc(rewardsLog.createdAt))
    .limit(limit);
}

export async function claimPendingTokens(userId: number, walletAddressOverride?: string) {
  if (!db) {
    console.warn('Database not configured');
    return null;
  }

  // Pick up both 'pending' and previously-failed rewards so the user can retry
  const pendingRewards = await db.select().from(rewardsLog)
    .where(and(
      eq(rewardsLog.userId, userId),
      inArray(rewardsLog.mintStatus, ['pending', 'failed'])
    ));

  if (pendingRewards.length === 0) return null;

  // Total tokens to send
  const totalPending = pendingRewards.reduce(
    (sum, r) => sum + parseFloat(r.tokensPending as string),
    0
  );

  const rewardIds = pendingRewards.map(r => r.id);

  // ── Step 1: Resolve wallet address BEFORE touching the DB status ──────────
  let resolvedWallet = walletAddressOverride;

  if (!resolvedWallet) {
    const user = await db.select().from(users)
      .where(eq(users.id, userId))
      .limit(1);
    resolvedWallet = user[0]?.walletAddress ?? undefined;
  }

  if (!resolvedWallet) {
    // Don't change status – user just needs to supply a wallet address
    throw new Error('No wallet address found. Please enter your wallet address to claim tokens.');
  }

  // ── Step 2: Validate env config BEFORE touching the DB status ────────────
  // Import here so the config check happens before we mark rows as 'processing'
  const { mintTokens } = await import('./token-service');

  // ── Step 3: Mark as processing (we're committed to attempting the tx) ─────
  await db.update(rewardsLog)
    .set({ mintStatus: 'processing', claimedAt: new Date(), updatedAt: new Date() })
    .where(inArray(rewardsLog.id, rewardIds));

  // ── Step 4: Send the on-chain transaction ─────────────────────────────────
  try {
    const result = await mintTokens(resolvedWallet, totalPending.toString());

    if (!result.success) {
      throw new Error(`Transaction reverted on-chain (tx: ${result.txHash})`);
    }

    // Mark as minted
    await db.update(rewardsLog)
      .set({
        mintStatus: 'minted',
        txHash: result.txHash,
        blockchainNetwork: 'sepolia',
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(inArray(rewardsLog.id, rewardIds));

    // Update user totals
    await db.update(users)
      .set({
        totalTokensClaimed: drizzleSql`${users.totalTokensClaimed} + ${totalPending}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Save wallet address to profile so future claims don't need it re-entered
    await db.update(users)
      .set({ walletAddress: resolvedWallet, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { totalPending, rewardCount: pendingRewards.length, txHash: result.txHash };

  } catch (error) {
    const msg = (error as Error).message ?? 'Unknown error';
    const isConfigError =
      msg.includes('Missing required env vars') ||
      msg.includes('REWARD_TOKEN') ||
      msg.includes('Invalid recipient') ||
      msg.includes('Invalid token amount');

    if (isConfigError) {
      // Config problem – reset to 'pending' so the user can retry once fixed
      await db.update(rewardsLog)
        .set({ mintStatus: 'pending', errorMessage: msg, updatedAt: new Date() })
        .where(inArray(rewardsLog.id, rewardIds));
    } else {
      // Actual blockchain failure – mark as failed with the error
      await db.update(rewardsLog)
        .set({ mintStatus: 'failed', errorMessage: msg, updatedAt: new Date() })
        .where(inArray(rewardsLog.id, rewardIds));
    }
    throw error;
  }
}

export async function getLeaderboard(limit: number = 100): Promise<Array<{
  rank: number;
  userId: number;
  walletAddress: string | null;
  totalPoints: number;
  totalTokensClaimed: string;
}>> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  const leaderboard = await db.select({
    userId: users.id,
    walletAddress: users.walletAddress,
    totalPoints: users.totalPoints,
    totalTokensClaimed: users.totalTokensClaimed,
  })
    .from(users)
    .orderBy(desc(users.totalPoints), desc(users.totalTokensClaimed))
    .limit(limit);
  
  return leaderboard.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    walletAddress: entry.walletAddress,
    totalPoints: entry.totalPoints,
    totalTokensClaimed: entry.totalTokensClaimed,
  }));
}

// --- WATCHLIST FUNCTIONS ---

export async function getWatchlist(userId: string): Promise<Watchlist[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  return await db.select().from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.addedAt));
}

export async function addToWatchlist(
  userId: string,
  coin: string,
  network: string,
  name: string
): Promise<Watchlist | null> {
  if (!db) {
    console.warn('Database not configured');
    return null;
  }
  
  // Check if already in watchlist
  const existing = await db.select().from(watchlist)
    .where(and(
      eq(watchlist.userId, userId),
      eq(watchlist.coin, coin),
      eq(watchlist.network, network)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0]; // Already in watchlist
  }
  
  const result = await db.insert(watchlist).values({
    userId,
    coin,
    network,
    name,
  }).returning();
  
  return result[0];
}

export async function removeFromWatchlist(
  userId: string,
  coin: string,
  network: string
): Promise<boolean> {
  if (!db) {
    console.warn('Database not configured');
    return false;
  }
  
  const result = await db.delete(watchlist)
    .where(and(
      eq(watchlist.userId, userId),
      eq(watchlist.coin, coin),
      eq(watchlist.network, network)
    ));
  
  return true;
}

export async function isInWatchlist(
  userId: string,
  coin: string,
  network: string
): Promise<boolean> {
  if (!db) {
    console.warn('Database not configured');
    return false;
  }
  
  const result = await db.select().from(watchlist)
    .where(and(
      eq(watchlist.userId, userId),
      eq(watchlist.coin, coin),
      eq(watchlist.network, network)
    ))
    .limit(1);
  
  return result.length > 0;
}

// --- PRICE ALERT FUNCTIONS ---

export async function getPriceAlerts(userId: string): Promise<PriceAlert[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  return await db.select().from(priceAlerts)
    .where(eq(priceAlerts.userId, userId))
    .orderBy(desc(priceAlerts.createdAt));
}

export async function getActivePriceAlerts(userId: string): Promise<PriceAlert[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  return await db.select().from(priceAlerts)
    .where(and(
      eq(priceAlerts.userId, userId),
      eq(priceAlerts.isActive, true)
    ))
    .orderBy(desc(priceAlerts.createdAt));
}

export async function createPriceAlert(
  userId: string,
  coin: string,
  network: string,
  name: string,
  targetPrice: string,
  condition: 'gt' | 'lt',
  telegramId?: number
): Promise<PriceAlert | null> {
  if (!db) {
    console.warn('Database not configured');
    return null;
  }
  
  const result = await db.insert(priceAlerts).values({
    userId,
    telegramId: telegramId || null,
    coin,
    network,
    name,
    targetPrice,
    condition,
    isActive: true,
  }).returning();
  
  return result[0];
}

export async function updatePriceAlert(
  alertId: number,
  userId: string,
  updates: {
    targetPrice?: string;
    condition?: 'gt' | 'lt';
    isActive?: boolean;
  }
): Promise<PriceAlert | null> {
  if (!db) {
    console.warn('Database not configured');
    return null;
  }
  
  const result = await db.update(priceAlerts)
    .set(updates)
    .where(and(
      eq(priceAlerts.id, alertId),
      eq(priceAlerts.userId, userId)
    ))
    .returning();
  
  return result[0] || null;
}

export async function deletePriceAlert(alertId: number, userId: string): Promise<boolean> {
  if (!db) {
    console.warn('Database not configured');
    return false;
  }
  
  await db.delete(priceAlerts)
    .where(and(
      eq(priceAlerts.id, alertId),
      eq(priceAlerts.userId, userId)
    ));
  
  return true;
}

export async function togglePriceAlert(alertId: number, userId: string, isActive: boolean): Promise<PriceAlert | null> {
  if (!db) {
    console.warn('Database not configured');
    return null;
  }
  
  const result = await db.update(priceAlerts)
    .set({ isActive })
    .where(and(
      eq(priceAlerts.id, alertId),
      eq(priceAlerts.userId, userId)
    ))
    .returning();
  
  return result[0] || null;
}

export async function markPriceAlertTriggered(alertId: number): Promise<boolean> {
  if (!db) {
    console.warn('Database not configured');
    return false;
  }
  
  await db.update(priceAlerts)
    .set({ 
      isActive: false,
      triggeredAt: new Date()
    })
    .where(eq(priceAlerts.id, alertId));
  
  return true;
}

export async function getAllActivePriceAlerts(): Promise<PriceAlert[]> {
  if (!db) {
    console.warn('Database not configured');
    return [];
  }
  
  return await db.select().from(priceAlerts)
    .where(eq(priceAlerts.isActive, true));
}

export default db;
