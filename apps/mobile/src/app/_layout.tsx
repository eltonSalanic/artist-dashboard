// Side-effect import, and it must stay first: it configures the API client and
// the session source that every hook below reaches for.
import '@/lib/api-client-setup';
// Next, so a crash during the first render is reported.
import '@/lib/sentry';

import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  focusManager,
} from '@tanstack/react-query';
import { Stack } from 'expo-router/stack';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession } from '@artist/api-client';
import { reportError } from '@/lib/report-error';
import { supabase } from '@/lib/supabase';
import { POSTER_FONTS } from '@/theme/poster';

void SplashScreen.preventAutoHideAsync();

// A render crash anywhere below shows this instead of a white screen.
export { CrashScreen as ErrorBoundary } from '@/components/crash-screen';

const queryClient = new QueryClient({
  // Screens show their own load errors and hooks alert on failed saves; these
  // only send the unexpected ones (bugs, 5xx) to the error reporter.
  queryCache: new QueryCache({
    onError: (error, query) => reportError(error, { queryKey: query.queryKey }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) =>
      reportError(error, { mutationKey: mutation.options.mutationKey }),
  }),
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
  const { session, loading: sessionLoading } = useSession();
  // The hub and calendar set their numbers in Figtree. Held behind the splash
  // like the session, so the first frame is not system type swapping to
  // Figtree a beat later. A font that fails to load is not worth a broken
  // launch: the text falls back to the system face.
  const [fontsLoaded, fontError] = useFonts(POSTER_FONTS);
  const loading = sessionLoading || (!fontsLoaded && fontError === null);

  useEffect(() => {
    // supabase-js refreshes the access token on a `setTimeout`, and the OS
    // suspends timers in the background. Without this, an app left alone for
    // an hour wakes up holding an expired token and every request 401s.
    //
    // The same event stands in for the browser's window focus, which React
    // Native does not have: coming back to the app refetches stale queries,
    // so changes made on web meanwhile show up without a pull-to-refresh.
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
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
    // The app is not reloaded between accounts, so without this the next
    // person to sign in on this phone would see the previous one's board out
    // of the cache. Web does the same in `clearCacheOnUserChange`.
    if (session === null) queryClient.clear();
  }, [session]);

  // Hold the splash screen until the stored session has been read. Routing on
  // an unhydrated session flashes the sign-in screen on every cold start.
  if (loading) return null;

  return (
    // Gesture Handler does nothing without this root, and says nothing about
    // it either — the drag-to-reorder list would simply never pick up. The
    // native stack does not provide one (only expo-router's JS stack does).
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack>
            <Stack.Protected guard={session !== null}>
              {/* The tab group owns its own headers, one stack per tab. */}
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={session === null}>
              {/* No bar: the screen's own masthead says what it is, and a
                  white system bar over the cream page read as another app. */}
              <Stack.Screen name="sign-in" options={{ title: 'Sign in', headerShown: false }} />
            </Stack.Protected>
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
