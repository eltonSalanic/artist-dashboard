// Side-effect import, and it must stay first: it configures the API client and
// the session source that every hook below reaches for.
import '@/lib/api-client-setup';

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession } from '@artist/api-client';
import { supabase } from '@/lib/supabase';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A phone switches networks mid-session far more often than a browser
      // reloads, so a failed request is more often transient than wrong.
      retry: 2,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const { session, loading } = useSession();

  useEffect(() => {
    // supabase-js refreshes the access token on a `setTimeout`, and the OS
    // suspends timers in the background. Without this, an app left alone for
    // an hour wakes up holding an expired token and every request 401s.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    });
    void supabase.auth.startAutoRefresh();

    return () => {
      subscription.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  useEffect(() => {
    // The app is not reloaded between accounts the way a browser navigation
    // reloads the web app, so without this the next person to sign in on this
    // phone would briefly see the previous one's board out of the cache.
    if (session === null) queryClient.clear();
  }, [session]);

  // Hold the splash screen until the stored session has been read. Routing on
  // an unhydrated session flashes the sign-in screen on every cold start.
  if (loading) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack>
          <Stack.Protected guard={session !== null}>
            {/* The tab group owns its own headers, one stack per tab. */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={session === null}>
            <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
