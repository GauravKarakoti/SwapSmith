import { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';

/**
 * CSRF Protection Utility
 *
 * Implements multiple layers of CSRF protection:
 * 1. Token-based protection using double-submit cookie pattern
 * 2. Origin/Referer header validation for trusted origins
 *
 * Uses the Web Crypto API (globalThis.crypto) for Edge Runtime compatibility.
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

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }

  return diff === 0;
}

/**
 * Generate a CSRF token using Web Crypto API (Edge compatible)
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate CSRF token from NextRequest
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const method = request.method;

  // Skip validation for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  if (!headerToken) {
    console.warn('[CSRF Token] Validation failed: No token in header');
    return false;
  }

  const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
  if (!cookieToken) {
    console.warn('[CSRF Token] Validation failed: No token in cookie');
    return false;
  }

  // Compare tokens (constant-time comparison to prevent timing attacks)
  const match = timingSafeEqual(headerToken, cookieToken);

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
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  return response;
}

/**
 * Middleware for App Router to validate CSRF tokens
 */
export function csrfProtectionMiddleware(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api/');
  const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);

  if (isApiRoute && isStateChangingMethod) {
    if (!validateCsrfToken(request)) {
      return NextResponse.json(
        { error: 'CSRF token validation failed' },
        { status: 403 }
      );
    }

    // 2. Validate Origin/Referer
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Bypass if development and no origin/referer (e.g. curl/postman)
    if (!origin && !referer) {
      if (!isDevelopment) {
        return NextResponse.json(
          { error: 'Missing Origin or Referer header' },
          { status: 403 }
        );
      }
    } else {
      let isAllowed = false;
      
      // Check Origin header first
      if (origin) {
        isAllowed = ALLOWED_ORIGINS.some(allowed => 
          origin === allowed || origin.startsWith(allowed.replace(/\/$/, ''))
        );
      } 
      // Fallback to Referer header
      else if (referer) {
        try {
          const refererHost = new URL(referer).host;
          isAllowed = ALLOWED_ORIGINS.some(allowed => {
            try {
              return refererHost === new URL(allowed).host;
            } catch {
              // Handle cases where allowed origin might not be a full URL
              return refererHost === allowed;
            }
          });
        } catch {
          isAllowed = false;
        }
      }

      if (!isAllowed) {
        return NextResponse.json(
          { error: 'CSRF Origin Validation Failed' }, 
          { status: 403 }
        );
      }
    }
  }

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

function getOrigin(req: NextApiRequest): string | undefined {
  return req.headers.origin as string | undefined;
}

function getReferer(req: NextApiRequest): string | undefined {
  return req.headers.referer as string | undefined;
}

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
 */
export function validateCSRF(req: NextApiRequest): boolean {
  const origin = getOrigin(req);
  const referer = getReferer(req);

  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!origin && !referer) {
    if (isDevelopment) {
      console.warn('[CSRF] No Origin/Referer header found, skipping validation in development');
      return true;
    }
    throw new CSRFError('Missing Origin or Referer header');
  }

  if (origin) {
    const isOriginAllowed = ALLOWED_ORIGINS.some(
      allowed => origin === allowed || origin.startsWith(allowed.replace(/\/$/, ''))
    );

    if (isOriginAllowed) return true;
  }

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

      if (isRefererAllowed) return true;
    }
  }

  console.error('[CSRF] Request blocked - Invalid Origin/Referer:', {
    origin,
    referer,
    allowedOrigins: ALLOWED_ORIGINS,
    method: req.method,
    url: req.url,
  });

  throw new CSRFError('Request origin not allowed');
}

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

export function withCSRF(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  methods: string[] = ['POST', 'PUT', 'DELETE']
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (methods.includes(req.method || '')) {
      if (!csrfGuard(req, res)) return;
    }

    return handler(req, res);
  };
}