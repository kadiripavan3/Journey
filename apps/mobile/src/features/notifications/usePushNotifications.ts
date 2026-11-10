import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { track } from '@/features/analytics/analytics';

import { connectThisPhone, loadNotifications } from './device';
import { pushSupport } from './support';
import { hrefFor } from './target';

/** The notification opened last, so the one that started the app isn't opened a second time by the listener. */
let lastOpened: string | null = null;

/**
 * For the signed-in app: keeps this phone connected for notifications (if the person said yes), and opens
 * the right screen when one is tapped, also when that tap is what started the app. In a browser and in
 * Expo Go it does nothing.
 */
export function usePushNotifications() {
  const router = useRouter();

  useEffect(() => {
    if (pushSupport() !== 'ready') return;
    let mounted = true;
    let stop: (() => void) | undefined;

    void (async () => {
      try {
        const Notifications = await loadNotifications();
        if (!mounted) return;
        void connectThisPhone();

        const open = (response: { notification: { request: { identifier: string; content: { data?: Record<string, unknown> | null } } } }) => {
          const { identifier, content } = response.notification.request;
          if (identifier === lastOpened) return;
          lastOpened = identifier;
          const kind = content.data?.kind;
          track('notification_opened', { kind: typeof kind === 'string' ? kind : 'unknown' });
          router.push(hrefFor(content.data?.url));
        };

        const first = Notifications.getLastNotificationResponse();
        if (first) {
          open(first);
          Notifications.clearLastNotificationResponse();
        }
        const listener = Notifications.addNotificationResponseReceivedListener(open);
        stop = () => listener.remove();
        if (!mounted) stop();
      } catch {
        // Without notifications the app is the same app; Activity shows everything.
      }
    })();

    return () => {
      mounted = false;
      stop?.();
    };
  }, [router]);
}
