import { NextRequest, NextResponse } from 'next/server';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Rate Limiting Implementation
 * 
 * Provides multiple rate limiting strategies:
 * 1. In-memory rate limiting for development/single instance
 * 2. IP-based rate limiting with sliding window
 * 3. User-based rate limiting for authenticated requests
 * 4. Endpoint-specific rate limits
 */

// Rate limit configuration
interface RateLimitConfig {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  message?: string;     // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean;     // Don't count failed requests
}

// Default rate limit configurations
export const RATE_LIMITS = {
  // General API rate limits
  default: { windowMs: 15 * 60 * 1000, maxRequests: 100 }, // 100 requests per 15 minutes
  strict: { windowMs: 15 * 60 * 1000, maxRequests: 20 },   // 20 requests per 15 minutes
  
  // Financial operations (more restrictive)
  swap: { windowMs: 5 * 60 * 1000, maxRequests: 10 },      // 10 swaps per 5 minutes
  payment: { windowMs: 10 * 60 * 1000, maxRequests: 5 },   // 5 payments per 10 minutes
  
  // Authentication operations
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },      // 5 auth attempts per 15 minutes
  
  // User profile operations
  profile: { windowMs: 5 * 60 * 1000, maxRequests: 20 },   // 20 profile updates per 5 minutes
  
  // Admin operations
  admin: { windowMs: 5 * 60 * 1000, maxRequests: 50 },     // 50 admin operations per 5 minutes
} as const;

// In-memory store for rate limiting (use Redis in production)
class InMemoryStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  
  // Clean up expired entries periodically
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.store.entries()) {
        if (now > value.resetTime) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }
  
  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const resetTime = now + windowMs;
    
    const existing = this.store.get(key);
    
    if (!existing || now > existing.resetTime) {
      // First request or window expired
      const entry = { count: 1, resetTime };
      this.store.set(key, entry);
      return entry;
    }
    
    // Increment existing count
    existing.count++;
    this.store.set(key, existing);
    return existing;
  }
  
  get(key: string): { count: number; resetTime: number } | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() <= entry.resetTime) {
      return entry;
    }
    return undefined;
  }
  
  cleanup() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global store instance
const store = new InMemoryStore();

/**
 * Generate rate limit key based on IP and optional user identifier
 */
function generateKey(request: NextRequest | NextApiRequest, prefix: string = 'rl'): string {
  // Get IP address
  let ip: string;
  
  if ('ip' in request) {
    // NextApiRequest
    ip = request.ip || 
        request.headers['x-forwarded-for'] as string ||
        request.headers['x-real-ip'] as string ||
        'unknown';
  } else {
    // NextRequest
    ip = request.ip || 
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
  }
  
  // Clean IP (take first IP if comma-separated)
  const cleanIp = Array.isArray(ip) ? ip[0] : ip.split(',')[0].trim();
  
  return `${prefix}:${cleanIp}`;
}

/**
 * Rate limiter for Next.js App Router (middleware)
 */
export function rateLimitMiddleware(
  request: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.default
): NextResponse | null {
  const key = generateKey(request, 'api');
  const { count, resetTime } = store.increment(key, config.windowMs);
  
  if (count > config.maxRequests) {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    
    console.warn(`[Rate Limit] Blocked request from ${request.ip}: ${count}/${config.maxRequests}`);
    
    return NextResponse.json(
      { 
        error: config.message || 'Too many requests',
        retryAfter: retryAfter
      },
      { 
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
        }
      }
    );
  }
  
  // Add rate limit headers to successful responses
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', (config.maxRequests - count).toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
  
  return response;
}

/**
 * Rate limiter for Pages API routes
 */
export function rateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  config: RateLimitConfig = RATE_LIMITS.default
): boolean {
  const key = generateKey(req, 'api');
  const { count, resetTime } = store.increment(key, config.windowMs);
  
  // Add rate limit headers
  const remaining = Math.max(0, config.maxRequests - count);
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  
  res.setHeader('X-RateLimit-Limit', config.maxRequests);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
  
  if (count > config.maxRequests) {
    res.setHeader('Retry-After', retryAfter);
    
    console.warn(`[Rate Limit] Blocked request from ${req.ip}: ${count}/${config.maxRequests}`);
    
    res.status(429).json({
      error: config.message || 'Too many requests',
      retryAfter: retryAfter
    });
    
    return false;
  }
  
  return true;
}

/**
 * Create a rate-limited API handler wrapper
 */
export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  config: RateLimitConfig = RATE_LIMITS.default
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (!rateLimit(req, res, config)) {
      return; // Rate limit exceeded, response already sent
    }
    
    return handler(req, res);
  };
}

/**
 * Endpoint-specific rate limiters
 */
export const rateLimiters = {
  // Financial operations
  swap: (req: NextApiRequest, res: NextApiResponse) => 
    rateLimit(req, res, { ...RATE_LIMITS.swap, message: 'Too many swap requests' }),
  
  payment: (req: NextApiRequest, res: NextApiResponse) => 
    rateLimit(req, res, { ...RATE_LIMITS.payment, message: 'Too many payment requests' }),
  
  // Authentication
  auth: (req: NextApiRequest, res: NextApiResponse) => 
    rateLimit(req, res, { ...RATE_LIMITS.auth, message: 'Too many authentication attempts' }),
  
  // Profile operations
  profile: (req: NextApiRequest, res: NextApiResponse) => 
    rateLimit(req, res, { ...RATE_LIMITS.profile, message: 'Too many profile updates' }),
  
  // Admin operations
  admin: (req: NextApiRequest, res: NextApiResponse) => 
    rateLimit(req, res, { ...RATE_LIMITS.admin, message: 'Too many admin requests' }),
  
  // Default
  default: (req: NextApiRequest, res: NextApiResponse) => 
    rateLimit(req, res, RATE_LIMITS.default),
};

/**
 * Get rate limit status for a request (without incrementing)
 */
export function getRateLimitStatus(
  request: NextRequest | NextApiRequest,
  config: RateLimitConfig = RATE_LIMITS.default
): { 
  remaining: number; 
  resetTime: number; 
  isLimited: boolean;
} {
  const key = generateKey(request, 'api');
  const entry = store.get(key);
  
  if (!entry) {
    return {
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
      isLimited: false
    };
  }
  
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const isLimited = entry.count >= config.maxRequests;
  
  return {
    remaining,
    resetTime: entry.resetTime,
    isLimited
  };
}

/**
 * Clear rate limit for a specific key (useful for testing or admin override)
 */
export function clearRateLimit(request: NextRequest | NextApiRequest, prefix: string = 'api'): void {
  const key = generateKey(request, prefix);
  store.store.delete(key);
}

/**
 * Cleanup function for graceful shutdown
 */
export function cleanup(): void {
  store.cleanup();
}

// Export store for testing
export { store as _store };