/**
 * Unified CSRF Protection Middleware
 *
 * Consolidates CSRF protection for all API routes with:
 * 1. Double-submit cookie pattern
 * 2. SameSite cookie enforcement  
 * 3. Origin/Referer validation
 * 4. Constant-time token comparison
 * 5. Token rotation for long-lived sessions
 */

import { NextRequest, NextResponse } from 'next/server';

// CSRF Configuration
export const CSRF_CONFIG = {
  tokenCookie: 'csrf-token',
  tokenHeader: 'x-csrf-token',
  tokenLength: 32,
  cookieMaxAge: 24 * 60 * 60, // 24 hours
  tokenRotationInterval: 30 * 60 * 1000, // 30 minutes
};

// Allowed origins for CSRF validation
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o.length > 0)
  : ['http://localhost:3000', 'http://localhost:3001', 'https://swapsmith.ai', 'https://www.swapsmith.ai'];

/**
 * Generate cryptographically secure CSRF token
 */
export function generateCSRFToken(length: number = CSRF_CONFIG.tokenLength): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate origin header against allowed list
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.startsWith(allowed.replace(/\/$/, '')));
}

/**
 * Validate referer header against allowed origins
 */
function isRefererAllowed(referer: string | null): boolean {
  if (!referer) return false;
  try {
    const refererUrl = new URL(referer);
    const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
    return isOriginAllowed(refererOrigin);
  } catch {
    return false;
  }
}

/**
 * CSRF Validation Result
 */
export interface CSRFValidationResult {
  isValid: boolean;
  shouldRotate?: boolean;
  reason?: string;
}

/**
 * Validate CSRF token for state-changing requests
 */
export function validateCSRF(request: NextRequest): CSRFValidationResult {
  const method = request.method;

  // Skip validation for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { isValid: true };
  }

  // Check Origin/Referer
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // In development, allow requests without Origin/Referer for testing
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!isDevelopment && !origin && !referer) {
    return {
      isValid: false,
      reason: 'Missing Origin or Referer header'
    };
  }

  // Validate Origin or Referer
  if (origin || referer) {
    const originValid = origin && isOriginAllowed(origin);
    const refererValid = referer && isRefererAllowed(referer);
    
    if (!originValid && !refererValid) {
      return {
        isValid: false,
        reason: 'Invalid Origin or Referer header'
      };
    }
  }

  // Check CSRF token
  const headerToken = request.headers.get(CSRF_CONFIG.tokenHeader);
  const cookieToken = request.cookies.get(CSRF_CONFIG.tokenCookie)?.value;

  // Either x-requested-with: XMLHttpRequest or CSRF token in header
  const xRequestedWithHeader = request.headers.get('x-requested-with');
  const hasValidCustomHeader = xRequestedWithHeader === 'XMLHttpRequest';

  if (!hasValidCustomHeader) {
  if (!headerToken || !cookieToken) {
    return { isValid: false, reason: 'Missing CSRF token in header or cookie' };
  }

    // Verify token match using constant-time comparison
    if (!constantTimeEqual(headerToken, cookieToken)) {
      return {
        isValid: false,
        reason: 'CSRF token mismatch'
      };
    }
  }

  // Check if token should be rotated
  const tokenTimestamp = request.cookies.get('csrf-token-ts')?.value;
  const shouldRotate = tokenTimestamp
    ? (Date.now() - parseInt(tokenTimestamp)) > CSRF_CONFIG.tokenRotationInterval
    : false;

  return {
    isValid: true,
    shouldRotate
  };
}

/**
 * Set CSRF token in response cookies
 */
export function setCSRFToken(response: NextResponse, token?: string, rotate = false): NextResponse {
  const tokenValue = token || generateCSRFToken();
  const now = Date.now().toString();

  // Set CSRF token (must be readable by JS)
  response.cookies.set(CSRF_CONFIG.tokenCookie, tokenValue, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_CONFIG.cookieMaxAge,
    path: '/',
  });

  // Set token timestamp for rotation tracking (httpOnly)
  response.cookies.set('csrf-token-ts', now, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_CONFIG.cookieMaxAge,
    path: '/',
  });

  // Rotate session token if needed
  if (rotate) {
    const sessionToken = generateCSRFToken(48);
    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: CSRF_CONFIG.cookieMaxAge,
      path: '/',
    });
  }

  return response;
}

/**
 * CSRF Middleware for all API routes
 * Validates state-changing requests and ensures CSRF token is present
 */
export function csrfMiddleware(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api/');
  const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);

  // Only protect state-changing API requests
  if (isApiRoute && isStateChangingMethod) {
    // Skip CSRF for admin routes that use ID token auth
    if (pathname.startsWith('/api/admin/')) {
      // Admin routes use Firebase ID token which is inherently CSRF-safe
      return null;
    }

    const validation = validateCSRF(request);

    if (!validation.isValid) {
      console.warn('[CSRF Protection] Request blocked:', {
        path: pathname,
        method: request.method,
        reason: validation.reason,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      });

      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          code: 'CSRF_INVALID'
        },
        { status: 403 }
      );
    }

    // Token rotation if needed
    if (validation.shouldRotate) {
      const response = NextResponse.next();
      return setCSRFToken(response, undefined, true);
    }
  }

  return null;
}

/**
 * Ensure CSRF token exists in response
 */
export function ensureCSRFToken(response: NextResponse, request: NextRequest): NextResponse {
  const existingToken = request.cookies.get(CSRF_CONFIG.tokenCookie);
  
  if (!existingToken) {
    return setCSRFToken(response);
  }

  return response;
}
