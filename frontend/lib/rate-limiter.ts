/**
 * Simple in-memory rate limiter for discussion posts
 * Limits users to 5 posts per hour
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// Key: userId, Value: RateLimitEntry
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configuration
const MAX_POSTS_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Clean up expired rate limit entries (older than 1 hour)
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [userId, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(userId);
    }
  }
}

/**
 * Check if a user is rate limited
 * @param userId - The user ID to check
 * @returns Object with isLimited flag and remaining attempts
 */
export function checkRateLimit(userId: string): {
  isLimited: boolean;
  remaining: number;
  resetTime?: number;
} {
  // Clean up old entries periodically
  if (Math.random() < 0.1) {
    cleanupExpiredEntries();
  }

  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  // No entry or entry expired - user is not limited
  if (!entry || entry.resetTime < now) {
    return {
      isLimited: false,
      remaining: MAX_POSTS_PER_HOUR - 1, // -1 for the post about to be made
    };
  }

  // Entry exists and is still valid
  const remaining = MAX_POSTS_PER_HOUR - entry.count;
  
  if (entry.count >= MAX_POSTS_PER_HOUR) {
    return {
      isLimited: true,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  return {
    isLimited: false,
    remaining: remaining - 1, // -1 for the post about to be made
  };
}

/**
 * Record a post attempt for rate limiting
 * Should be called after successful post creation
 */
export function recordPost(userId: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || entry.resetTime < now) {
    // Create new entry
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
  } else {
    // Increment existing entry
    entry.count += 1;
    rateLimitStore.set(userId, entry);
  }
}

/**
 * Get time until rate limit reset for a user
 * @param userId - The user ID
 * @returns Minutes until reset, or null if not rate limited
 */
export function getTimeUntilReset(userId: string): number | null {
  const entry = rateLimitStore.get(userId);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (entry.resetTime < now) {
    return null;
  }

  return Math.ceil((entry.resetTime - now) / 60000); // Convert to minutes
}

/**
 * Reset rate limit for a user (admin function)
 */
export function resetUserRateLimit(userId: string): void {
  rateLimitStore.delete(userId);
}

/**
 * Get rate limit stats for monitoring
 */
export function getRateLimitStats(): {
  totalUsers: number;
  maxPostsPerHour: number;
  windowMinutes: number;
} {
  return {
    totalUsers: rateLimitStore.size,
    maxPostsPerHour: MAX_POSTS_PER_HOUR,
    windowMinutes: RATE_LIMIT_WINDOW_MS / 60000,
  };
}
