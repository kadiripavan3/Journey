import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ApiError } from '@/api/fetcher';
import Timeline from '@/app/(app)/journey/[id]/timeline';
import { onPhone } from '@/test/phone';
import { entry, failed, journey, loaded, pages, pending, photo } from '@/test/samples';

const mockJourney = jest.fn();
const mockSummary = jest.fn();
const mockTimeline = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'j1' }),
  useRouter: () => ({ push: jest.fn(), canGoBack: () => true, back: jest.fn(), replace: jest.fn(), canDismiss: () => true, dismissAll: jest.fn(), navigate: jest.fn() }),
}));
jest.mock('@/api/cache', () => ({ useCache: () => ({ journeyRead: jest.fn() }) }));
jest.mock('@/features/drafts/PostingBanner', () => ({ PostingBanner: () => null }));
jest.mock('@/features/media/ClipPlayer', () => ({ ClipBadge: () => null }));
// The real list draws only the rows a phone's screen has room for; in a test every row is drawn.
jest.mock('@/ui/List', () => ({
  List: ({ data, row }: { data: unknown[]; row: (item: unknown, index: number) => ReactElement }) => {
    const { View } = jest.requireActual('react-native');
    return <View>{data.map((item, index) => <View key={index}>{row(item, index)}</View>)}</View>;
  },
}));
jest.mock('@/api/generated/journey', () => ({
  useGetMe: () => ({ data: { id: 'p-me' } }),
  useGetJourney: () => mockJourney(),
  useGetJourneySummary: () => mockSummary(),
  useGetMembers: () => ({ data: undefined }),
  useMarkJourneyRead: () => ({ mutate: jest.fn() }),
  useGetTimelineInfinite: (_id: string, params?: { around?: string }) => mockTimeline(params),
}));

const day12 = entry({ id: 'a', number: 12, label: 'Day 12', position: 1, title: 'Roads that look like rivers', createdAt: '2026-04-01T10:00:00Z' });
const day14 = entry({ id: 'b', number: 14, label: 'Day 14', position: 2, title: 'Floating market at sunrise', createdAt: '2026-04-03T10:00:00Z' });
const summary = (over = {}) => ({ first: day12, latest: [day14, day12], photos: [], photoCount: 0, days: [12, 14], milestones: [], newCount: 0, firstNewEntryId: null, ...over });
const story = (...entries: ReturnType<typeof entry>[]) => {
  const list = pages(entries);
  return { ...list, data: { ...list.data, pages: [{ items: entries, nextCursor: null, prevCursor: null, total: entries.length }] } };
};

describe('the story line', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJourney.mockReturnValue(loaded(journey()));
    mockSummary.mockReturnValue(loaded(summary()));
    mockTimeline.mockReturnValue(story(day12, day14));
  });

  it('with entries: each day has its label, quiet days are counted, and every entry has its card', async () => {
    await render(onPhone(<Timeline />));
    expect(screen.getByRole('header', { name: /^Day 12\./ })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: /^Day 14\./ })).toBeOnTheScreen();
    expect(screen.getByText('1 quiet day')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Roads that look like rivers' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Floating market at sunrise' })).toBeOnTheScreen();
  });

  it('marks what is new since the last visit', async () => {
    mockJourney.mockReturnValue(loaded(journey({ viewer: { isOwner: false, isMember: false, isFollowing: true, canAddEntry: false, lastReadAt: '2026-04-02T00:00:00Z' } })));
    mockSummary.mockReturnValue(loaded(summary({ newCount: 1, firstNewEntryId: 'b' })));
    await render(onPhone(<Timeline />));
    expect(screen.getByText('1 new since your last visit')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Floating market at sunrise. New' })).toBeOnTheScreen();
  });

  it('veils a held cover in the story, as everywhere else', async () => {
    mockTimeline.mockReturnValue(story(entry({ id: 'a', media: [photo('flagged', { held: true })] })));
    await render(onPhone(<Timeline />));
    expect(screen.getByLabelText('This photo is hidden while a person reviews it')).toBeOnTheScreen();
  });

  it('with nothing in it: says where the story starts', async () => {
    mockJourney.mockReturnValue(loaded(journey({ entryCount: 0, viewer: { isOwner: true, isMember: false, isFollowing: false, canAddEntry: true, lastReadAt: null } })));
    mockSummary.mockReturnValue(loaded(summary({ first: null, latest: [] })));
    mockTimeline.mockReturnValue(story());
    await render(onPhone(<Timeline />));
    expect(screen.getByText('Your story starts with the first entry.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add the first entry' })).toBeOnTheScreen();
  });

  it('while loading: the shape of the story, not a spinner on a blank page', async () => {
    mockTimeline.mockReturnValue(pending());
    await render(onPhone(<Timeline />));
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
  });

  it('with an error and nothing to show: the page says so, with both ways on', async () => {
    mockJourney.mockReturnValue(failed(new ApiError(0, 'unreachable', "Can't reach Journey right now.")));
    mockSummary.mockReturnValue(pending());
    mockTimeline.mockReturnValue(pending());
    await render(onPhone(<Timeline />));
    expect(screen.getByText("Can't reach Journey right now.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Go to Home' })).toBeOnTheScreen();
  });

  it('keeps the story on screen when a refresh fails behind it', async () => {
    mockTimeline.mockReturnValue({ ...story(day12, day14), isError: true, error: new ApiError(0, 'unreachable', "Can't reach Journey right now.") });
    await render(onPhone(<Timeline />));
    expect(screen.getByRole('button', { name: 'Roads that look like rivers' })).toBeOnTheScreen();
    expect(screen.queryByText("Can't reach Journey right now.")).not.toBeOnTheScreen();
  });

  it('opens from the start by itself when the entry it was to open at has gone', async () => {
    // The first new entry was deleted after the summary was made: asking for the story around it gives "not found".
    mockSummary.mockReturnValue(loaded(summary({ newCount: 1, firstNewEntryId: 'gone' })));
    mockTimeline.mockImplementation((params?: { around?: string }) => (params?.around ? failed(new ApiError(404, 'not_found', "This entry isn't available.")) : story(day12, day14)));
    await render(onPhone(<Timeline />));
    expect(screen.getByRole('button', { name: 'Roads that look like rivers' })).toBeOnTheScreen();
    expect(screen.queryByText("This entry isn't available.")).not.toBeOnTheScreen();
    expect(mockTimeline).toHaveBeenCalledWith({ around: 'gone' });
    expect(mockTimeline).toHaveBeenLastCalledWith(undefined);
  });
});
