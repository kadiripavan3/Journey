import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/api/fetcher';
import { useGetMe } from '@/api/generated/journey';
import { OnboardingProvider, useOnboarding } from '@/auth/onboarding';
import { SessionProvider, useSession } from '@/auth/session';
import { useTheme } from '@/theme';
import { loadAppearance } from '@/theme/appearance';
import { Button } from '@/ui/Button';
import { Txt } from '@/ui/Txt';

// A screen that breaks while drawing shows a friendly page with a way to try again.
export { ErrorBoundary } from '@/features/navigation/ErrorBoundary';

void SplashScreen.preventAutoHideAsync();
void loadAppearance();

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Asking again won't fix "not allowed" or "not found".
            retry: (failures, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 2,
          },
        },
      }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <OnboardingProvider>
            <App />
          </OnboardingProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** Decides which part of the app a person sees: sign-in, the sign-up steps, or the app itself. */
function App() {
  const theme = useTheme();
  const session = useSession();
  const onboarding = useOnboarding();
  const signedIn = session.status === 'signedIn';
  const me = useGetMe({ query: { enabled: signedIn } });
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const waitingForProfile = signedIn && me.isPending;
  const ready = fontsLoaded && session.status !== 'loading' && !waitingForProfile;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = { ...base, colors: { ...base.colors, background: theme.colors.bg, card: theme.colors.bg, text: theme.colors.text } };

  if (signedIn && me.isError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', gap: 12, padding: 32, backgroundColor: theme.colors.bg }}>
        <Txt variant="title" center>
          We can&apos;t reach Journey
        </Txt>
        <Txt color="muted" center>
          Check your connection and try again. You&apos;re still signed in.
        </Txt>
        <Button label="Try again" block loading={me.isRefetching} onPress={() => void me.refetch()} style={{ marginTop: 12 }} />
        <Button label="Sign out" variant="quiet" block onPress={() => void session.signOut()} />
      </View>
    );
  }

  // A new person stays in the sign-up steps until the last one, even though their profile exists after the first.
  const stage = !signedIn ? 'auth' : !me.data?.profile || onboarding.active ? 'onboarding' : 'app';
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={stage === 'auth'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={stage === 'onboarding'}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={stage === 'app'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
