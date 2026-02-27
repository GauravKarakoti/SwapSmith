import { db } from '../services/database';
import { 
  traderStats, 
  followedTraders, 
  sharedPortfolios, 
  portfolioCopies,
  portfolioNotifications,
  portfolioHistory,
  users 
} from '../schema';
import { eq, desc, and, sql, ne } from 'drizzle-orm';

// Generate unique share code
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============ TRADER STATS FUNCTIONS ============

export async function getOrCreateTraderStats(userId: number) {
  const existing = await db.select()
    .from(traderStats)
    .where(eq(traderStats.userId, userId))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  const [created] = await db.insert(traderStats)
    .values({ userId })
    .returning();
  
  return created;
}

export async function updateTraderStats(
  userId: number, 
  updates: {
    totalTrades?: number;
    successfulTrades?: number;
    totalVolumeUSD?: string;
    followerCount?: number;
    totalCopies?: number;
    averageReturn?: number;
    winRate?: number;
    reputationScore?: number;
  }
) {
  const [updated] = await db.update(traderStats)
    .set({ ...updates, lastUpdated: new Date() })
    .where(eq(traderStats.userId, userId))
    .returning();
  
  return updated;
}

export async function getTopTraders(limit: number = 20) {
  const result = await db.select({
    id: traderStats.id,
    userId: traderStats.userId,
    totalTrades: traderStats.totalTrades,
    successfulTrades: traderStats.successfulTrades,
    totalVolumeUSD: traderStats.totalVolumeUSD,
    followerCount: traderStats.followerCount,
    totalCopies: traderStats.totalCopies,
    averageReturn: traderStats.averageReturn,
    winRate: traderStats.winRate,
    reputationScore: traderStats.reputationScore,
    username: users.telegramId,
    walletAddress: users.walletAddress,
  })
  .from(traderStats)
  .leftJoin(users, eq(traderStats.userId, users.id))
  .orderBy(desc(traderStats.reputationScore))
  .limit(limit);
  
  return result;
}

export async function getTraderStatsByUserId(userId: number) {
  const result = await db.select({
    id: traderStats.id,
    userId: traderStats.userId,
    totalTrades: traderStats.totalTrades,
    successfulTrades: traderStats.successfulTrades,
    totalVolumeUSD: traderStats.totalVolumeUSD,
    followerCount: traderStats.followerCount,
    totalCopies: traderStats.totalCopies,
    averageReturn: traderStats.averageReturn,
    winRate: traderStats.winRate,
    reputationScore: traderStats.reputationScore,
  })
  .from(traderStats)
  .where(eq(traderStats.userId, userId))
  .limit(1);
  
  return result[0] || null;
}

// ============ FOLLOW FUNCTIONS ============

