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

      // Build list of allowed origins from environment, mirroring csrf.ts behavior.
      // Example env values:
      //   NEXT_PUBLIC_APP_URL="http://localhost:3000"
      //   ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3002"
      const rawAllowedOrigins =
        process.env.NEXT_PUBLIC_APP_URL || process.env.ALLOWED_ORIGINS || '';
      const allowedOrigins = rawAllowedOrigins
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0);

      // Derive a default origin from protocol + Host header as a fallback when no
      // explicit allowed origins are configured. This respects external ports in
      // Docker / proxy setups (e.g. localhost:3002 mapped to container:3000).
      const hostHeader = request.headers.get('host');
      const defaultOrigin = hostHeader
        ? `${request.nextUrl.protocol}//${hostHeader}`
        : undefined;

      let isAllowed = false;

      // Decide which origin value to validate:
      //   1. Prefer the Origin header when present.
      //   2. Otherwise, extract the origin portion from the Referer header.
      let originToCheck: string | null = null;
      if (originHeader) {
        originToCheck = originHeader;
      } else if (refererHeader) {
        try {
          originToCheck = new URL(refererHeader).origin;
        } catch {
          originToCheck = null;
        }
      }

      if (originToCheck) {
        if (allowedOrigins.length > 0) {
          // Use explicitly configured allowed origins when available.
          if (allowedOrigins.includes(originToCheck)) {
            isAllowed = true;
          }
        } else if (defaultOrigin) {
          // Fallback to strict equality against the host-based origin.
          if (originToCheck === defaultOrigin) {
            isAllowed = true;
          }
        }
      }

      // If validation fails or we have no usable Origin/Referer, reject the request.
      if (!isAllowed) {
        return new NextResponse(
          JSON.stringify({
            message: 'CSRF validation failed',
            reason: 'Origin or Referer header mismatch or missing',
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
