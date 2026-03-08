import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/theme/theme';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  useEffect(() => {
    async function prepare() {
      if (fontsLoaded) {
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={theme.colors.background} />
      <NavigationContainer theme={{
        dark: true,
        colors: {
          primary: theme.colors.accent,
          background: theme.colors.background,
          card: theme.colors.card,
          text: theme.colors.primary,
          border: theme.colors.border,
          notification: theme.colors.accent,
        },
        fonts: {
          regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
          medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' },
          bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
          heavy: { fontFamily: 'Inter_900Black', fontWeight: '900' },
        }
      }}>
        <AppNavigator />
      </NavigationContainer>
    </>
  );
}
