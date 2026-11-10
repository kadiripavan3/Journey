import { QueryClient } from '@tanstack/react-query';

import { forgetKept, KEEP_FOR_MS, keepWriting, restoreKept, snapshot } from '../kept';

const mockKept = new Map<string, string>();
jest.mock('@/lib/keep', () => ({
  keep: {
    get: (key: string) => Promise.resolve(mockKept.get(key) ?? null),
    set: (key: string, value: string) => Promise.resolve(void mockKept.set(key, value)),
    remove: (key: string) => Promise.resolve(void mockKept.delete(key)),
  },
}));

/** A client that sets no timers of its own, so the test run can end. */
const newClient = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
const KEY = 'journey.kept.v1';
const addresses = (text: string) => (JSON.parse(text) as { queries: { key: unknown[] }[] }).queries.map((query) => query.key.find((part) => typeof part === 'string' && part.startsWith('/')));

describe('what was read stays on the phone', () => {
  beforeEach(() => mockKept.clear());

  it('comes back at the next start, for the same person, with the time it was read', async () => {
    const before = newClient();
    const readAt = Date.now() - 60_000;
    before.setQueryData(['/v1/me'], { id: 'maya', profile: { displayName: 'Maya' } }, { updatedAt: readAt });
    before.setQueryData(['infinite', '/v1/me/journeys', { limit: 100 }], { pages: [{ items: [{ id: 'j1' }], nextCursor: null }], pageParams: [undefined] }, { updatedAt: readAt });
    mockKept.set(KEY, snapshot(before, 'maya'));

    const after = newClient();
    await restoreKept(after, 'maya');

    expect(after.getQueryData(['/v1/me'])).toEqual({ id: 'maya', profile: { displayName: 'Maya' } });
    expect(after.getQueryData(['infinite', '/v1/me/journeys', { limit: 100 }])).toMatchObject({ pages: [{ items: [{ id: 'j1' }] }] });
    // It is as old as it was, and marked to be asked for again: shown at once, fresh as soon as it can be.
    expect(after.getQueryState(['/v1/me'])).toMatchObject({ dataUpdatedAt: readAt, isInvalidated: true });
  });

  it('is never put back for another person, or for nobody: it is removed instead', async () => {
    const before = newClient();
    before.setQueryData(['/v1/me'], { id: 'maya' });
    mockKept.set(KEY, snapshot(before, 'maya'));

    const other = newClient();
    await restoreKept(other, 'lea');
    expect(other.getQueryData(['/v1/me'])).toBeUndefined();
    expect(mockKept.has(KEY)).toBe(false);

    mockKept.set(KEY, snapshot(before, 'maya'));
    await restoreKept(newClient(), null);
    expect(mockKept.has(KEY)).toBe(false);
  });

  it('leaves out searches, one-time invitations and anything too old; a copy that cannot be read counts as none', async () => {
    const client = newClient();
    const now = Date.now();
    client.setQueryData(['/v1/feed'], { groups: [] });
    client.setQueryData(['/v1/search', { q: 'someone I looked for' }], { journeys: [] });
    client.setQueryData(['/v1/usernames/maya'], { available: false });
    client.setQueryData(['/v1/invites/abcd-efgh'], { journey: {} });
    client.setQueryData(['/v1/journeys/j1/invitable', { q: 'le' }], { items: [] });
    client.setQueryData(['/v1/journeys/j1'], { id: 'j1' }, { updatedAt: now - KEEP_FOR_MS - 1000 });

    expect(addresses(snapshot(client, 'maya', now))).toEqual(['/v1/feed']);

    mockKept.set(KEY, '{"owner":"maya","queries":[{"key":');
    const after = newClient();
    await restoreKept(after, 'maya');
    expect(after.getQueryCache().getAll()).toHaveLength(0);
    expect(mockKept.has(KEY)).toBe(false);
  });

  it('keeps what the app cannot open without, whatever else was read since', () => {
    const client = newClient();
    const now = Date.now();
    client.setQueryData(['/v1/me'], { id: 'maya' }, { updatedAt: now - 5 * 60 * 60 * 1000 });
    client.setQueryData(['/v1/catalog'], { templates: [] }, { updatedAt: now - 5 * 60 * 60 * 1000 });
    for (let i = 0; i < 80; i += 1) client.setQueryData([`/v1/journeys/j${i}`], { id: `j${i}` }, { updatedAt: now - i * 1000 });

    const kept = addresses(snapshot(client, 'maya', now));

    expect(kept).toHaveLength(60);
    expect(kept.slice(0, 2).sort()).toEqual(['/v1/catalog', '/v1/me']);
    expect(kept).toContain('/v1/journeys/j0');
    expect(kept).not.toContain('/v1/journeys/j79');
  });

  it('is written a little after a change, only while someone is signed in, and removed on sign-out', async () => {
    jest.useFakeTimers();
    try {
      const client = newClient();
      let owner: string | null = 'maya';
      const stop = keepWriting(client, () => owner);

      client.setQueryData(['/v1/me'], { id: 'maya' });
      expect(mockKept.has(KEY)).toBe(false);
      await jest.advanceTimersByTimeAsync(3000);
      expect(JSON.parse(mockKept.get(KEY) ?? '{}')).toMatchObject({ owner: 'maya', queries: [{ key: ['/v1/me'], data: { id: 'maya' } }] });

      // Signing out: the copy goes, and what is cleared from memory right after doesn't write it back.
      owner = null;
      client.setQueryData(['/v1/feed'], { groups: [] });
      await forgetKept();
      client.clear();
      await jest.advanceTimersByTimeAsync(3000);
      expect(mockKept.has(KEY)).toBe(false);
      stop();
    } finally {
      jest.useRealTimers();
    }
  });
});
