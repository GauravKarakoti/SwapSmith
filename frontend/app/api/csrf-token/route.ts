import { NextRequest, NextResponse } from 'next/server';
import { generateSecureToken, ENHANCED_CSRF_CONFIG } from '@/lib/enhanced-csrf';
import { applyAPISecurityHeaders } from '@/lib/security-headers';

/**
 * CSRF Token API Route
 * 
 * Provides CSRF tokens for client-side use
 * GET /api/csrf-token - Returns current or new CSRF token
 */

export async function GET(request: NextRequest) {
  try {
    // Get existing token or generate new one
    const existingToken = request.cookies.get(ENHANCED_CSRF_CONFIG.tokenCookie)?.value;
    const token = existingToken || generateSecureToken();
    
    // Create response with token
    const response = NextResponse.json({
      token,
      header: ENHANCED_CSRF_CONFIG.tokenHeader,
      success: true
    });
    
    // Set CSRF token cookie if it doesn't exist
    if (!existingToken) {
      response.cookies.set(ENHANCED_CSRF_CONFIG.tokenCookie, token, ENHANCED_CSRF_CONFIG.cookieSettings);
      
      // Set token timestamp
      response.cookies.set('csrf-token-ts', Date.now().toString(), {
        ...ENHANCED_CSRF_CONFIG.cookieSettings,
        httpOnly: true,
      });
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