import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Get authenticated user ID from request
 * This is a simplified version - in production, use proper JWT/Firebase auth
 */
export async function getAuthenticatedUserId(request: NextRequest): Promise<number | null> {
  try {
    // Option 1: Get from custom header (for API calls from frontend)
    const userIdHeader = request.headers.get('x-user-id');
    if (userIdHeader) {
      return parseInt(userIdHeader);
    }

    // Option 2: Get from cookie/session
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('user-id');
    if (userIdCookie?.value) {
      return parseInt(userIdCookie.value);
    }

    // Option 3: Get from Firebase token (implement if using Firebase Auth)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      // const token = authHeader.substring(7);
      // Verify Firebase token and get user ID
      // const decodedToken = await admin.auth().verifyIdToken(token);
      // return getUserIdFromFirebaseUid(decodedToken.uid);
    }

    return null;
  } catch (error) {
    console.error('Error getting authenticated user ID:', error);
    return null;
  }
}

/**
 * Middleware to ensure user is authenticated
 */
export function requireAuth(handler: (request: NextRequest, userId: number) => Promise<Response>) {
  return async (request: NextRequest) => {
    const userId = await getAuthenticatedUserId(request);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return handler(request, userId);
  };
}
