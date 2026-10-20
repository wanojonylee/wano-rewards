import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { ToastProvider } from '../src/components/Toast';
import { useAuth } from '../src/store/auth';
import { usePrefs } from '../src/store/prefs';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
  const hydrateAuth = useAuth((s) => s.hydrate);
  const hydratePrefs = usePrefs((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const prefsHydrated = usePrefs((s) => s.hydrated);
  const locale = usePrefs((s) => s.locale);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 10_000, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );

  useEffect(() => {
    // Preferences first so the i18n locale is set before the first API payload
    // is fetched/localized; both stores expose a `hydrated` flag.
    hydratePrefs().then(() => hydrateAuth());
  }, [hydrateAuth, hydratePrefs]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError, hydrated]);

  // API payloads are localized at request time, so cached data must be
  // invalidated/refetched whenever the language changes.
  useEffect(() => {
    queryClient.invalidateQueries();
  }, [locale, queryClient]);

  if ((!fontsLoaded && !fontError) || !hydrated || !prefsHydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="session/[id]" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
