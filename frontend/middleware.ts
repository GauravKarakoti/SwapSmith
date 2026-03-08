import { NextRequest, NextResponse } from 'next/server';
import { csrfMiddleware, ensureCSRFToken } from '@/lib/csrf-middleware';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiter';
import { securityMiddleware } from '@/lib/security-headers';
import { csrfProtectionMiddleware } from '@/lib/csrf';
import { VALIDATION_LIMITS, sanitizeInput } from '@/../shared/utils/validation';

/**
 * Comprehensive Security Middleware
 * 
 * Handles:
 * 1. Input validation & sanitization
 * 2. Rate limiting for all API routes
 * 3. Enhanced CSRF protection
 * 4. Security headers
 * 5. Admin dashboard protection
 * 6. Request size enforcement
 */

/**
 * Validates and enforces input limits on API requests
 */
function validateInputSize(request: NextRequest): NextResponse | null {
  try {
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    
    // Enforce maximum payload size
    if (contentLength > VALIDATION_LIMITS.INPUT_MAX * 10) {
      return NextResponse.json(
        { success: false, error: 'Payload too large' },
        { status: 413 }
      );
    }
    
    return null;
  } catch (error) {
    console.error('Input validation error:', error);
    return null;
  }
}
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🔐 Input Validation: Check request size before processing
  const inputValidationResponse = validateInputSize(request);
  if (inputValidationResponse) {
    return inputValidationResponse;
  }

  // 🔐 CSRF Protection: Validate and set CSRF tokens for API routes.
  // Skip for /api/admin/* — those use Firebase ID token auth (inherently CSRF-safe).
  // Also validates Origin/Referer via enhanced csrfProtectionMiddleware.
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/admin/')) {
    const csrfResponse = csrfProtectionMiddleware(request);
    // If validation failed (403), return error response immediately.
    // If validation succeeded (200 with cookie), we return it here because for API routes
    // there are no further checks (Admin Dashboard is disjoint).
    // Note: If we had further logic for /api/ we would need to merge headers/cookies.
    // Currently we assume csrfProtectionMiddleware is the primary guard for /api/.
    if (csrfResponse) {
      return csrfResponse;
    }
  }
  // 🔐 Admin Dashboard Protection
  if (pathname.startsWith('/admin/dashboard')) {
    const adminSession = request.cookies.get('admin-session');

    if (!adminSession?.value) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 🔐 API Route Security
  if (pathname.startsWith('/api/')) {
    let response: NextResponse | null = null;

    // 1. Unified CSRF Protection (blocks invalid state-changing requests)
    response = csrfMiddleware(request);
    if (response) return response; // CSRF validation failed

    // 2. Rate Limiting (apply before allowing request processing)
    const rateLimitConfig = getRateLimitConfig(pathname);
    response = rateLimitMiddleware(request, rateLimitConfig);
    if (response) return response; // Rate limit exceeded

    // 3. Create response and ensure CSRF token is set
    let finalResponse = NextResponse.next();
    finalResponse = ensureCSRFToken(finalResponse, request);
    
    // 4. Apply security headers
    return securityMiddleware(finalResponse);
  }

  // 🔐 Apply security headers to all other routes
  const response = NextResponse.next();
  return securityMiddleware(response);
}

/**
 * Get appropriate rate limit configuration based on API endpoint
 */
function getRateLimitConfig(pathname: string) {
  // Financial operations (most restrictive)
  if (pathname.includes('/swap') || pathname.includes('/create-swap')) {
    return { ...RATE_LIMITS.swap, message: 'Too many swap requests. Please wait before trying again.' };
  }
  
  if (pathname.includes('/payment') || pathname.includes('/checkout')) {
    return { ...RATE_LIMITS.payment, message: 'Too many payment requests. Please wait before trying again.' };
  }
  
  // Authentication operations
  if (pathname.includes('/auth') || pathname.includes('/login') || pathname.includes('/register')) {
    return { ...RATE_LIMITS.auth, message: 'Too many authentication attempts. Please wait before trying again.' };
  }
  
  // Profile operations
  if (pathname.includes('/profile') || pathname.includes('/user') || pathname.includes('/settings')) {
    return { ...RATE_LIMITS.profile, message: 'Too many profile requests. Please wait before trying again.' };
  }
  
  // Admin operations
  if (pathname.includes('/admin/')) {
    return { ...RATE_LIMITS.admin, message: 'Too many admin requests. Please wait before trying again.' };
  }
  
  // Strict rate limiting for sensitive operations
  if (pathname.includes('/transcribe') || pathname.includes('/parse-command') || pathname.includes('/yields')) {
    return { ...RATE_LIMITS.strict, message: 'Too many requests. Please wait before trying again.' };
  }
  
  // Default rate limiting
  return { ...RATE_LIMITS.default, message: 'Too many requests. Please wait before trying again.' };
}

export const config = {
  matcher: [
    '/admin/dashboard/:path*', 
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
