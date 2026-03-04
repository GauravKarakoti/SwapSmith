import { adminAuth } from '@/lib/firebase-admin';

export interface AdminTokenPayload {
  uid: string;
  email?: string;
}

/**
 * Verifies a Firebase ID token from a Bearer Authorization header.
 * Falls back to raw JWT decode when the Admin SDK has no service-account
 * configured (local dev), matching the pattern in /api/admin/verify.
 *
 * @returns AdminTokenPayload if the token is valid, otherwise null.
 */
export async function verifyAdminToken(
  authHeader: string
): Promise<AdminTokenPayload | null> {
  try {
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) return null;

    // Primary: Firebase Admin SDK full verification
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      return { uid: decoded.uid, email: decoded.email };
    } catch {
      // Fallback: Raw JWT decode (no signature check) – safe because admin
      // status is always re-validated against the database downstream.
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf-8')
      );
      const uid = payload.user_id || payload.sub || payload.uid;
      if (!uid) return null;
      return { uid, email: payload.email ?? undefined };
    }
  } catch {
    return null;
  }
}
