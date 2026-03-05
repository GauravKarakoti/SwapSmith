import { NextRequest, NextResponse } from 'next/server';
import { csrfProtectionMiddleware } from '@/lib/csrf';

/**
 * Middleware - handles:
 * 1. Admin dashboard route protection
 * 2. CSRF token protection for all API routes (financial security)
 *
 * NOTE: /api/admin/* routes are exempt from CSRF token checking because they
 * authenticate via Firebase ID tokens, which already provide CSRF protection
 * (a third-party site cannot obtain the user's Firebase ID token).
 * 
 * JSDoc Updated: Includes Origin/Referer validation details.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/dashboard/:path*', '/api/:path*'],
};
