import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, serial, text, real, timestamp, unique } from 'drizzle-orm/pg-core';
import { eq, desc, and } from 'drizzle-orm';

// Check if database is configured
const isDatabaseConfigured = () => {
  return !!(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');
};

// Only initialize database if configured
let sql: ReturnType<typeof neon> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

if (isDatabaseConfigured()) {
  try {
    sql = neon(process.env.DATABASE_URL!);
    db = drizzle(sql);
  } catch (error) {
    console.error('Database initialization error:', error);
  }
} else {
  console.warn('Database is not configured. DATABASE_URL environment variable is missing.');
}

// --- SHARED SCHEMAS (matching bot/src/services/database.ts) ---

export const coinPriceCache = pgTable('coin_price_cache', {
  id: serial('id').primaryKey(),
  coin: text('coin').notNull(),
  network: text('network').notNull(),
  name: text('name').notNull(),
  usdPrice: text('usd_price'),
  btcPrice: text('btc_price'),
  available: text('available').notNull().default('true'),
  expiresAt: timestamp('expires_at').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  coinNetworkUnique: unique().on(table.coin, table.network),
}));

export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  walletAddress: text('wallet_address'),
  theme: text('theme').default('dark'),
  slippageTolerance: real('slippage_tolerance').default(0.5),
  notificationsEnabled: text('notifications_enabled').default('true'),
  defaultFromAsset: text('default_from_asset'),
  defaultToAsset: text('default_to_asset'),
  preferences: text('preferences'), // Additional JSON preferences
  emailNotifications: text('email_notifications'),
  telegramNotifications: text('telegram_notifications').default('false'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const swapHistory = pgTable('swap_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  walletAddress: text('wallet_address'),
  sideshiftOrderId: text('sideshift_order_id').notNull(),
  quoteId: text('quote_id'),
  fromAsset: text('from_asset').notNull(),
  fromNetwork: text('from_network').notNull(),
  fromAmount: real('from_amount').notNull(),
  toAsset: text('to_asset').notNull(),
  toNetwork: text('to_network').notNull(),
  settleAmount: text('settle_amount').notNull(),
  depositAddress: text('deposit_address'),
  status: text('status').notNull().default('pending'),
  txHash: text('tx_hash'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const chatHistory = pgTable('chat_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  walletAddress: text('wallet_address'),
  role: text('role').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata'),
  sessionId: text('session_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const discussions = pgTable('discussions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  content: text('content').notNull(),
  category: text('category').default('general'), // general, crypto, help, announcement
  likes: text('likes').default('0'),
  replies: text('replies').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

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

export default db;
