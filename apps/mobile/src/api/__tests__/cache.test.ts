import { QueryClient, QueryObserver } from '@tanstack/react-query';

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

  it('keeps an entry\'s place in a story narrowed to one person when the liked entry comes back with its place in the whole story', () => {
    const client = newClient();
    const inStory = (id: string, position: number, likeCount: number) => ({ ...entry(id, likeCount), position }) as unknown as EntryResponse;
    client.setQueryData(['/v1/entries/e7'], inStory('e7', 7, 2));
    client.setQueryData(['infinite', '/v1/journeys/j1/entries', { author: 'lea' }], { pages: [{ items: [inStory('e3', 1, 0), inStory('e7', 2, 2)], nextCursor: null }], pageParams: [undefined] });

    cacheFor(client).entryReacted(inStory('e7', 7, 3));

    const theirs = client.getQueryData<{ pages: { items: (EntryResponse & { position: number })[] }[] }>(['infinite', '/v1/journeys/j1/entries', { author: 'lea' }]);
    expect(theirs?.pages[0]?.items[1]).toMatchObject({ likeCount: 3, position: 2 }); // still "2 of 2" among Lea's
    expect(client.getQueryData(['/v1/entries/e7'])).toMatchObject({ likeCount: 3, position: 7 });
  });

  it('ends well after an entry was saved even when the journey cannot be asked for again', async () => {
    const client = newClient();
    client.setQueryDefaults(['/v1/journeys/j1'], { queryFn: () => Promise.reject(new Error('the connection went')) });
    await expect(cacheFor(client).entrySaved('j1', 'e1')).resolves.toBeDefined();
    await expect(cacheFor(client).journeyRead('j1')).resolves.toBeDefined();
  });

  it('fetches no journey again because a person was followed', async () => {
    const client = newClient();
    client.setQueryData(['/v1/journeys/j1'], journey('j1', 4));
    client.setQueryData(['infinite', '/v1/journeys/j1/entries'], { pages: [], pageParams: [] });
    client.setQueryData(['/v1/journeys/suggested', { limit: 6 }], { items: [] });
    client.setQueryData(['/v1/search', { q: 'maya' }], { people: [] });

    await cacheFor(client).personFollowed({ username: 'maya' } as Parameters<ReturnType<typeof cacheFor>['personFollowed']>[0]);

    expect(client.getQueryState(['/v1/journeys/j1'])?.isInvalidated).toBe(false);
    expect(client.getQueryState(['infinite', '/v1/journeys/j1/entries'])?.isInvalidated).toBe(false);
    expect(client.getQueryState(['/v1/journeys/suggested', { limit: 6 }])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['/v1/search', { q: 'maya' }])?.isInvalidated).toBe(true);
  });

  it('drops a deleted journey at once where nobody is looking, and under a screen only when the screen has closed', async () => {
    const client = newClient();
    client.setQueryData(['/v1/journeys/j1'], journey('j1', 4));
    client.setQueryData(['/v1/journeys/j1/summary'], { newCount: 0 });
    client.setQueryData(['/v1/journeys/j2'], journey('j2', 9));
    const asked = jest.fn(async () => journey('j1', 4));
    // The journey's page is still on screen while it closes.
    const page = new QueryObserver(client, { queryKey: ['/v1/journeys/j1'], queryFn: asked, staleTime: Infinity });
    const close = page.subscribe(() => {});

    await cacheFor(client).journeyDeleted('j1');

    expect(client.getQueryData(['/v1/journeys/j1/summary'])).toBeUndefined();
    expect(client.getQueryData(['/v1/journeys/j1'])).toBeDefined(); // not pulled away under the page
    expect(asked).not.toHaveBeenCalled(); // and not asked for again: the answer would be "not available"
    expect(client.getQueryData(['/v1/journeys/j2'])).toBeDefined();

    close();
    expect(client.getQueryData(['/v1/journeys/j1'])).toBeUndefined();
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

  it('never show the same row twice, when one moved down while the next page was on its way', () => {
    const page1 = { items: [{ id: 'a' }, { id: 'b' }] };
    const page2 = { items: [{ id: 'b' }, { id: 'c' }] }; // "b" arrives again
    expect(rows({ pages: [page1, page2], pageParams: [] })?.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    // Rows without an id of their own are all kept.
    expect(rows({ pages: [{ items: ['x', 'x'] }], pageParams: [] })).toEqual(['x', 'x']);
  });

  it('ask for the next page once, and only when there is one', () => {
    const fetchNextPage = jest.fn();
    more({ hasNextPage: true, isFetchingNextPage: false, fetchNextPage }).onEnd();
    more({ hasNextPage: true, isFetchingNextPage: true, fetchNextPage }).onEnd();
    more({ hasNextPage: false, isFetchingNextPage: false, fetchNextPage }).onEnd();
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
