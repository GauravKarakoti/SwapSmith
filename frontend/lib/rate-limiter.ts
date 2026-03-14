import { NextResponse, NextRequest } from 'next/server';

export interface RateLimitConfig {
  limit: number;
  window: number; // in seconds
  message?: string;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  swap: { limit: 5, window: 60, message: 'Too many swap requests. Please wait before trying again.' },
  payment: { limit: 10, window: 60, message: 'Too many payment requests. Please wait before trying again.' },
  auth: { limit: 5, window: 60, message: 'Too many authentication attempts. Please wait before trying again.' },
  profile: { limit: 20, window: 60, message: 'Too many profile requests. Please wait before trying again.' },
  admin: { limit: 50, window: 60, message: 'Too many admin requests. Please wait before trying again.' },
  strict: { limit: 10, window: 60, message: 'Too many requests. Please wait before trying again.' },
  default: { limit: 100, window: 60, message: 'Too many requests. Please wait before trying again.' }
};

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const apiRateLimitStore = new Map<string, RateLimitEntry>();
const discussionRateLimitStore = new Map<string, RateLimitEntry>();

export function getClientIp(req: NextRequest | any): string {
  if (req.headers && typeof req.headers.get === 'function') {
    return req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1';
  }
  return req.headers?.['x-forwarded-for']?.split(',')[0] || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

export function rateLimitMiddleware(req: NextRequest, config: RateLimitConfig): NextResponse | null {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = config.window * 1000;

  let entry = apiRateLimitStore.get(ip);
  if (!entry || entry.resetTime < now) {
    entry = { count: 1, resetTime: now + windowMs };
  } else {
    entry.count++;
  }
  
  apiRateLimitStore.set(ip, entry);

  if (entry.count > config.limit) {
    return NextResponse.json(
      { error: config.message || 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString() } }
    );
  }
  
  return null;
}

export function withRateLimit(req: any, res: any, config: RateLimitConfig) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = config.window * 1000;

  let entry = apiRateLimitStore.get(ip);
  if (!entry || entry.resetTime < now) {
    entry = { count: 1, resetTime: now + windowMs };
  } else {
    entry.count++;
  }
  
  apiRateLimitStore.set(ip, entry);

  if (entry.count > config.limit) {
    if (res.setHeader) res.setHeader('Retry-After', Math.ceil((entry.resetTime - now) / 1000));
    if (res.status && res.status(429).json) {
        res.status(429).json({ error: config.message || 'Rate limit exceeded' });
    }
    return true;
  }
  
  return false;
}

export function getRateLimitStatus(req: any, config: RateLimitConfig) {
  const ip = getClientIp(req);
  const entry = apiRateLimitStore.get(ip);
  const remaining = entry && entry.resetTime > Date.now() ? Math.max(0, config.limit - entry.count) : config.limit;
  return { remaining };
}

export const rateLimiters = {
  check: (req: any, config: RateLimitConfig) => {
    return withRateLimit(req, {
      setHeader: () => {},
      status: () => ({ json: () => {} })
    }, config);
  }
};

// --- Discussion Rate Limiter (from existing) ---

const MAX_POSTS_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [userId, entry] of discussionRateLimitStore.entries()) {
    if (entry.resetTime < now) {
      discussionRateLimitStore.delete(userId);
    }
  }
}

export function checkRateLimit(userId: string): { isLimited: boolean; remaining: number; resetTime?: number; } {
  if (Math.random() < 0.1) cleanupExpiredEntries();
  const now = Date.now();
  const entry = discussionRateLimitStore.get(userId);
  if (!entry || entry.resetTime < now) {
    return { isLimited: false, remaining: MAX_POSTS_PER_HOUR - 1 };
  }
  const remaining = MAX_POSTS_PER_HOUR - entry.count;
  if (entry.count >= MAX_POSTS_PER_HOUR) {
    return { isLimited: true, remaining: 0, resetTime: entry.resetTime };
  }
  return { isLimited: false, remaining: remaining - 1 };
}

export function recordPost(userId: string): void {
  const now = Date.now();
  const entry = discussionRateLimitStore.get(userId);
  if (!entry || entry.resetTime < now) {
    discussionRateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count += 1;
    discussionRateLimitStore.set(userId, entry);
  }
}

export function getTimeUntilReset(userId: string): number | null {
  const entry = discussionRateLimitStore.get(userId);
  if (!entry) return null;
  const now = Date.now();
  if (entry.resetTime < now) return null;
  return Math.ceil((entry.resetTime - now) / 60000);
}

export function resetUserRateLimit(userId: string): void {
  discussionRateLimitStore.delete(userId);
}

export function getRateLimitStats(): { totalUsers: number; maxPostsPerHour: number; windowMinutes: number; } {
  return { totalUsers: discussionRateLimitStore.size, maxPostsPerHour: MAX_POSTS_PER_HOUR, windowMinutes: RATE_LIMIT_WINDOW_MS / 60000 };
}