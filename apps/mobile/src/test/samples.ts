import type { CommentResponse, EntryResponse, JourneyResponse, MediaResponse, PersonResponse } from '@/api/generated/journey';

/** Made-up people, journeys and entries for tests: whole objects, the way the API sends them. */

export const nora: PersonResponse = { id: 'p-nora', username: 'nora', displayName: 'Nora Lind', avatarUrl: null };
export const alex: PersonResponse = { id: 'p-alex', username: 'alex', displayName: 'Alex Strand', avatarUrl: null };

export function photo(id: string, over: Partial<MediaResponse> = {}): MediaResponse {
  return { id, kind: 'photo', url: `https://example.com/${id}.jpg`, thumbUrl: `https://example.com/${id}-small.jpg`, width: 4, height: 3, durationSeconds: null, held: false, playbackUrl: null, ...over } as MediaResponse;
}

export function entry(over: Partial<EntryResponse> = {}): EntryResponse {
  return {
    id: 'e1',
    journeyId: 'j1',
    journeyTitle: 'Iceland ring road',
    author: nora,
    number: 8,
    label: 'Day 8',
    position: 3,
    title: 'Black sand and big waves',
    body: 'Reynisfjara at low tide.',
    placeName: 'Vík, Iceland',
    lat: 63.4186,
    lng: -19.006,
    locationPrecision: 'exact',
    isMilestone: false,
    happenedOn: '2026-04-08',
    happenedAt: '2026-04-08T14:00:00Z',
    createdAt: '2026-04-08T18:00:00Z',
    edited: false,
    media: [photo('m1')],
    likeCount: 2,
    commentCount: 1,
    viewer: { hasLiked: false, canEdit: true, canDelete: true },
    ...over,
  } as EntryResponse;
}

export function journey(over: Partial<JourneyResponse> = {}): JourneyResponse {
  return {
    id: 'j1',
    title: 'Iceland ring road',
    description: 'Ten days around the island.',
    owner: nora,
    authors: [nora],
    category: 'travel',
    template: 'trip',
    tags: ['iceland'],
    visibility: 'public',
    status: 'active',
    labelStyle: 'day',
    startDate: '2026-04-01',
    targetDays: null,
    coverUrl: 'https://example.com/cover.jpg',
    coverThumbUrl: 'https://example.com/cover-small.jpg',
    progressLabel: 'Day 8',
    latestNumber: 8,
    entryCount: 5,
    followerCount: 12,
    lastEntryAt: '2026-04-08T18:00:00Z',
    completedAt: null,
    closingNote: null,
    shareUrl: 'https://journey.app/j/iceland',
    viewer: { isOwner: false, isMember: false, isFollowing: false, canAddEntry: false, lastReadAt: null },
    ...over,
  } as JourneyResponse;
}

export function comment(id: string, over: Partial<CommentResponse> = {}): CommentResponse {
  return { id, entryId: 'e1', parentId: null, author: alex, body: `Comment ${id}`, createdAt: '2026-04-08T19:00:00Z', byCreator: false, held: false, viewer: { canDelete: false }, ...over } as CommentResponse;
}

/** What a generated `use…` query hook gives a screen, for a mock: loaded with `data`, or still on its way. */
export function loaded<T>(data: T) {
  return { data, isPending: false, isError: false, error: null, isFetching: false, isRefetching: false, isPaused: false, refetch: jest.fn() };
}
export function pending() {
  return { data: undefined, isPending: true, isError: false, error: null, isFetching: true, isRefetching: false, isPaused: false, refetch: jest.fn() };
}
export function failed(error: unknown) {
  return { data: undefined, isPending: false, isError: true, error, isFetching: false, isRefetching: false, isPaused: false, refetch: jest.fn() };
}
/** The same for a paged list (`use…Infinite`). */
export function pages<T>(...items: T[][]) {
  return { ...loaded({ pages: items.map((page) => ({ items: page, nextCursor: null })), pageParams: [] }), hasNextPage: false, hasPreviousPage: false, isFetchingNextPage: false, isFetchingPreviousPage: false, fetchNextPage: jest.fn(), fetchPreviousPage: jest.fn() };
}
