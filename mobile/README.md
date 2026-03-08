# SwapSmith Mobile App

This is the dedicated React Native mobile application for SwapSmith, providing a superior, native voice integration experience and a premium dark-themed UI that mirrors the web application.

## PRODUCTION .aab FILE : https://expo.dev/artifacts/eas/uKsrKD7WPb3G8tMvMDgjcR.aab
## ANDROID APK: https://expo.dev/accounts/gauravkarakoti/projects/SwapSmith/builds/b291d479-9abe-49d9-b311-001ddf585f7b
![Download QR](./assets/QR.png)

## 📱 Prerequisites

Before you begin, ensure you have the following installed:
1. **Node.js** (v18 or newer recommended)
2. **npm** or **yarn**
3. **Expo Go** app installed on your physical mobile device:
   - [Expo Go for iOS (App Store)](https://apps.apple.com/us/app/expo-go/id982107779)
   - [Expo Go for Android (Google Play)](https://play.google.com/store/apps/details?id=host.exp.exponent)

## 🛠️ Installation

1. Navigate to the mobile app directory from the root of the SwapSmith project:
   ```bash
   cd mobile
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

## ⚙️ Configuration & Environment Variables

The mobile app relies on backend APIs and Firebase Authentication. You must configure the environment variables for it to function correctly.

1. Open `src/config.ts` in your code editor.
2. Locate the `FIREBASE` configuration object.
3. Replace the placeholder values with your actual Firebase project credentials (the same ones used in your web `.env` file).

```typescript
// Example in src/config.ts
export const config = {
  // ...
  FIREBASE: {
    apiKey: "YOUR_ACTUAL_FIREBASE_API_KEY", // CRITICAL: Must be populated
    authDomain: "swapsmith-ai.firebaseapp.com",
    projectId: "swapsmith-ai",
    storageBucket: "swapsmith-ai.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef",
    measurementId: "G-ABCDEF123",
  }
};
```

> **Note on Firebase Auth**: If you want to bypass the Firebase login screen during UI development, you can temporarily mock the `useAuth` hook in `src/hooks/useAuth.ts` and bypass the `initializeApp` logic in `src/services/firebase.ts`.

## 🚀 Running the App

1. **Start the Expo Development Server**:
   ```bash
   npx expo start -c
   ```
   *(The `-c` flag clears the bundler cache to prevent stale builds).*

2. **Connect your device**:
   - Open your terminal and look for the large QR code.
   - **On iOS**: Open your default Camera app and scan the QR code. Tap the prompt to open it in Expo Go.
   - **On Android**: Open the Expo Go app and tap "Scan QR Code", then scan the code in your terminal.

3. **Alternative - Secure Tunneling**:
   If you face local network or firewall issues (like `java.io.IOException`), run the server via an ngrok tunnel:
   ```bash
   npx expo start --tunnel
   ```

## 📂 Project Structure

- `src/components/` - Reusable UI components (like `CoinCard`).
- `src/screens/` - The main views of the app, split into `auth` and `main` flows (Terminal, Portfolio, Prices).
- `src/navigation/` - React Navigation stack and bottom tab configurations.
- `src/services/` - API client and Firebase initialization logic.
- `src/hooks/` - Custom React hooks including `useAuth` for authentication state.
- `src/theme/` - Centralized design tokens (colors, typography) matching the web app.

## 🎙️ Functionality Details
- **AI Terminal**: The core feature; chat interface designed for voice/text commands to execute on-chain swaps.
- **API Proxy**: Makes authenticated requests to your local (`localhost:3000`) or production Next.js backend by automatically attaching the necessary `x-user-id` headers.
