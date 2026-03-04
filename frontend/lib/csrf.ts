import { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';

/**
 * CSRF Protection Utility
 * 
 * Implements multiple layers of CSRF protection:
 * 1. Token-based protection using double-submit cookie pattern
 * 2. Origin/Referer header validation for trusted origins
 * 
 * For modern Next.js 13+ App Router, use token-based protection
 * For legacy Pages Router, use origin/referer validation
 */

// CSRF Token configuration
export const CSRF_TOKEN_COOKIE = 'csrf-token';
export const CSRF_TOKEN_HEADER = 'x-csrf-token';

// List of allowed origins - configure based on your deployment
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://swapsmith.ai',
      'https://www.swapsmith.ai',
    ];

// ============ TOKEN-BASED CSRF PROTECTION (Next.js 13+ App Router) ============

/**
 * Generate a CSRF token for double-submit cookie pattern
 * Uses Web Crypto API for Edge Runtime compatibility
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate CSRF token from NextRequest
 * Extracts token from header and compares with cookie
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const method = request.method;
  
  // Skip validation for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  // Get token from header
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  if (!headerToken) {
    console.warn('[CSRF Token] Validation failed: No token in header');
    return false;
  }

  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
  if (!cookieToken) {
    console.warn('[CSRF Token] Validation failed: No token in cookie');
    return false;
  }

  // Compare tokens (simple string comparison for Edge Runtime compatibility)
  const match = headerToken === cookieToken;

  if (!match) {
    console.warn('[CSRF Token] Validation failed: Token mismatch');
  }

  return match;
}

/**
 * Create response with CSRF token cookie
 */
export function setCSRFTokenCookie(response: NextResponse, token?: string): NextResponse {
  const tokenValue = token || generateCsrfToken();
  
  response.cookies.set(CSRF_TOKEN_COOKIE, tokenValue, {
    httpOnly: false, // Must be accessible by JS to send in header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });

  return response;
}

/**
 * Middleware for App Router to validate CSRF tokens
 */
export function csrfProtectionMiddleware(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api/');
  const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);

  if (isApiRoute && isStateChangingMethod) {
    // Validate CSRF token for state-changing requests
    if (!validateCsrfToken(request)) {
      return NextResponse.json(
        { error: 'CSRF token validation failed' },
        { status: 403 }
      );
    }
  }

  // Add CSRF token to response cookies for all requests
  const response = NextResponse.next();
  return setCSRFTokenCookie(response);
}

// ============ ORIGIN/REFERER-BASED CSRF PROTECTION (Pages Router) ============

export class CSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CSRFError';
  }
}

/**
 * Extract the origin from request headers
 */
function getOrigin(req: NextApiRequest): string | undefined {
  return req.headers.origin as string | undefined;
}

/**
 * Extract the referer from request headers
 */
function getReferer(req: NextApiRequest): string | undefined {
  return req.headers.referer as string | undefined;
}

/**
 * Extract host from referer or request URL
 */
function extractHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  
  try {
    const urlObj = new URL(url);
    return urlObj.host;
  } catch {
    return undefined;
  }
}

/**
 * Validate that the request originates from an allowed origin
 * 
 * @param req - Next.js API request
 * @returns true if valid, throws CSRFError if invalid
 */
export function validateCSRF(req: NextApiRequest): boolean {
  const origin = getOrigin(req);
  const referer = getReferer(req);
  
  // If this is a server-side GET request (like from getServerSideProps), skip CSRF
  // We only validate POST, PUT, DELETE methods
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }
  
  // For development: skip CSRF check if no origin/referer (e.g., curl requests)
  // In production, you may want to be stricter
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!origin && !referer) {
    if (isDevelopment) {
      console.warn('[CSRF] No Origin/Referer header found, skipping validation in development');
      return true;
    }
    throw new CSRFError('Missing Origin or Referer header');
  }
  
  // Check Origin header
  if (origin) {
    const isOriginAllowed = ALLOWED_ORIGINS.some(allowed => 
      origin === allowed || origin.startsWith(allowed.replace(/\/$/, ''))
    );
    
    if (isOriginAllowed) {
      return true;
    }
  }
  
  // Check Referer header
  if (referer) {
    const refererHost = extractHost(referer);
    
    if (refererHost) {
      const isRefererAllowed = ALLOWED_ORIGINS.some(allowed => {
        try {
          const allowedUrl = new URL(allowed);
          return refererHost === allowedUrl.host;
        } catch {
          return refererHost === allowed;
        }
      });
      
      if (isRefererAllowed) {
        return true;
      }
    }
  }
  
  // If we reach here, neither origin nor referer matched
  console.error('[CSRF] Request blocked - Invalid Origin/Referer:', {
    origin,
    referer,
    allowedOrigins: ALLOWED_ORIGINS,
    method: req.method,
    url: req.url,
  });
  
  throw new CSRFError('Request origin not allowed');
}

/**
 * Middleware-style handler for CSRF validation
 * Use this at the start of your API route handler
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 * @returns true if valid, sends 403 response and returns false if invalid
 */
export function csrfGuard(req: NextApiRequest, res: NextApiResponse): boolean {
  try {
    validateCSRF(req);
    return true;
  } catch (error) {
    const message = error instanceof CSRFError ? error.message : 'CSRF validation failed';
    res.status(403).json({ error: message });
    return false;
  }
}

/**
 * Create a CSRF-protected API handler wrapper
 * 
 * @param handler - Your API route handler
 * @param methods - HTTP methods to protect (default: POST, PUT, DELETE)
 * @returns Wrapped handler with CSRF protection
 */
export function withCSRF(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  methods: string[] = ['POST', 'PUT', 'DELETE']
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Only validate for specified methods
    if (methods.includes(req.method || '')) {
      if (!csrfGuard(req, res)) {
        return; // Response already sent
      }
    }
    return handler(req, res);
  };
}
