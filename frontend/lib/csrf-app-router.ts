import { NextRequest, NextResponse } from 'next/server';

/**
 * CSRF Protection Utility for Next.js App Router (Route Handlers)
 * 
 * Validates requests by checking Origin/Referer headers to ensure
 * requests originate from trusted sources.
 */

// List of allowed origins - configure based on your deployment
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://swapsmith.ai',
      'https://www.swapsmith.ai',
    ];

// Custom error class for CSRF validation failures
export class CSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CSRFError';
  }
}

/**
 * Extract the origin from request headers
 */
function getOrigin(req: NextRequest): string | undefined {
  return req.headers.get('origin') || undefined;
}

/**
 * Extract the referer from request headers
 */
function getReferer(req: NextRequest): string | undefined {
  return req.headers.get('referer') || undefined;
}

/**
 * Extract host from referer or request URL
 */
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
 * 
 * @param req - Next.js App Router request
 * @returns true if valid, throws CSRFError if invalid
 */
export function validateCSRF(req: NextRequest): boolean {
  const origin = getOrigin(req);
  const referer = getReferer(req);
  
  // If this is a server-side GET request (like from getServerSideProps), skip CSRF
  // We only validate POST, PUT, DELETE methods
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }
  
  // For development: skip CSRF check if no origin/referer (e.g., curl requests)
  // In production, you may want to be stricter
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!origin && !referer) {
    if (isDevelopment) {
      console.warn('[CSRF] No Origin/Referer header found, skipping validation in development');
      return true;
    }
    throw new CSRFError('Missing Origin or Referer header');
  }
  
  // Check Origin header
  if (origin) {
    const isOriginAllowed = ALLOWED_ORIGINS.some(allowed => 
      origin === allowed || origin.startsWith(allowed.replace(/\/$/, ''))
    );
    
    if (isOriginAllowed) {
      return true;
    }
  }
  
  // Check Referer header
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
      
      if (isRefererAllowed) {
        return true;
      }
    }
  }
  
  // If we reach here, neither origin nor referer matched
  console.error('[CSRF] Request blocked - Invalid Origin/Referer:', {
    origin,
    referer,
    allowedOrigins: ALLOWED_ORIGINS,
    method: req.method,
    url: req.url,
  });
  
  throw new CSRFError('Request origin not allowed');
}

/**
 * Middleware-style handler for CSRF validation
 * Use this at the start of your Route Handler
 * 
 * @param req - Next.js App Router request
 * @returns NextResponse with error if invalid, null if valid
 */
export function csrfGuard(req: NextRequest): NextResponse | null {
  try {
    validateCSRF(req);
    return null;
  } catch (error) {
    const message = error instanceof CSRFError ? error.message : 'CSRF validation failed';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

