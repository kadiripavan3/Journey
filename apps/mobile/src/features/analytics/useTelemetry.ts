import { useEffect } from 'react';
import { AppState } from 'react-native';

import { beforeSignOut } from '@/auth/beforeSignOut';

import { analyticsOn, countChanges, forgetPerson, identify, startAnalytics, track } from './analytics';
import { startCrashReports } from './crashes';

/**
 * Switches on counting and crash reports for the whole app, once, from the root layout. Where a build has no
 * keys (a developer's computer, Expo Go, the browser, tests) this does nothing at all.
 *
 * `accountId` is the signed-in person's id, or undefined while nobody is signed in. Counting is tied to it;
 * crash reports are not tied to anyone.
 */
export function useTelemetry(accountId: string | undefined) {
  useEffect(() => {
    startCrashReports();
    startAnalytics();
    const stopCounting = countChanges();
    // "Opened the app" is what coming back after 7 and 30 days is measured with: at the start, and each
    // time the app comes back from being put away. It says nothing about how it was opened.
    track('app_opened');
    let away = false;
    const watching = AppState.addEventListener('change', (state) => {
      if (state === 'background') away = true;
      if (state === 'active' && away) {
        away = false;
        track('app_opened');
      }
    });
    return () => {
      stopCounting();
      watching.remove();
    };
  }, []);

  useEffect(() => {
    if (!accountId || !analyticsOn()) return;
    identify(accountId);
    // Whoever uses this phone next is someone new. This runs however the sign-in ends.
    return beforeSignOut(forgetPerson);
  }, [accountId]);
}
