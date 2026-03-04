import { NextRequest, NextResponse } from 'next/server';
import { csrfProtectionMiddleware } from '@/lib/csrf';

/**
 * Middleware - handles:
 * 1. Admin dashboard route protection
 * 2. CSRF token protection for all API routes (financial security)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🔐 CSRF Protection: Validate and set CSRF tokens for API routes
  if (pathname.startsWith('/api/')) {
    const csrfResponse = csrfProtectionMiddleware(request);
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
