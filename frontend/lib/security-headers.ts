import { NextResponse } from 'next/server';

/**
 * Security Headers Configuration
 * 
 * Implements comprehensive security headers to protect against:
 * - XSS attacks
 * - Clickjacking
 * - MIME type sniffing
 * - Information disclosure
 * - Content injection
 */

export const SECURITY_HEADERS = {
  // Prevent XSS attacks
  'X-XSS-Protection': '1; mode=block',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Prevent DNS prefetching
  'X-DNS-Prefetch-Control': 'off',
  
  // Force HTTPS in production
  ...(process.env.NODE_ENV === 'production' && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  }),
  
  // Content Security Policy (restrictive but functional)
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' data: https:",
    "connect-src 'self' https: wss: ws:",
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; '),
  
  // Permissions Policy (formerly Feature Policy)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()',
    'payment=(self)',
    'usb=()',
    'bluetooth=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=(self)',
    'encrypted-media=(self)',
    'fullscreen=(self)',
    'picture-in-picture=(self)'
  ].join(', '),
} as const;

/**
 * Development-specific security headers (less restrictive)
 */
export const DEV_SECURITY_HEADERS = {
  'X-XSS-Protection': '1; mode=block',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN', // Less restrictive for dev
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // More permissive CSP for development
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:",
    "style-src 'self' 'unsafe-inline' https: http:",
    "font-src 'self' https: http: data:",
    "img-src 'self' data: https: http: blob:",
    "media-src 'self' data: https: http: blob:",
    "connect-src 'self' https: http: wss: ws:",
    "frame-src 'self' https: http:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
} as const;

/**
 * Apply security headers to a NextResponse
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = process.env.NODE_ENV === 'production' 
    ? SECURITY_HEADERS 
    : DEV_SECURITY_HEADERS;
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Create a new response with security headers
 */
export function createSecureResponse(
  body?: BodyInit | null,
  init?: ResponseInit
): NextResponse {
  const response = new NextResponse(body, init);
  return applySecurityHeaders(response);
}

/**
 * Security headers for API routes
 */
export const API_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
} as const;

/**
 * Apply security headers to API responses
 */
export function applyAPISecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(API_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Security headers for financial/sensitive operations
 */
export const FINANCIAL_SECURITY_HEADERS = {
  ...API_SECURITY_HEADERS,
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

/**
 * Apply enhanced security headers for financial operations
 */
export function applyFinancialSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(FINANCIAL_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * CORS headers for API routes
 */
export function applyCORSHeaders(
  response: NextResponse,
  _allowedOrigins: string[] = ALLOWED_ORIGINS
): NextResponse {
  // Note: In production, implement proper origin checking
  const origin = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : 'https://swapsmith.ai';
    
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  
  return response;
}

// Default allowed origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://swapsmith.ai',
      'https://www.swapsmith.ai',
    ];

/**
 * Comprehensive security middleware
 */
export function securityMiddleware(response: NextResponse): NextResponse {
  // Apply basic security headers
  applySecurityHeaders(response);
  
  // Apply CORS headers
  applyCORSHeaders(response);
  
  return response;
}