import { render, screen, userEvent } from '@testing-library/react-native';

import { ApiError } from '@/api/fetcher';
import EntryView from '@/app/(app)/entry/[id]';
import { onPhone } from '@/test/phone';
import { entry, failed, loaded, pages, pending, photo } from '@/test/samples';

const mockEntry = jest.fn();
const mockTimeline = jest.fn();
const mockLeave = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'e2' }),
  useRouter: () => ({ push: mockPush, canDismiss: () => true, dismissAll: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
  useIsFocused: () => true,
}));
jest.mock('@/features/navigation/useLeave', () => ({ useLeave: () => mockLeave }));
jest.mock('@/features/entries/CommentsSheet', () => ({ CommentsSheet: () => null }));
jest.mock('@/features/entries/EntryMenu', () => ({ EntryMenu: () => null }));
jest.mock('@/features/entries/Reactions', () => ({ Reactions: () => null }));
jest.mock('@/features/sharing/ShareSheet', () => ({ EntryShareSheet: () => null }));
jest.mock('@/features/media/PhotoViewer', () => ({ PhotoViewer: () => null }));
jest.mock('@/features/media/ClipPlayer', () => ({ ClipBadge: () => null }));
jest.mock('@/api/generated/journey', () => ({ useGetEntry: () => mockEntry(), useGetTimelineInfinite: () => mockTimeline() }));

const opened = entry({ id: 'e2', position: 2, title: 'Skógafoss in the rain' });
const story = () => {
  const list = pages([entry({ id: 'e1', position: 1, title: 'Leaving Reykjavík' }), opened, entry({ id: 'e3', position: 3, title: 'Black sand and big waves' })]);
  return { ...list, data: { ...list.data, pages: list.data.pages.map((page) => ({ ...page, prevCursor: null, total: 3 })) } };
};

describe('the entry viewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEntry.mockReturnValue(loaded(opened));
    mockTimeline.mockReturnValue(story());
  });

  it('with an entry: its card, where it is in the story, and the way to its place on the map', async () => {
    await render(onPhone(<EntryView />));
    expect(screen.getByText('Entry 2 of 3')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Skógafoss in the rain' })).toBeOnTheScreen();
    await userEvent.setup().press(screen.getAllByRole('button', { name: 'Day 8 · Vík, Iceland. Show it on the map' })[0]!);
    expect(mockPush).toHaveBeenCalledWith('/journey/j1/map?entry=e2');
  });

  it('with nothing yet: it waits on the dark stage, and Close works', async () => {
    mockEntry.mockReturnValue(pending());
    mockTimeline.mockReturnValue(pending());
    await render(onPhone(<EntryView />));
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Close' }));
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });

  it('with an entry that has gone: it says so and offers Home, not another try', async () => {
    mockEntry.mockReturnValue(failed(new ApiError(404, 'not_found', "This entry isn't available.")));
    mockTimeline.mockReturnValue(pending());
    await render(onPhone(<EntryView />));
    expect(screen.getByText("This entry isn't available.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Go to Home' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();
  });

  it('still shows the entry when the story around it cannot be had', async () => {
    mockTimeline.mockReturnValue(failed(new ApiError(404, 'not_found', "This entry isn't available.")));
    await render(onPhone(<EntryView />));
    expect(screen.getByRole('header', { name: 'Skógafoss in the rain' })).toBeOnTheScreen();
    expect(screen.getByText('Entry 2')).toBeOnTheScreen();
    expect(screen.queryByText("This entry isn't available.")).not.toBeOnTheScreen();
  });

  it('veils a photo that is held for review', async () => {
    const held = entry({ id: 'e2', position: 2, media: [photo('flagged', { held: true })] });
    mockEntry.mockReturnValue(loaded(held));
    const list = pages([held]);
    mockTimeline.mockReturnValue({ ...list, data: { ...list.data, pages: [{ items: [held], nextCursor: null, prevCursor: null, total: 1 }] } });
    await render(onPhone(<EntryView />));
    expect(screen.getByLabelText('This photo is hidden while a person reviews it')).toBeOnTheScreen();
    expect(screen.getByText('One photo is being reviewed')).toBeOnTheScreen();
  });
});
