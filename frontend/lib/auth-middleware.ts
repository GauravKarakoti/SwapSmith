import { NextRequest } from 'next/server';
import { adminAuth } from './firebase-admin';
import { getUserIdFromFirebaseUid } from './user-service';

/**
 * SECURITY: Get authenticated user ID from request with proper Firebase token verification
 * 
 * This function prevents authorization bypass attacks by:
 * 1. Requiring a valid Firebase ID token in the Authorization header
 * 2. Cryptographically verifying the token with Firebase Admin SDK
 * 3. Only trusting user-controlled headers AFTER token verification
 * 
 * CRITICAL: Never trust x-user-id or cookies without token verification!
 */
export async function getAuthenticatedUserId(request: NextRequest): Promise<number | null> {
  try {
    // SECURITY: Require Authorization header with Bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('Missing or invalid Authorization header');
      return null;
    }

    // SECURITY: Extract and cryptographically verify Firebase ID token
    const idToken = authHeader.substring(7);
    let decodedToken;
    
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error('Firebase token verification failed:', error);
      return null;
    }

    const firebaseUid = decodedToken.uid;

    // SECURITY: After token verification, look up the user in our database
    // This ensures the Firebase user exists in our system
    const userId = await getUserIdFromFirebaseUid(firebaseUid);
    
    if (!userId) {
      console.warn(`Firebase user ${firebaseUid} not found in database`);
      return null;
    }

    return userId;
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
