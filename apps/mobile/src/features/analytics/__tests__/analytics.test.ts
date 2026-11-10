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
const profileSent = JSON.stringify({ displayName: 'Maya Okafor', username: 'maya', bio: 'Private words', ageConfirmed: true });

/** Every call that is counted, as the app makes it. */
const COUNTED: [method: string, path: string][] = [
  ['PUT', '/v1/me/profile'],
  ['POST', '/v1/journeys'],
  ['POST', '/v1/journeys/j1/entries'],
  ['POST', '/v1/journeys/j1/complete'],
  ['PUT', '/v1/journeys/j1/follow'],
  ['PUT', '/v1/profiles/maya/follow'],
  ['POST', '/v1/journeys/j1/members'],
  ['POST', '/v1/journeys/j1/invite-link'],
  ['POST', '/v1/journeys/j1/invitation/accept'],
  ['POST', '/v1/invites/abcd-efgh-jkmn-pqrs/accept'],
  ['POST', '/v1/entries/e1/comments'],
];

describe('what is counted', () => {
  it('names the few changes the beta measures, by the API call that makes them', () => {
    expect(eventFor('POST', '/v1/journeys', journey)).toEqual(['journey_created', { template: 'trip', category: 'travel', visibility: 'private' }]);
    expect(eventFor('POST', '/v1/journeys/j1/entries', entry)).toEqual(['entry_posted', { photos: 2, clips: 1, has_place: true, milestone: true }]);
    expect(eventFor('POST', '/v1/journeys/j1/complete', journey)).toEqual(['journey_completed', { template: 'trip', entries: 14 }]);
    expect(eventFor('PUT', '/v1/journeys/j1/follow', journey)).toEqual(['journey_followed', { category: 'travel' }]);
    expect(eventFor('PUT', '/v1/profiles/maya/follow', { username: 'maya' })).toEqual(['person_followed', {}]);
    expect(eventFor('POST', '/v1/entries/e1/comments', { body: 'Private words', parentId: 'c1' })).toEqual(['comment_added', { reply: true }]);
  });

  it('counts an invitation whichever way it goes out and comes back: to a person, or as a link', () => {
    expect(eventFor('POST', '/v1/journeys/j1/members', undefined)).toEqual(['invitation_sent', { by: 'name' }]);
    expect(eventFor('POST', '/v1/journeys/j1/invite-link', { url: 'https://journey.app/i/abcd-efgh' })).toEqual(['invitation_sent', { by: 'link' }]);
    expect(eventFor('POST', '/v1/journeys/j1/invitation/accept', journey)).toEqual(['invitation_accepted', { by: 'name' }]);
    expect(eventFor('POST', '/v1/invites/abcd-efgh-jkmn-pqrs/accept', journey)).toEqual(['invitation_accepted', { by: 'link' }]);
  });

  it('counts a sign-up when the profile is made, not each time it is changed', () => {
    expect(eventFor('PUT', '/v1/me/profile', { id: 'p1', username: 'maya' }, profileSent)).toEqual(['signed_up', {}]);
    expect(eventFor('PUT', '/v1/me/profile', { id: 'p1', username: 'maya' }, JSON.stringify({ displayName: 'Maya O.', username: 'maya', bio: '' }))).toBeNull();
    expect(eventFor('PUT', '/v1/me/profile', { id: 'p1' }, undefined)).toBeNull();
  });

  it('counts nothing else', () => {
    const others: [string, string][] = [
      ['PUT', '/v1/entries/e1/like'],
      ['PUT', '/v1/me/settings'],
      ['PUT', '/v1/profiles/maya/block'],
      ['POST', '/v1/reports'],
      ['DELETE', '/v1/me'],
      ['PUT', '/v1/me/devices'],
      ['POST', '/local-auth/token'],
      // The same addresses, read or undone, are not the change.
      ['GET', '/v1/journeys'],
      ['GET', '/v1/journeys/j1/entries'],
      ['DELETE', '/v1/journeys/j1/follow'],
      ['DELETE', '/v1/profiles/maya/follow'],
      ['GET', '/v1/entries/e1/comments'],
      ['POST', '/v1/journeys/j1/entries/extra'],
    ];
    for (const [method, path] of others) expect(eventFor(method, path, journey, profileSent)).toBeNull();
  });

  it('never carries a name, a title, an address or anything a person wrote', () => {
    const everything = COUNTED.flatMap(([method, path]) => [eventFor(method, path, journey, profileSent), eventFor(method, path, entry, profileSent), eventFor(method, path, { ...journey, ...entry }, profileSent)]).map((counted) =>
      JSON.stringify(counted),
    );
    expect(everything.filter((sent) => sent !== 'null')).toHaveLength(COUNTED.length * 3);
    for (const sent of everything) {
      for (const secret of ['Okafor', 'maya', 'secret', 'Nobody', 'Roads', 'Private', 'Ha Giang', 'example.com', 'j1', 'e1', 'abcd', '/v1/']) {
        expect(sent).not.toContain(secret);
      }
    }
  });

  it('copes with an answer that is not what it expects', () => {
    expect(eventFor('POST', '/v1/journeys', null)).toEqual(['journey_created', { template: 'unknown', category: 'unknown', visibility: 'unknown' }]);
    expect(eventFor('POST', '/v1/journeys/j1/entries?x=1', 'nonsense')).toEqual(['entry_posted', { photos: 0, clips: 0, has_place: false, milestone: false }]);
    expect(eventFor('PUT', '/v1/me/profile', {}, '{not json')).toBeNull();
  });
});

