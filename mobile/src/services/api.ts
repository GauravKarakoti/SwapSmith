// src/services/api.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { config } from "../config";

/**
 * Helper function to make authenticated API calls
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${config.API_BASE_URL}${endpoint}`;
  console.log('Fetching:', url);

  // Get user ID from AsyncStorage
  let userId = await AsyncStorage.getItem('user-db-id');

  // If no DB user ID, try to fetch/create one
  if (!userId) {
    const firebaseUid = await AsyncStorage.getItem('firebase-uid');
    if (firebaseUid) {
      try {
        const response = await fetch(`${config.API_BASE_URL}/api/user/ensure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebaseUid,
            walletAddress: await AsyncStorage.getItem('wallet-address')
          }),
        });

        if (response.ok) {
          const data = await response.json();
          userId = data.userId.toString();
          if (userId) {
            await AsyncStorage.setItem('user-db-id', userId);
          }
        }
      } catch (error) {
        console.error('Error ensuring user:', error);
      }
    }
  }

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (userId) {
    headers.set('x-user-id', userId);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Ensure user exists in database and return user ID
 */
export async function ensureUser(firebaseUid: string, walletAddress?: string): Promise<string | null> {
  try {
    const response = await fetch(`${config.API_BASE_URL}/api/user/ensure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebaseUid, walletAddress }),
    });

    if (response.ok) {
      const data = await response.json();
      const userIdStr = data.userId.toString();
      await AsyncStorage.setItem('user-db-id', userIdStr);
      return userIdStr;
    }

    return null;
  } catch (error) {
    console.error('Error ensuring user:', error);
    return null;
  }
}
