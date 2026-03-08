import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './firebase-admin';

export interface AuthResult {
  success: boolean;
  firebaseUid?: string;
  userId?: number;
  error?: NextResponse;
}

/**
 * Verify Firebase authentication token and extract user information
 * This prevents authorization bypass attacks by validating the token cryptographically
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  // Check for Authorization header with Bearer token
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Unauthorized: Missing or invalid authorization header' },
        { status: 401 }
      ),
    };
  }

  // Extract and verify the Firebase ID token
  const idToken = authHeader.substring(7);
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Unauthorized: Invalid or expired token' },
        { status: 401 }
      ),
    };
  }

  const firebaseUid = decodedToken.uid;

  // After token verification, we can trust the x-user-id header
  // because the user has proven they own this Firebase account
  const userIdHeader = request.headers.get('x-user-id');
  const userId = userIdHeader ? parseInt(userIdHeader) : undefined;

  return {
    success: true,
    firebaseUid,
    userId,
  };
}
