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

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/dashboard/:path*'],
};
