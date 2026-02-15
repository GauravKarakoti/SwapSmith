/**
 * Helper function to make authenticated API calls
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
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
  
  const headers = new Headers(options.headers);
  
  if (userId) {
    headers.set('x-user-id', userId);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
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
