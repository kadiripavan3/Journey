import { eventFor } from '../events';

/** What the API sends back after a change: full of names and words that must never be counted. */
const journey = {
  id: 'j1',
  title: 'My secret trip to see Dr. Okafor',
  description: 'Nobody should read this',
  template: 'trip',
  category: 'travel',
  visibility: 'private',
  entryCount: 14,
  owner: { username: 'maya', displayName: 'Maya Okafor' },
};
const entry = {
  id: 'e1',
  title: 'Roads that look like rivers',
  body: 'Private words',
  placeName: 'Ha Giang',
  isMilestone: true,
  media: [{ kind: 'photo', url: 'https://example.com/a.jpg' }, { kind: 'photo' }, { kind: 'video' }],
  author: { username: 'maya', displayName: 'Maya Okafor' },
};

describe('what is counted', () => {
  it('names the few changes the beta measures, by the API call that makes them', () => {
    expect(eventFor('createJourney', journey)).toEqual(['journey_created', { template: 'trip', category: 'travel', visibility: 'private' }]);
    expect(eventFor('addEntry', entry)).toEqual(['entry_posted', { photos: 2, clips: 1, has_place: true, milestone: true }]);
    expect(eventFor('completeJourney', journey)).toEqual(['journey_completed', { template: 'trip', entries: 14 }]);
    expect(eventFor('followJourney', journey)).toEqual(['journey_followed', { category: 'travel' }]);
    expect(eventFor('followProfile', { username: 'maya' })).toEqual(['person_followed', {}]);
    expect(eventFor('inviteMember', undefined)).toEqual(['invitation_sent', {}]);
    expect(eventFor('acceptInvitation', journey)).toEqual(['invitation_accepted', {}]);
    expect(eventFor('addComment', { body: 'Private words', parentId: 'c1' })).toEqual(['comment_added', { reply: true }]);
  });

  it('counts nothing else', () => {
    for (const call of ['likeEntry', 'saveProfile', 'saveSettings', 'blockProfile', 'report', 'deleteAccount', 'registerDevice', 'createLocalToken']) {
      expect(eventFor(call, journey)).toBeNull();
    }
  });

  it('never carries a name, a title or anything a person wrote', () => {
    const everything = ['createJourney', 'addEntry', 'completeJourney', 'followJourney', 'followProfile', 'inviteMember', 'acceptInvitation', 'addComment']
      .flatMap((call) => [eventFor(call, journey), eventFor(call, entry), eventFor(call, { ...journey, ...entry })])
      .map((counted) => JSON.stringify(counted));
    for (const sent of everything) {
      for (const secret of ['Okafor', 'maya', 'secret', 'Nobody', 'Roads', 'Private', 'Ha Giang', 'example.com', 'j1', 'e1']) {
        expect(sent).not.toContain(secret);
      }
    }
  });

  it('copes with an answer that is not what it expects', () => {
    expect(eventFor('createJourney', null)).toEqual(['journey_created', { template: 'unknown', category: 'unknown', visibility: 'unknown' }]);
    expect(eventFor('addEntry', 'nonsense')).toEqual(['entry_posted', { photos: 0, clips: 0, has_place: false, milestone: false }]);
  });
});