describe('switched on only by a key', () => {
  const env = process.env;

  function build(keys: { posthog?: string; sentry?: string }, os: 'ios' | 'web' = 'ios') {
    jest.resetModules();
    process.env = { ...env, EXPO_PUBLIC_API_URL: 'http://api.test' };
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
    // The same copy of the app's way to the API that `analytics` listens to.
    const api = jest.requireActual<typeof import('@/api/generated/journey')>('@/api/generated/journey');
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    return { analytics, crashes, api, client, PostHog, posthogLoaded, sentry, sentryLoaded, settle };
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
    analytics.countChanges()();
    crashes.startCrashReports();
    crashes.reportCrash(new Error('boom'));
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
    expect(client.capture).toHaveBeenCalledWith('entry_posted', { photos: 2 });
    expect(client.identify).toHaveBeenCalledWith('account-1');
    expect(client.reset).toHaveBeenCalledTimes(1);
  });

  it('sends nothing the library would add by itself: not the link that opened the app, no place, no flags, no replay', async () => {
    const { analytics, PostHog, settle } = await build({ posthog: 'phc_test' });
    analytics.startAnalytics();
    await settle();
    expect(PostHog).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        // Its own "Application Opened" carries the opening link (journey://profile/<name>, an invitation).
        captureAppLifecycleEvents: false,
        personProfiles: 'identified_only',
        disableGeoip: true,
        enableSessionReplay: false,
        preloadFeatureFlags: false,
        disableSurveys: true,
        capturePushNotificationSubscriptions: false,
        capturePushNotificationOpened: false,
      }),
    );
  });

  it('with a key, counts a change the moment the API accepts it, whoever made the call, and not one that failed', async () => {
    const { analytics, api, client, settle } = await build({ posthog: 'phc_test' });
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const answers = (status: number, body: unknown) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
    const stop = analytics.countChanges();

    // Called straight from the generated client, as the screen that starts a journey and the outbox do:
    // no hook, nothing to remember.
    answers(201, journey);
    await api.createJourney({ title: 'My secret trip', template: 'trip' } as Parameters<typeof api.createJourney>[0]);
    answers(201, entry);
    await api.addEntry('j1', { clientId: 'c1' } as Parameters<typeof api.addEntry>[1]);
    answers(200, { url: 'https://journey.app/i/abcd-efgh', expiresAt: '2026-11-17T00:00:00Z' });
    await api.createInviteLink('j1');
    answers(400, { code: 'invalid_input', detail: 'Give it a title.' });
    await api.createJourney({ title: '' } as Parameters<typeof api.createJourney>[0]).catch(() => undefined);
    answers(200, entry);
    await api.likeEntry('e1');
    await settle();

    expect(client.capture.mock.calls).toEqual([
      ['journey_created', { template: 'trip', category: 'travel', visibility: 'private' }],
      ['entry_posted', { photos: 2, clips: 1, has_place: true, milestone: true }],
      ['invitation_sent', { by: 'link' }],
    ]);

    stop();
    answers(201, journey);
    await api.createJourney({ title: 'Another' } as Parameters<typeof api.createJourney>[0]);
    await settle();
    expect(client.capture).toHaveBeenCalledTimes(3);
  });

  it('with a key, reports crashes that are not tied to anyone: no person, no log lines, no trail of screens, no timing', async () => {
    const { crashes, sentry, settle } = await build({ sentry: 'https://key@example.ingest.sentry.io/1' });
    const boom = new Error('boom');
    crashes.reportCrash(boom);
    await settle();
    expect(sentry.captureException).toHaveBeenCalledWith(boom);
    // The store answers say crash reports are not linked to the person.
    expect(sentry.setUser).not.toHaveBeenCalled();
    expect(Object.keys(crashes)).not.toContain('crashesBelongTo');

    const options = sentry.init.mock.calls[0][0];
    expect(options).toEqual(expect.objectContaining({ dsn: 'https://key@example.ingest.sentry.io/1', sendDefaultPii: false }));
    // Giving a rate for timing, even 0, makes the library install the parts that time screens and follow the router.
    expect(options).not.toHaveProperty('tracesSampleRate');
    expect(options).not.toHaveProperty('tracesSampler');
    expect(options).not.toHaveProperty('profilesSampleRate');
    expect(options).not.toHaveProperty('replaysSessionSampleRate');
    expect(options.beforeSend({ message: 'boom', user: { id: 'account-1', ip_address: '{{auto}}' } })).toEqual({ message: 'boom' });
    expect(options.beforeBreadcrumb({ category: 'console', message: 'Maya typed something' })).toBeNull();
    expect(options.beforeBreadcrumb({ category: 'navigation', data: { to: '/profile/maya' } })).toBeNull();
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
