"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Log config status (for debugging)
if (typeof window !== 'undefined') {
  console.log('Firebase Config Status:', {
    apiKey: !!firebaseConfig.apiKey,
    authDomain: !!firebaseConfig.authDomain,
    projectId: !!firebaseConfig.projectId,
    allConfigsPresent: Object.values(firebaseConfig).every(v => !!v)
  });
}

// Fallback for CI/Build environment where keys might be missing
// This prevents build failures during static site generation
const isBuild = typeof window === 'undefined' && !firebaseConfig.apiKey;

let app;

try {
    const apps = getApps();
    if (!apps.length) {
        if (isBuild) {
             console.warn("Firebase initialized in dummy mode for build.");
             app = initializeApp({
                 apiKey: "dummy-api-key-for-build",
                 authDomain: "dummy.firebaseapp.com",
                 projectId: "dummy-project"
             }, "dummy-app");
        } else {
             app = initializeApp(firebaseConfig);
        }
    } else {
        // Use the existing default app if available, otherwise the first one
        app = apps.length > 0 ? apps[0] : undefined;
    }
} catch (error) {
    console.error("Firebase initialization error:", error);
    // If initialization fails, try to use a dummy app if in build mode
    if (isBuild) {
         try {
             app = initializeApp({
                 apiKey: "dummy-api-key-for-build",
                 authDomain: "dummy.firebaseapp.com",
                 projectId: "dummy-project"
             }, 'dummy-app-' + Date.now());
         } catch(e) {
             console.error("Failed to recover with dummy app:", e);
             throw error;
         }
    } else {
        throw error;
    }
}

export const auth = getAuth(app);
export default app;