describe('switched on only by a key', () => {
  const env = process.env;

  function build(keys: { posthog?: string; sentry?: string }, os: 'ios' | 'web' = 'ios') {
    jest.resetModules();
    process.env = { ...env };
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    if (keys.posthog) process.env.EXPO_PUBLIC_POSTHOG_KEY = keys.posthog;
    if (keys.sentry) process.env.EXPO_PUBLIC_SENTRY_DSN = keys.sentry;

    const client = { capture: jest.fn(), identify: jest.fn(), reset: jest.fn() };
    const PostHog = jest.fn(() => client);
    const posthogLoaded = jest.fn(() => ({ __esModule: true, default: PostHog }));
    jest.doMock('posthog-react-native', posthogLoaded);
    const sentry = { init: jest.fn(), captureException: jest.fn(), setUser: jest.fn() };
    const sentryLoaded = jest.fn(() => sentry);
    jest.doMock('@sentry/react-native', sentryLoaded);

    const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
    const analytics = jest.requireActual<typeof import('../analytics')>('../analytics');
    const crashes = jest.requireActual<typeof import('../crashes')>('../crashes');
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    return { analytics, crashes, client, PostHog, posthogLoaded, sentry, sentryLoaded, settle };
  }

  afterAll(() => {
    process.env = env;
  });

  it('does nothing and loads nothing without keys: a developer’s computer, Expo Go, tests', async () => {
    const { analytics, crashes, posthogLoaded, sentryLoaded, settle } = await build({});
    analytics.startAnalytics();
    analytics.track('entry_posted', { photos: 1 });
    analytics.identify('account-1');
    analytics.forgetPerson();
    crashes.startCrashReports();
    crashes.reportCrash(new Error('boom'));
    crashes.crashesBelongTo('account-1');
    await settle();
    expect(analytics.analyticsOn()).toBe(false);
    expect(crashes.crashReportsOn()).toBe(false);
    expect(posthogLoaded).not.toHaveBeenCalled();
    expect(sentryLoaded).not.toHaveBeenCalled();
  });

  it('never counts in the browser, key or not', async () => {
    const { analytics, crashes, posthogLoaded, sentryLoaded, settle } = await build({ posthog: 'phc_test', sentry: 'https://key@example.ingest.sentry.io/1' }, 'web');
    analytics.track('entry_posted');
    crashes.reportCrash(new Error('boom'));
    await settle();
    expect(posthogLoaded).not.toHaveBeenCalled();
    expect(sentryLoaded).not.toHaveBeenCalled();
  });

  it('with a key, counts events against the account’s id and forgets it on sign-out', async () => {
    const { analytics, client, PostHog, settle } = await build({ posthog: 'phc_test' });
    analytics.track('entry_posted', { photos: 2 });
    analytics.identify('account-1');
    analytics.forgetPerson();
    await settle();
    expect(PostHog).toHaveBeenCalledTimes(1);
    expect(PostHog).toHaveBeenCalledWith('phc_test', expect.objectContaining({ personProfiles: 'identified_only', enableSessionReplay: false }));
    expect(client.capture).toHaveBeenCalledWith('entry_posted', { photos: 2 });
    expect(client.identify).toHaveBeenCalledWith('account-1');
    expect(client.reset).toHaveBeenCalledTimes(1);
  });

  it('with a key, counts a change the moment the API accepts it, and not one that failed', async () => {
    const { analytics, client, settle } = await build({ posthog: 'phc_test' });
    const { QueryClient } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
    const queries = new QueryClient();
    const stop = analytics.countChanges(queries.getMutationCache());
    const change = (call: string, mutationFn: () => Promise<unknown>) =>
      queries
        .getMutationCache()
        .build(queries, { mutationKey: [call], mutationFn, retry: false, gcTime: Infinity }) // no clean-up timer left running after the test
        .execute(undefined)
        .catch(() => undefined);

    await change('createJourney', async () => journey);
    await change('addEntry', async () => {
      throw new Error('offline');
    });
    await change('likeEntry', async () => entry);
    await settle();
    expect(client.capture.mock.calls).toEqual([['journey_created', { template: 'trip', category: 'travel', visibility: 'private' }]]);

    stop();
    await change('createJourney', async () => journey);
    await settle();
    expect(client.capture).toHaveBeenCalledTimes(1);
    queries.clear();
  });

  it('with a key, reports crashes without log lines and without the addresses people looked at', async () => {
    const { crashes, sentry, settle } = await build({ sentry: 'https://key@example.ingest.sentry.io/1' });
    const boom = new Error('boom');
    crashes.reportCrash(boom);
    crashes.crashesBelongTo('account-1');
    await settle();
    expect(sentry.captureException).toHaveBeenCalledWith(boom);
    expect(sentry.setUser).toHaveBeenCalledWith({ id: 'account-1' });

    const options = sentry.init.mock.calls[0][0];
    expect(options).toEqual(expect.objectContaining({ dsn: 'https://key@example.ingest.sentry.io/1', sendDefaultPii: false, tracesSampleRate: 0 }));
    expect(options.beforeBreadcrumb({ category: 'console', message: 'Maya typed something' })).toBeNull();
    expect(options.beforeBreadcrumb({ category: 'fetch', data: { method: 'GET', status_code: 500, url: 'http://localhost:8080/v1/search?q=my+secret' } }).data).toEqual({
      method: 'GET',
      status_code: 500,
      url: '/v1/search',
    });
    expect(crashes.withoutDetails('https://api.example.com/v1/profiles/maya/followers?cursor=abc')).toBe('/v1/profiles/…');
    expect(crashes.withoutDetails('/v1/feed')).toBe('/v1/feed');
    expect(crashes.withoutDetails(undefined)).toBe('');
  });

  it('keeps the app going when the library itself fails to load', async () => {
    const { analytics, posthogLoaded, settle } = await build({ posthog: 'phc_test' });
    posthogLoaded.mockImplementationOnce(() => {
      throw new Error('native module missing');
    });
    expect(() => analytics.track('entry_posted')).not.toThrow();
    await settle();
  });
});
