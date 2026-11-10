import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useOnboarding } from '@/auth/onboarding';
import { OutboxProvider } from '@/features/drafts/outbox';
import { NewJourneyProvider } from '@/features/journeys/draft';
import { OfflineStrip } from '@/features/navigation/OfflineStrip';
import { AskAboutNotifications } from '@/features/notifications/AskAboutNotifications';
import { usePushNotifications } from '@/features/notifications/usePushNotifications';
import { RecentSearchesProvider } from '@/features/search/recent';
import { takeLink } from '@/lib/links';

// A screen that breaks while drawing shows a friendly page with a way to try again.
export { ErrorBoundary } from '@/features/navigation/ErrorBoundary';

// The tabs are always underneath. When a link or a notification opens the app straight onto a journey or an
// entry, Back and Close still have somewhere to go: Home.
export const unstable_settings = { anchor: '(tabs)' };

/** Everything a signed-in person sees: the four tabs, and the screens that open on top of them. */
export default function AppLayout() {
  const router = useRouter();
  const onboarding = useOnboarding();

  // Sign-up can end with "start a trip": open that once the app itself is on screen.
  useEffect(() => {
    const next = onboarding.takeNext();
    if (next) router.push(next);
  }, [onboarding, router]);

  // A tapped notification opens its screen; a phone that said yes stays connected.
  usePushNotifications();

  // A shared link (an invitation, mostly) that opened the app before the person had signed in is opened now.
  // When the router has shown it already, it is only forgotten.
  const pathname = usePathname();
  useEffect(() => {
    const link = takeLink();
    if (link && link !== pathname) router.navigate(link);
  }, [pathname, router]);

  return (
    <RecentSearchesProvider>
      <NewJourneyProvider>
        {/* Entries on their way up, and drafts: above every screen, so they keep going whichever one is open. */}
        <OutboxProvider>
          {/* Without a connection a strip across the top says so, and the screens make room for it. */}
          <OfflineStrip>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              {/*
                The entry viewer draws its own full-screen stage. It is an ordinary screen that fades in, not
                a modal: a profile or a review page opened from it is then an ordinary screen on top of it.
                It closes with its Close button only, so swiping sideways always means "the next entry".
              */}
              <Stack.Screen name="entry/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
              {/*
                The composer can't be swiped away: what was written is only left through its own Close, which
                asks what to do with it. (Android's back button is the composer's own business.)
              */}
              <Stack.Screen name="journey/[id]/add" options={{ presentation: 'modal', gestureEnabled: false }} />
              <Stack.Screen name="journey/[id]/live" options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
            </Stack>
          </OfflineStrip>
          {/* Someone who never saw the question about notifications is asked once, after following or posting. */}
          <AskAboutNotifications />
        </OutboxProvider>
      </NewJourneyProvider>
    </RecentSearchesProvider>
  );
}
