import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware – protects /admin/dashboard by verifying an admin session.
 * The verify check is done client-side (sessionStorage token) but we add
 * a lightweight layer here that blocks direct navigation without any token
 * by checking the cookie set after login.
 *
 * Full server-side token verification happens in /api/admin/analytics.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Admin Dashboard Protection
  // Only guard the dashboard route
  if (pathname.startsWith('/admin/dashboard')) {
    // We cannot read sessionStorage in middleware (runs on the edge).
    // Instead we rely on a short-lived cookie set by the login page.
    const adminSession = request.cookies.get('admin-session');

    if (!adminSession?.value) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. CSRF Protection (Origin / Referer Check) for API Routes
  if (pathname.startsWith('/api/')) {
    // Only check mutating requests (POST, PUT, DELETE, PATCH, etc.)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      const originHeader = request.headers.get('origin');
      const refererHeader = request.headers.get('referer');
      
      // request.nextUrl.origin handles the protocol + host construction automatically
      // e.g. http://localhost:3000 or https://my-app.com
      const currentOrigin = request.nextUrl.origin;
      
      let isAllowed = false;

      // Check Origin first (standard behavior)
      if (originHeader) {
        // Strict equality check against current origin
        if (originHeader === currentOrigin) {
          isAllowed = true;
        }
      } 
      // Fallback to Referer if Origin is missing (some browsers/environments)
      else if (refererHeader) {
        if (refererHeader.startsWith(currentOrigin)) {
          isAllowed = true;
        }
      }

      // If neither matches, reject the request
      if (!isAllowed) {
        return new NextResponse(
          JSON.stringify({ 
            message: 'CSRF validation failed', 
            reason: 'Origin or Referer header mismatch or missing' 
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/dashboard/:path*',
    '/api/:path*',
  ],
};
