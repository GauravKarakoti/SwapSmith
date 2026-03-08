import { NextRequest, NextResponse } from 'next/server';
import { csrfMiddleware, ensureCSRFToken } from '@/lib/csrf-middleware';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiter';
import { securityMiddleware } from '@/lib/security-headers';

/**
 * Comprehensive Security Middleware
 * 
 * Handles in order:
 * 1. CSRF protection for state-changing API requests
 * 2. Rate limiting for all API routes
 * 3. Security headers for all responses
 * 4. Admin dashboard protection
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
