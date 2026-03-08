// src/services/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth } from "firebase/auth";
import { config } from "../config";

const firebaseConfig = {
    apiKey: config.FIREBASE.apiKey,
    authDomain: config.FIREBASE.authDomain,
    projectId: config.FIREBASE.projectId,
    storageBucket: config.FIREBASE.storageBucket,
    messagingSenderId: config.FIREBASE.messagingSenderId,
    appId: config.FIREBASE.appId,
    measurementId: config.FIREBASE.measurementId,
};

// Initialize Firebase App only if API Key is somewhat valid
let app: any;
export let auth: any;

try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5) {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = initializeAuth(app);
    }
} catch (e) {
    console.warn("Firebase not initialized due to missing API Key");
}

export default app;
