import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useOnboarding } from '@/auth/onboarding';
import { NewJourneyProvider } from '@/features/journeys/draft';
import { OfflineBanner } from '@/features/navigation/OfflineBanner';
import { RecentSearchesProvider } from '@/features/search/recent';

// A screen that breaks while drawing shows a friendly page with a way to try again.
export { ErrorBoundary } from '@/features/navigation/ErrorBoundary';

/** Everything a signed-in person sees: the four tabs, and the screens that open on top of them. */
export default function AppLayout() {
  const router = useRouter();
  const onboarding = useOnboarding();

  // Sign-up can end with "start a trip": open that once the app itself is on screen.
  useEffect(() => {
    const next = onboarding.takeNext();
    if (next) router.push(next);
  }, [onboarding, router]);

  return (
    <RecentSearchesProvider>
      <NewJourneyProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="entry/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="journey/[id]/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="journey/[id]/live" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
        </Stack>
        <OfflineBanner />
      </NewJourneyProvider>
    </RecentSearchesProvider>
  );
}
