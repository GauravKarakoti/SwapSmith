import { toast } from 'react-hot-toast';
import { auth } from './firebase';

export async function authenticatedFetch(
  url: string,
  options: RequestInit & { suppressErrorToast?: boolean } = {}
): Promise<Response> {
  const { suppressErrorToast = false, ...requestOptions } = options;

  // Get user ID from localStorage or session
  let userId = localStorage.getItem('user-db-id');
  
  // If no DB user ID, try to fetch/create one
  if (!userId) {
    const firebaseUid = localStorage.getItem('firebase-uid');
    if (firebaseUid) {
      try {
        const response = await fetch('/api/user/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            firebaseUid,
            walletAddress: localStorage.getItem('wallet-address') 
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          userId = data.userId.toString();
          if (userId) {
            localStorage.setItem('user-db-id', userId);
          }
        }
      } catch (error) {
        console.error('Error ensuring user:', error);
      }
    }
  }
  
  const headers = new Headers(requestOptions.headers);
  
  // 1. Attach Database User ID
  if (userId) {
    headers.set('x-user-id', userId);
  }
  
  // 2. Attach Firebase Authorization Token (THIS IS WHAT WAS MISSING)
  if (auth && auth.currentUser) {
    try {
      // Force refresh if necessary to ensure it's valid
      const idToken = await auth.currentUser.getIdToken();
      headers.set('Authorization', `Bearer ${idToken}`);
    } catch (tokenError) {
      console.error('Error getting Firebase ID token:', tokenError);
    }
  }
  
  // 3. Attach CSRF Token for state-changing requests (from our previous fix)
  const method = options.method?.toUpperCase() || 'GET';
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      const csrfCookie = cookies.find(c => c.trim().startsWith('csrf-token='));
      
      if (csrfCookie) {
        const token = csrfCookie.split('=')[1]?.trim();
        if (token) {
          headers.set('x-csrf-token', token);
        }
      }
    }
  }
  
  try {
    const response = await fetch(url, {
      ...requestOptions,
      headers, // <-- Now contains Authorization, x-user-id, and x-csrf-token
    });

    if (!response.ok && !suppressErrorToast) {
      const clone = response.clone();
      try {
        const errorData = await clone.json();
        const errorMessage = errorData.message || errorData.error || `Error ${response.status}`;
        toast.error(errorMessage, { id: url }); 
      } catch {
        toast.error(`Request failed details: ${response.statusText}`, { id: url });
      }
    }

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Network Error';
    if (!suppressErrorToast) {
      toast.error(msg);
    }
    throw error;
  }
}

/**
 * Set user ID in storage (call this after login/register)
 */
export function setUserId(userId: string | number) {
  localStorage.setItem('user-db-id', userId.toString());
}

/**
 * Set Firebase UID
 */
export function setFirebaseUid(uid: string) {
  localStorage.setItem('firebase-uid', uid);
}

/**
 * Get stored user ID
 */
export function getUserId(): string | null {
  return localStorage.getItem('user-db-id');
}

/**
 * Clear stored user ID (call on logout)
 */
export function clearUserId() {
  localStorage.removeItem('user-db-id');
  localStorage.removeItem('firebase-uid');
}

/**
 * Ensure user exists in database and return user ID
 */
export async function ensureUser(firebaseUid: string, walletAddress?: string): Promise<number | null> {
  try {
    const response = await fetch('/api/user/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebaseUid, walletAddress }),
    });
    
    if (response.ok) {
      const data = await response.json();
      setUserId(data.userId);
      return data.userId;
    }
    
    return null;
  } catch (error) {
    console.error('Error ensuring user:', error);
    return null;
  }
}
