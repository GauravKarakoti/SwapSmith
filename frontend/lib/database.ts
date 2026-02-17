import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, and, sql as drizzleSql } from 'drizzle-orm';

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
};

export type User = typeof users.$inferSelect;
export type CourseProgress = typeof courseProgress.$inferSelect;
export type RewardsLog = typeof rewardsLog.$inferSelect;
export type CoinPriceCache = typeof coinPriceCache.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type SwapHistory = typeof swapHistory.$inferSelect;
export type ChatHistory = typeof chatHistory.$inferSelect;
export type Discussion = typeof discussions.$inferSelect;

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
    .set({ status, txHash, updatedAt: new Date() })
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
  actionType: 'course_complete' | 'module_complete' | 'daily_login' | 'swap_complete' | 'referral',
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

export async function claimPendingTokens(userId: number) {
  if (!db) {
    console.warn('Database not configured');
    return null;
  }
  
  // Get all pending rewards
  const pendingRewards = await db.select().from(rewardsLog)
    .where(and(
      eq(rewardsLog.userId, userId),
      eq(rewardsLog.mintStatus, 'pending')
    ));
  
  if (pendingRewards.length === 0) return null;
  
  // Calculate total pending tokens
  const totalPending = pendingRewards.reduce(
    (sum, r) => sum + parseFloat(r.tokensPending as string),
    0
  );
  
  // Update rewards to processing status
  const rewardIds = pendingRewards.map(r => r.id);
  await db.update(rewardsLog)
    .set({
      mintStatus: 'processing',
      claimedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(drizzleSql`${rewardsLog.id} = ANY(${rewardIds})`);
  
  // Import token service and mint tokens
  const { mintTokens } = await import('./token-service');
  
  try {
    // Get user wallet address
    const user = await db.select().from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user[0]?.walletAddress) {
      // Use a default mock address if no wallet connected
      const mockAddress = `0x${userId.toString().padStart(40, '0')}`;
      console.warn('No wallet address found, using mock address:', mockAddress);
      
      const result = await mintTokens(mockAddress, totalPending.toString());
      
      // Update rewards with tx hash
      await db.update(rewardsLog)
        .set({
          mintStatus: 'minted',
          txHash: result.txHash,
          blockchainNetwork: 'mock-testnet',
          updatedAt: new Date(),
        })
        .where(drizzleSql`${rewardsLog.id} = ANY(${rewardIds})`);
      
      // Update user total claimed
      await db.update(users)
        .set({
          totalTokensClaimed: drizzleSql`${users.totalTokensClaimed} + ${totalPending}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      
      return { totalPending, rewardCount: pendingRewards.length, txHash: result.txHash };
    }
    
    const result = await mintTokens(user[0].walletAddress, totalPending.toString());
    
    // Update rewards with actual tx hash
    await db.update(rewardsLog)
      .set({
        mintStatus: 'minted',
        txHash: result.txHash,
        blockchainNetwork: process.env.BLOCKCHAIN_NETWORK || 'mock-testnet',
        updatedAt: new Date(),
      })
      .where(drizzleSql`${rewardsLog.id} = ANY(${rewardIds})`);
    
    // Update user total claimed
    await db.update(users)
      .set({
        totalTokensClaimed: drizzleSql`${users.totalTokensClaimed} + ${totalPending}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    
    return { totalPending, rewardCount: pendingRewards.length, txHash: result.txHash };
  } catch (error) {
    // Mark as failed on error
    await db.update(rewardsLog)
      .set({
        mintStatus: 'failed',
        errorMessage: (error as Error).message,
        updatedAt: new Date(),
      })
      .where(drizzleSql`${rewardsLog.id} = ANY(${rewardIds})`);
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

export default db;
