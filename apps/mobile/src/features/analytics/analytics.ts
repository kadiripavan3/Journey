import type { MutationCache } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { eventFor, type EventName, type EventProps } from './events';

/**
 * Counting what people do, with PostHog. It is switched on by a key (EXPO_PUBLIC_POSTHOG_KEY) that only real
 * builds have. Without the key nothing is loaded and every function here does nothing, which is how the app
 * runs on a developer's computer, in Expo Go and in tests. The browser version is for trying things out, so
 * it never counts either.
 */
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

type Counter = {
  capture: (event: string, properties?: EventProps) => unknown;
  identify: (id: string) => unknown;
  reset: () => unknown;
};

let counter: Promise<Counter | null> | null = null;

export function analyticsOn(): boolean {
  return Boolean(KEY) && Platform.OS !== 'web';
}

function load(): Promise<Counter | null> {
  if (!KEY || !analyticsOn()) return Promise.resolve(null);
  counter ??= Promise.resolve()
    .then((): Counter => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- on purpose: loaded here and nowhere else, only with a key
      const { default: PostHog } = require('posthog-react-native') as typeof import('posthog-react-native');
      return new PostHog(KEY, {
        host: HOST,
        // "Opened the app" is what coming back after 7 and 30 days is measured with.
        captureAppLifecycleEvents: true,
        // A person is a made-up id until they sign in, then their account's id. Nothing else is known about them.
        personProfiles: 'identified_only',
        enableSessionReplay: false,
      });
    })
    .catch(() => null); // counting must never get in the way of the app
  return counter;
}

/** Starts counting, if this build counts at all. */
export function startAnalytics(): void {
  void load();
}

/** One thing that happened. See `events.ts` for the whole list and what may go with each. */
export function track(event: EventName, properties: EventProps = {}): void {
  void load().then((client) => client?.capture(event, properties));
}

/**
 * Counts the changes the API accepts. Every one of them passes through the app's list of changes in flight;
 * the ones worth counting are named in `events.ts`, by the API call that makes them. Returns a function that stops it.
 */
export function countChanges(changes: MutationCache): () => void {
  if (!analyticsOn()) return () => {};
  return changes.subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    const call = event.mutation.options.mutationKey?.[0];
    const counted = typeof call === 'string' ? eventFor(call, event.mutation.state.data) : null;
    if (counted) track(...counted);
  });
}

/** Ties what happens on this phone to an account, by its id only. */
export function identify(accountId: string): void {
  void load().then((client) => client?.identify(accountId));
}

/** The person signed out: whoever uses the phone next is someone new. */
export function forgetPerson(): void {
  void load().then((client) => client?.reset());
}
