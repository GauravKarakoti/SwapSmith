// config.ts
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// For local development, we need to use the machine's IP address instead of localhost
// when running on a physical device. For Android emulator, 10.0.2.2 points to localhost.
const IS_DEV = process.env.NODE_ENV === 'development';

// Get the LAN IP address if available through Expo constants
const uri = Constants.expoConfig?.hostUri;
const lanIp = uri ? uri.split(':')[0] : 'localhost';

const LOCAL_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : `http://${lanIp}:3000`;
// Fallback to localhost if not found
const API_BASE_URL = IS_DEV ? LOCAL_API_URL : 'https://swapsmith.vercel.app'; // Replace with actual prod URL

export const config = {
  API_BASE_URL,
  FIREBASE: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "", // Can add this later if we set up env vars
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "swapsmith-ai.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "swapsmith-ai",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "swapsmith-ai.appspot.com",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef",
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-ABCDEF123",
  }
};
