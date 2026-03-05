import { NextRequest, NextResponse } from 'next/server';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Enhanced CSRF Protection
 * 
 * Provides comprehensive CSRF protection with:
 * 1. Double-submit cookie pattern
 * 2. SameSite cookie enforcement
 * 3. Origin/Referer validation
 * 4. Custom header validation
 * 5. Token rotation
 */

// Enhanced CSRF configuration
export const ENHANCED_CSRF_CONFIG = {
  tokenCookie: 'csrf-token',
  tokenHeader: 'x-csrf-token',
  sessionCookie: 'session-token',
  
  // Token settings
  tokenLength: 32,
  tokenRotationInterval: 30 * 60 * 1000, // 30 minutes
  
  // Cookie settings
  cookieSettings: {
    httpOnly: false, // Must be accessible by JS to send in header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  },
  
  // Session cookie settings (more secure)
  sessionCookieSettings: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  },
} as const;

// Allowed origins for CSRF validation
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://swapsmith.ai',
      'https://www.swapsmith.ai',
    ];

/**
 * Generate cryptographically secure CSRF token
 */
export function generateSecureToken(length: number = ENHANCED_CSRF_CONFIG.tokenLength): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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
 * Validate origin header against allowed origins
 */
function validateOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  return ALLOWED_ORIGINS.some(allowed => {
    // Exact match
    if (origin === allowed) return true;
    
    // Subdomain match (if allowed origin starts with a dot)
    if (allowed.startsWith('.')) {
      return origin.endsWith(allowed) || origin === allowed.substring(1);
    }
    
    return false;
  });
}

/**
 * Validate referer header against allowed origins
 */
function validateReferer(referer: string | null): boolean {
  if (!referer) return false;
  
  try {
    const refererUrl = new URL(referer);
    const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
    return validateOrigin(refererOrigin);
  } catch {
    return false;
  }
}

/**
 * Enhanced CSRF token validation for App Router
 */
