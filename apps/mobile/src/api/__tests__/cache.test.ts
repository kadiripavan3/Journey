import { QueryClient } from '@tanstack/react-query';

import { cacheFor } from '../cache';
import type { EntryResponse, JourneyResponse } from '../generated/journey';
import { more, paged, rows } from '../pages';

/** A client that keeps what it is given and sets no timers, so the test run can end. */
const newClient = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });

const journey = (id: string, followerCount: number, isFollowing = false) =>
  ({ id, title: `Journey ${id}`, progressLabel: 'Day 3', followerCount, viewer: { isFollowing } }) as unknown as JourneyResponse;
const entry = (id: string, likeCount: number) => ({ id, journeyId: 'j1', happenedAt: '2026-11-01T10:00:00Z', likeCount }) as unknown as EntryResponse;

describe('what the app does with loaded data after a change', () => {
  it('writes a followed journey into every list that holds it, and fetches again only what changed its members', async () => {
    const client = newClient();
    client.setQueryData(['/v1/journeys/j1'], journey('j1', 4));
    client.setQueryData(['/v1/discover'], { trending: [journey('j1', 4), journey('j2', 9)], fresh: [], completed: [] });
    client.setQueryData(['infinite', '/v1/me/following'], { pages: [{ items: [journey('j2', 9)], nextCursor: null }], pageParams: [undefined] });
    client.setQueryData(['/v1/feed'], { groups: [], followingCount: 1, nextCursor: null });
    client.setQueryData(['/v1/activity'], { items: [], newCount: 0 });
    const discoverBefore = client.getQueryData<{ trending: JourneyResponse[] }>(['/v1/discover']);

    await cacheFor(client).journeyFollowed(journey('j1', 5, true));

    expect(client.getQueryData<JourneyResponse>(['/v1/journeys/j1'])?.followerCount).toBe(5);
    const discover = client.getQueryData<{ trending: JourneyResponse[] }>(['/v1/discover']);
    expect(discover?.trending[0]?.viewer.isFollowing).toBe(true);
    expect(discover?.trending[1]).toBe(discoverBefore?.trending[1]); // the other journey is the very same object
    // Home and "what I follow" are out of date; Discover and Activity are not touched.
    expect(client.getQueryState(['/v1/feed'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['infinite', '/v1/me/following'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['/v1/discover'])?.isInvalidated).toBe(false);
    expect(client.getQueryState(['/v1/activity'])?.isInvalidated).toBe(false);
  });

  it('puts a liked entry everywhere it is shown: in a story page, in Home and on its own', () => {
    const client = newClient();
    client.setQueryData(['/v1/entries/e1'], entry('e1', 2));
    client.setQueryData(['infinite', '/v1/journeys/j1/entries'], { pages: [{ items: [entry('e0', 1), entry('e1', 2)], nextCursor: null, prevCursor: null, total: 2 }], pageParams: [undefined] });
    client.setQueryData(['/v1/feed'], { groups: [{ journey: journey('j1', 4), newCount: 1, entries: [entry('e1', 2)] }], followingCount: 1, nextCursor: null });

    cacheFor(client).entryReacted(entry('e1', 3));

    expect(client.getQueryData<EntryResponse>(['/v1/entries/e1'])?.likeCount).toBe(3);
    const story = client.getQueryData<{ pages: { items: EntryResponse[] }[] }>(['infinite', '/v1/journeys/j1/entries']);
    expect(story?.pages[0]?.items.map((e) => e.likeCount)).toEqual([1, 3]);
    const feed = client.getQueryData<{ groups: { journey: JourneyResponse; entries: EntryResponse[] }[] }>(['/v1/feed']);
    expect(feed?.groups[0]?.entries[0]?.likeCount).toBe(3);
    expect(feed?.groups[0]?.journey.followerCount).toBe(4); // a journey with the same id as nothing: left alone
    expect(client.getQueryState(['/v1/feed'])?.isInvalidated).toBe(false); // nothing is fetched again for a like
  });

  it('leaves loaded data exactly as it is when the change is not in it', () => {
    const client = newClient();
    const discover = { trending: [journey('j2', 9)] };
    client.setQueryData(['/v1/discover'], discover);
    cacheFor(client).entryReacted(entry('e9', 1));
    expect(client.getQueryData(['/v1/discover'])).toBe(discover);
  });

  it('does not call a list fresh because a liked entry was written into it, or because it was looked through', () => {
    const client = newClient();
    const longAgo = Date.now() - 10 * 60 * 1000;
    // A story waiting to be fetched again, an old list that has nothing to do with the entry, and the entry's own page.
    client.setQueryData(['infinite', '/v1/journeys/j1/entries'], { pages: [{ items: [entry('e1', 2)], nextCursor: null }], pageParams: [undefined] }, { updatedAt: longAgo });
    client.setQueryData(['/v1/discover'], { trending: [journey('j1', 4)] }, { updatedAt: longAgo });
    client.setQueryData(['/v1/entries/e1'], entry('e1', 2), { updatedAt: longAgo });
    void client.invalidateQueries({ queryKey: ['infinite', '/v1/journeys/j1/entries'], refetchType: 'none' });

    cacheFor(client).entryReacted(entry('e1', 3));

    // The story shows the new count, and still has to be fetched again; it is as old as it was.
    expect(client.getQueryData<{ pages: { items: EntryResponse[] }[] }>(['infinite', '/v1/journeys/j1/entries'])?.pages[0]?.items[0]?.likeCount).toBe(3);
    expect(client.getQueryState(['infinite', '/v1/journeys/j1/entries'])).toMatchObject({ isInvalidated: true, dataUpdatedAt: longAgo });
    // Discover didn't hold the entry: its age is untouched, so it is fetched again when it is opened.
    expect(client.getQueryState(['/v1/discover'])?.dataUpdatedAt).toBe(longAgo);
    // The entry's own page is what the API just sent: that one is fresh.
    expect(client.getQueryState(['/v1/entries/e1'])?.dataUpdatedAt).toBeGreaterThan(longAgo);
  });

  it('fetches everything again after a block, because a block changes what can be seen everywhere', async () => {
    const client = newClient();
    client.setQueryData(['/v1/discover'], { trending: [] });
    client.setQueryData(['/v1/activity'], { items: [] });
    await cacheFor(client).blockChanged();
    expect(client.getQueryState(['/v1/discover'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['/v1/activity'])?.isInvalidated).toBe(true);
  });
});

describe('paged lists', () => {
  it('go on with the cursor the last page handed out, and stop when there is none', () => {
    expect(paged.getNextPageParam({ nextCursor: 'abc' })).toBe('abc');
    expect(paged.getNextPageParam({ nextCursor: null })).toBeUndefined();
  });

  it('show every row loaded so far, in order', () => {
    expect(rows(undefined)).toBeUndefined();
    expect(rows({ pages: [{ items: [1, 2] }, { items: [3] }], pageParams: [] })).toEqual([1, 2, 3]);
  });

  it('ask for the next page once, and only when there is one', () => {
    const fetchNextPage = jest.fn();
    more({ hasNextPage: true, isFetchingNextPage: false, fetchNextPage }).onEnd();
    more({ hasNextPage: true, isFetchingNextPage: true, fetchNextPage }).onEnd();
    more({ hasNextPage: false, isFetchingNextPage: false, fetchNextPage }).onEnd();
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