export async function followTrader(followerId: number, traderId: number) {
  // Check if already following
  const existing = await db.select()
    .from(followedTraders)
    .where(
      and(
        eq(followedTraders.followerId, followerId),
        eq(followedTraders.traderId, traderId)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    return { success: false, message: 'Already following this trader' };
  }
  
  // Create follow relationship
  await db.insert(followedTraders)
    .values({ followerId, traderId });
  
  // Update follower count
  await db.update(traderStats)
    .set({ 
      followerCount: sql`follower_count + 1`,
      lastUpdated: new Date()
    })
    .where(eq(traderStats.userId, traderId));
  
  return { success: true, message: 'Successfully followed trader' };
}

export async function unfollowTrader(followerId: number, traderId: number) {
  const result = await db.delete(followedTraders)
    .where(
      and(
        eq(followedTraders.followerId, followerId),
        eq(followedTraders.traderId, traderId)
      )
    )
    .returning();
  
  if (result.length > 0) {
    // Update follower count
    await db.update(traderStats)
      .set({ 
        followerCount: sql`GREATEST(follower_count - 1, 0)`,
        lastUpdated: new Date()
      })
      .where(eq(traderStats.userId, traderId));
    
    return { success: true, message: 'Successfully unfollowed trader' };
  }
  
  return { success: false, message: 'Not following this trader' };
}

export async function getFollowers(traderId: number) {
  return db.select()
    .from(followedTraders)
    .where(eq(followedTraders.traderId, traderId));
}

export async function getFollowing(userId: number) {
  return db.select()
    .from(followedTraders)
    .where(eq(followedTraders.followerId, userId));
}

export async function isFollowing(followerId: number, traderId: number): Promise<boolean> {
  const result = await db.select()
    .from(followedTraders)
    .where(
      and(
        eq(followedTraders.followerId, followerId),
        eq(followedTraders.traderId, traderId)
      )
    )
    .limit(1);
  
  return result.length > 0;
}

// ============ PORTFOLIO SHARING FUNCTIONS ============

export async function sharePortfolio(
  userId: number,
  portfolioData: {
    title: string;
    description?: string;
    fromAsset: string;
    fromChain?: string;
    portfolio: Array<{ toAsset: string; toChain: string; percentage: number }>;
    isPublic?: boolean;
    expiresAt?: Date;
  }
) {
  const shareCode = generateShareCode();
  
  const [created] = await db.insert(sharedPortfolios)
    .values({
      userId,
      shareCode,
      title: portfolioData.title,
      description: portfolioData.description,
      fromAsset: portfolioData.fromAsset,
      fromChain: portfolioData.fromChain,
      portfolio: portfolioData.portfolio,
      isPublic: portfolioData.isPublic ?? true,
      expiresAt: portfolioData.expiresAt,
    })
    .returning();
  
  // Record history
  await db.insert(portfolioHistory)
    .values({
      userId,
      portfolioId: created.id,
      changeType: 'shared',
      newPortfolio: portfolioData.portfolio,
    });
  
  return created;
}

export async function getSharedPortfolioByCode(shareCode: string) {
  const result = await db.select({
    id: sharedPortfolios.id,
    userId: sharedPortfolios.userId,
    shareCode: sharedPortfolios.shareCode,
    title: sharedPortfolios.title,
    description: sharedPortfolios.description,
    fromAsset: sharedPortfolios.fromAsset,
    fromChain: sharedPortfolios.fromChain,
    portfolio: sharedPortfolios.portfolio,
    copyCount: sharedPortfolios.copyCount,
    likeCount: sharedPortfolios.likeCount,
    viewCount: sharedPortfolios.viewCount,
    createdAt: sharedPortfolios.createdAt,
  })
  .from(sharedPortfolios)
  .where(eq(sharedPortfolios.shareCode, shareCode))
  .limit(1);
  
  if (result.length > 0) {
    // Increment view count
    await db.update(sharedPortfolios)
      .set({ viewCount: sql`view_count + 1` })
      .where(eq(sharedPortfolios.id, result[0].id));
  }
  
  return result[0] || null;
}

export async function getPublicPortfolios(limit: number = 20, offset: number = 0) {
  return db.select({
    id: sharedPortfolios.id,
    userId: sharedPortfolios.userId,
    shareCode: sharedPortfolios.shareCode,
    title: sharedPortfolios.title,
    description: sharedPortfolios.description,
    fromAsset: sharedPortfolios.fromAsset,
    fromChain: sharedPortfolios.fromChain,
    portfolio: sharedPortfolios.portfolio,
    copyCount: sharedPortfolios.copyCount,
    likeCount: sharedPortfolios.likeCount,
    viewCount: sharedPortfolios.viewCount,
    createdAt: sharedPortfolios.createdAt,
  })
  .from(sharedPortfolios)
  .where(eq(sharedPortfolios.isPublic, true))
  .orderBy(desc(sharedPortfolios.viewCount))
  .limit(limit)
  .offset(offset);
}

export async function getUserPortfolios(userId: number) {
  return db.select()
    .from(sharedPortfolios)
    .where(eq(sharedPortfolios.userId, userId))
    .orderBy(desc(sharedPortfolios.createdAt));
}

export async function updatePortfolio(
  portfolioId: number,
  userId: number,
  updates: {
    title?: string;
    description?: string;
    portfolio?: Array<{ toAsset: string; toChain: string; percentage: number }>;
    isPublic?: boolean;
  }
) {
  // Get previous portfolio for history
  const previous = await db.select()
    .from(sharedPortfolios)
    .where(eq(sharedPortfolios.id, portfolioId))
    .limit(1);
  
  const [updated] = await db.update(sharedPortfolios)
    .set({ ...updates, updatedAt: new Date() })
    .where(
      and(
        eq(sharedPortfolios.id, portfolioId),
        eq(sharedPortfolios.userId, userId)
      )
    )
    .returning();
  
  // Record history if portfolio changed
  if (updates.portfolio && previous.length > 0) {
    await db.insert(portfolioHistory)
      .values({
        userId,
        portfolioId,
        changeType: 'updated',
        previousPortfolio: previous[0].portfolio,
        newPortfolio: updates.portfolio,
      });
    
    // Notify followers
    await notifyFollowersOfPortfolioChange(userId, portfolioId, previous[0].portfolio, updates.portfolio);
  }
  
  return updated;
}

export async function deletePortfolio(portfolioId: number, userId: number) {
  const result = await db.delete(sharedPortfolios)
    .where(
      and(
        eq(sharedPortfolios.id, portfolioId),
        eq(sharedPortfolios.userId, userId)
      )
    )
    .returning();
  
  return result[0] || null;
}

// ============ COPY PORTFOLIO FUNCTIONS ============

export async function copyPortfolio(
  userId: number,
  portfolioId: number,
  amount?: string
) {
  // Get the original portfolio
  const portfolio = await db.select()
    .from(sharedPortfolios)
    .where(eq(sharedPortfolios.id, portfolioId))
    .limit(1);
  
  if (portfolio.length === 0) {
    return { success: false, message: 'Portfolio not found' };
  }
  
  const original = portfolio[0];
  
  // Create copy record
  const [copy] = await db.insert(portfolioCopies)
    .values({
      userId,
      portfolioId,
      originalTraderId: original.userId,
      copiedAmount: amount,
      status: 'active',
    })
    .returning();
  
  // Update copy count on original portfolio
  await db.update(sharedPortfolios)
    .set({ copyCount: sql`copy_count + 1` })
    .where(eq(sharedPortfolios.id, portfolioId));
  
  // Update total copies on trader stats
  await db.update(traderStats)
    .set({ 
      totalCopies: sql`total_copies + 1`,
      lastUpdated: new Date()
    })
    .where(eq(traderStats.userId, original.userId));
  
  return { 
    success: true, 
    copy,
    portfolio: original.portfolio,
    fromAsset: original.fromAsset,
    fromChain: original.fromChain,
  };
}

export async function getUserCopiedPortfolios(userId: number) {
  return db.select({
    id: portfolioCopies.id,
    portfolioId: portfolioCopies.portfolioId,
    originalTraderId: portfolioCopies.originalTraderId,
    copiedAmount: portfolioCopies.copiedAmount,
    status: portfolioCopies.status,
    createdAt: portfolioCopies.createdAt,
    portfolio: sharedPortfolios.portfolio,
    title: sharedPortfolios.title,
    fromAsset: sharedPortfolios.fromAsset,
    fromChain: sharedPortfolios.fromChain,
  })
  .from(portfolioCopies)
  .leftJoin(sharedPortfolios, eq(portfolioCopies.portfolioId, sharedPortfolios.id))
  .where(eq(portfolioCopies.userId, userId));
}

// ============ NOTIFICATION FUNCTIONS ============

async function notifyFollowersOfPortfolioChange(
  traderId: number,
  portfolioId: number,
  previousPortfolio: any,
  newPortfolio: any
) {
  // Get all followers
  const followers = await db.select()
    .from(followedTraders)
    .where(
      and(
        eq(followedTraders.traderId, traderId),
        eq(followedTraders.notifyOnPortfolioChange, true)
      )
    );
  
  // Create notifications for each follower
  for (const follow of followers) {
    await db.insert(portfolioNotifications)
      .values({
        userId: follow.followerId,
        traderId,
        portfolioId,
        type: 'portfolio_changed',
        title: 'Portfolio Update',
        message: 'A trader you follow has updated their portfolio strategy',
      });
  }
}

export async function getUserNotifications(userId: number, limit: number = 20) {
  return db.select()
    .from(portfolioNotifications)
    .where(eq(portfolioNotifications.userId, userId))
    .orderBy(desc(portfolioNotifications.createdAt))
    .limit(limit);
}

export async function markNotificationAsRead(notificationId: number, userId: number) {
  await db.update(portfolioNotifications)
    .set({ isRead: true })
    .where(
      and(
        eq(portfolioNotifications.id, notificationId),
        eq(portfolioNotifications.userId, userId)
      )
    );
}

export async function markAllNotificationsAsRead(userId: number) {
  await db.update(portfolioNotifications)
    .set({ isRead: true })
    .where(eq(portfolioNotifications.userId, userId));
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const result = await db.select({ id: portfolioNotifications.id })
    .from(portfolioNotifications)
    .where(
      and(
        eq(portfolioNotifications.userId, userId),
        eq(portfolioNotifications.isRead, false)
      )
    );
  
  return result.length;
}

// ============ REPUTATION CALCULATION ============

export async function calculateReputationScore(userId: number): Promise<number> {
  const stats = await getTraderStatsByUserId(userId);
  
  if (!stats) return 0;
  
  // Weight factors
  const WIN_RATE_WEIGHT = 30;
  const VOLUME_WEIGHT = 20;
  const FOLLOWERS_WEIGHT = 20;
  const COPIES_WEIGHT = 15;
  const SUCCESS_RATE_WEIGHT = 15;
  
  // Normalize values (assuming reasonable max values)
  const normalizedWinRate = Math.min(stats.winRate / 100, 1);
  const normalizedVolume = Math.min(parseFloat(stats.totalVolumeUSD.toString()) / 1000000, 1); // Max 1M USD
  const normalizedFollowers = Math.min(stats.followerCount / 1000, 1); // Max 1000 followers
  const normalizedCopies = Math.min(stats.totalCopies / 500, 1); // Max 500 copies
  const normalizedSuccessRate = stats.totalTrades > 0 
    ? stats.successfulTrades / stats.totalTrades 
    : 0;
  
  const score = 
    (normalizedWinRate * WIN_RATE_WEIGHT) +
    (normalizedVolume * VOLUME_WEIGHT) +
    (normalizedFollowers * FOLLOWERS_WEIGHT) +
    (normalizedCopies * COPIES_WEIGHT) +
    (normalizedSuccessRate * SUCCESS_RATE_WEIGHT);
  
  // Update the reputation score
  await updateTraderStats(userId, { reputationScore: Math.round(score * 10) / 10 });
  
  return Math.round(score * 10) / 10;
}