export function validateEnhancedCSRF(request: NextRequest): {
  isValid: boolean;
  reason?: string;
  shouldRotateToken?: boolean;
} {
  const method = request.method;
  
  // Skip validation for safe methods
  if (!method || ['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { isValid: true };
  }
  
  // 1. Origin/Referer validation
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  if (!validateOrigin(origin) && !validateReferer(referer)) {
    return { 
      isValid: false, 
      reason: 'Invalid origin/referer' 
    };
  }
  
  // 2. Custom header validation (simple CSRF protection)
  const customHeader = request.headers.get('x-requested-with');
  if (customHeader !== 'XMLHttpRequest' && !request.headers.get(ENHANCED_CSRF_CONFIG.tokenHeader)) {
    return { 
      isValid: false, 
      reason: 'Missing custom header or CSRF token' 
    };
  }
  
  // 3. Double-submit cookie validation
  const headerToken = request.headers.get(ENHANCED_CSRF_CONFIG.tokenHeader);
  const cookieToken = request.cookies.get(ENHANCED_CSRF_CONFIG.tokenCookie)?.value;
  
  if (!headerToken || !cookieToken) {
    return { 
      isValid: false, 
      reason: 'Missing CSRF token in header or cookie' 
    };
  }
  
  if (!constantTimeEqual(headerToken, cookieToken)) {
    return { 
      isValid: false, 
      reason: 'CSRF token mismatch' 
    };
  }
  
  // 4. Check if token should be rotated (based on age)
  const tokenTimestamp = request.cookies.get('csrf-token-ts')?.value;
  const shouldRotateToken = tokenTimestamp ? 
    (Date.now() - parseInt(tokenTimestamp)) > ENHANCED_CSRF_CONFIG.tokenRotationInterval :
    true;
  
  return { 
    isValid: true, 
    shouldRotateToken 
  };
}

/**
 * Set enhanced CSRF cookies with proper security settings
 */
export function setEnhancedCSRFCookies(
  response: NextResponse, 
  token?: string,
  rotateToken: boolean = false
): NextResponse {
  const tokenValue = token || generateSecureToken();
  const timestamp = Date.now().toString();
  
  // Set CSRF token cookie
  response.cookies.set(ENHANCED_CSRF_CONFIG.tokenCookie, tokenValue, ENHANCED_CSRF_CONFIG.cookieSettings);
  
  // Set token timestamp for rotation
  response.cookies.set('csrf-token-ts', timestamp, {
    ...ENHANCED_CSRF_CONFIG.cookieSettings,
    httpOnly: true, // Timestamp should be httpOnly
  });
  
  // Set session cookie with enhanced security
  if (rotateToken) {
    const sessionToken = generateSecureToken(48); // Longer session token
    response.cookies.set(ENHANCED_CSRF_CONFIG.sessionCookie, sessionToken, ENHANCED_CSRF_CONFIG.sessionCookieSettings);
  }
  
  return response;
}

/**
 * Enhanced CSRF middleware for App Router
 */
export function enhancedCSRFMiddleware(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api/');
  const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
  
  if (isApiRoute && isStateChangingMethod) {
    const validation = validateEnhancedCSRF(request);
    
    if (!validation.isValid) {
      console.warn(`[Enhanced CSRF] Blocked request: ${validation.reason}`, {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        userAgent: request.headers.get('user-agent'),
        path: pathname,
      });
      
      return NextResponse.json(
        { 
          error: 'CSRF validation failed',
          code: 'CSRF_INVALID'
        },
        { status: 403 }
      );
    }
    
    // Create response and potentially rotate token
    const response = NextResponse.next();
    
    if (validation.shouldRotateToken) {
      setEnhancedCSRFCookies(response, undefined, true);
    }
    
    return response;
  }
  
  // For all other requests, ensure CSRF token is set
  const response = NextResponse.next();
  const existingToken = request.cookies.get(ENHANCED_CSRF_CONFIG.tokenCookie);
  
  if (!existingToken) {
    setEnhancedCSRFCookies(response);
  }
  
  return response;
}

/**
 * Enhanced CSRF validation for Pages API routes
 */
export function validateEnhancedCSRFPages(req: NextApiRequest): {
  isValid: boolean;
  reason?: string;
} {
  const method = req.method;
  
  // Skip validation for safe methods
  if (!method || ['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { isValid: true };
  }
  
  // 1. Origin/Referer validation
  const origin = req.headers.origin as string;
  const referer = req.headers.referer as string;
  
  if (!validateOrigin(origin) && !validateReferer(referer)) {
    return { 
      isValid: false, 
      reason: 'Invalid origin/referer' 
    };
  }
  
  // 2. Custom header validation
  const customHeader = req.headers['x-requested-with'] as string;
  const csrfHeader = req.headers[ENHANCED_CSRF_CONFIG.tokenHeader] as string;
  
  if (customHeader !== 'XMLHttpRequest' && !csrfHeader) {
    return { 
      isValid: false, 
      reason: 'Missing custom header or CSRF token' 
    };
  }
  
  // 3. Double-submit cookie validation (if CSRF header is present)
  if (csrfHeader) {
    const cookieHeader = req.headers.cookie;
    const csrfCookie = cookieHeader
      ?.split(';')
      .find(c => c.trim().startsWith(`${ENHANCED_CSRF_CONFIG.tokenCookie}=`))
      ?.split('=')[1];
    
    if (!csrfCookie || !constantTimeEqual(csrfHeader, csrfCookie)) {
      return { 
        isValid: false, 
        reason: 'CSRF token mismatch' 
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Enhanced CSRF guard for Pages API routes
 */
export function enhancedCSRFGuard(req: NextApiRequest, res: NextApiResponse): boolean {
  const validation = validateEnhancedCSRFPages(req);
  
  if (!validation.isValid) {
    console.warn(`[Enhanced CSRF] Blocked Pages API request: ${validation.reason}`, {
      ip: (req.headers['x-forwarded-for'] as string) || (req.headers['x-real-ip'] as string) || req.socket?.remoteAddress || 'unknown',
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: req.headers['user-agent'],
      url: req.url,
    });
    
    res.status(403).json({
      error: 'CSRF validation failed',
      code: 'CSRF_INVALID'
    });
    
    return false;
  }
  
  return true;
}

/**
 * Enhanced CSRF wrapper for Pages API routes
 */
export function withEnhancedCSRF(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  methods: string[] = ['POST', 'PUT', 'DELETE', 'PATCH']
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Only validate for specified methods
    if (methods.includes(req.method || '')) {
      if (!enhancedCSRFGuard(req, res)) {
        return; // Response already sent
      }
    }
    
    return handler(req, res);
  };
}

/**
 * Generate CSRF token for client-side use
 */
export function getCSRFToken(request: NextRequest): string {
  const existingToken = request.cookies.get(ENHANCED_CSRF_CONFIG.tokenCookie)?.value;
  return existingToken || generateSecureToken();
}

/**
 * Utility to check if request has valid session
 */
export function hasValidSession(request: NextRequest): boolean {
  const sessionToken = request.cookies.get(ENHANCED_CSRF_CONFIG.sessionCookie)?.value;
  return !!sessionToken && sessionToken.length >= 48;
}

/**
 * Clear all CSRF-related cookies
 */
export function clearCSRFCookies(response: NextResponse): NextResponse {
  response.cookies.delete(ENHANCED_CSRF_CONFIG.tokenCookie);
  response.cookies.delete('csrf-token-ts');
  response.cookies.delete(ENHANCED_CSRF_CONFIG.sessionCookie);
  return response;
}