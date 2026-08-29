import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { setUnauthorizedHandler } from '@/api/client';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ToastHost, toast } from '@/components/ui/Toast';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useUiStore } from '@/store/uiStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const kind = (error as { kind?: string }).kind;
        if (kind === 'unauthorized' || kind === 'notFound') return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      networkMode: 'always',
    },
    mutations: { networkMode: 'always' },
  },
});

function RootNavigator() {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="player"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
      </Stack>
      <OfflineBanner />
      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydrateUi = useUiStore((s) => s.hydrate);
  const signOut = useAuthStore((s) => s.signOut);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([hydrateTheme(), hydrateUi(), hydrateAuth()]);
      if (cancelled) return;
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateAuth, hydrateTheme, hydrateUi]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
      queryClient.clear();
      toast.error('Your session expired. Sign in again.');
      router.replace('/(auth)/login');
    });
    return () => setUnauthorizedHandler(null);
  }, [router, signOut]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
