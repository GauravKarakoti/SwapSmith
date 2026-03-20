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

  // 1. Input Validation
  const inputValidationResponse = validateInputSize(request);
  if (inputValidationResponse) return inputValidationResponse;

  // 2. Admin Dashboard Protection
  if (pathname.startsWith('/admin/dashboard')) {
    const adminSession = request.cookies.get('admin-session');
    if (!adminSession?.value) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith('/api/')) {
    // Routes that use raw fetch() and don't require strict CSRF protection
    const csrfExemptPaths = [
      '/api/track', 
      '/api/user/ensure', 
      '/api/rewards/wallet-connected',
      '/api/rewards/daily-login',
      '/api/security-scan' // <-- Added this endpoint
    ];

    const isExempt = csrfExemptPaths.some(path => pathname.startsWith(path));

    // A. Unified CSRF Protection
    if (!isExempt) {
      const csrfResponse = csrfMiddleware(request);
      if (csrfResponse) return csrfResponse; 
    }

    // B. Rate Limiting
    const rateLimitConfig = getRateLimitConfig(pathname);
    const rateLimitResponse = rateLimitMiddleware(request, rateLimitConfig);
    if (rateLimitResponse) return rateLimitResponse; 

    // C. Create response and ensure CSRF token is attached
    let finalResponse = NextResponse.next();
    finalResponse = ensureCSRFToken(finalResponse, request);
    
    // D. Apply security headers
    return securityMiddleware(finalResponse);
  }

  // 4. Apply security headers to all other (non-API) routes
  return securityMiddleware(NextResponse.next());
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
