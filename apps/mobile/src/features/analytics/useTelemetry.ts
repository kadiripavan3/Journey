import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { beforeSignOut } from '@/auth/beforeSignOut';

import { analyticsOn, countChanges, forgetPerson, identify, startAnalytics } from './analytics';
import { crashesBelongTo, crashReportsOn, startCrashReports } from './crashes';

/**
 * Switches on counting and crash reports for the whole app, once, from the root layout. Where a build has no
 * keys (a developer's computer, Expo Go, the browser, tests) this does nothing at all.
 *
 * `accountId` is the signed-in person's id, or undefined while nobody is signed in.
 */
export function useTelemetry(accountId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    startCrashReports();
    startAnalytics();
    return countChanges(queryClient.getMutationCache());
  }, [queryClient]);

  useEffect(() => {
    if (!accountId || !(analyticsOn() || crashReportsOn())) return;
    identify(accountId);
    crashesBelongTo(accountId);
    return beforeSignOut(() => {
      forgetPerson();
      crashesBelongTo(null);
    });
  }, [accountId]);
}
