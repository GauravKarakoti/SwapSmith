import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, setCSRFToken, CSRF_CONFIG } from '@/lib/csrf-middleware';
import { applyAPISecurityHeaders } from '@/lib/security-headers';

/**
 * CSRF Token API Route
 * 
 * Provides CSRF tokens for client-side use in state-changing requests
 * GET /api/csrf-token - Returns current or new CSRF token
 */

export async function GET(request: NextRequest) {
  try {
    // Get existing token or generate new one
    const existingToken = request.cookies.get(CSRF_CONFIG.tokenCookie)?.value;
    const token = existingToken || generateCSRFToken();
    
    // Create response with token details
    const response = NextResponse.json({
      token,
      header: CSRF_CONFIG.tokenHeader,
      success: true
    });
    
    // Set CSRF token cookie if it doesn't already exist
    if (!existingToken) {
      setCSRFToken(response, token);
    }
    
    // Apply security headers
    return applyAPISecurityHeaders(response);
    
  } catch (error) {
    console.error('[CSRF Token API] Error:', error);
    
    const response = NextResponse.json({
      error: 'Failed to generate CSRF token',
      success: false
    }, { status: 500 });
    
    return applyAPISecurityHeaders(response);
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  
  // Apply CORS headers
  response.headers.set('Access-Control-Allow-Origin', request.headers.get('origin') || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return applyAPISecurityHeaders(response);
}