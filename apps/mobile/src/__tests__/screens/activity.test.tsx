import { render, screen, userEvent } from '@testing-library/react-native';

import { ApiError } from '@/api/fetcher';
import type { ActivityItemResponse } from '@/api/generated/journey';
import Activity from '@/app/(app)/(tabs)/activity';
import { onPhone } from '@/test/phone';
import { alex, failed, loaded, nora, pending } from '@/test/samples';

const mockActivity = jest.fn();
const mockSeen = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), canDismiss: () => true, dismissAll: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
  // The tab is in front for the whole test: what runs on focus runs when the screen is drawn.
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('@/api/refetchOnFocus', () => ({ useRefetchOnFocus: jest.fn() }));
const mockCache = { activitySeen: jest.fn() };
jest.mock('@/api/cache', () => ({ useCache: () => mockCache }));
jest.mock('@/features/people/PersonFollowButton', () => ({ PersonFollowButton: () => null }));
jest.mock('@/api/generated/journey', () => ({
  ...jest.requireActual('@/api/generated/journey'),
  useGetActivity: () => mockActivity(),
  useGetDigest: () => ({ data: undefined }),
  useMarkActivitySeen: () => ({ mutate: mockSeen }),
}));

const line = (id: string, kind: ActivityItemResponse['kind'], over: Partial<ActivityItemResponse> = {}): ActivityItemResponse => ({
  id,
  kind,
  at: '2026-04-08T19:00:00Z',
  isNew: false,
  actors: [alex],
  actorCount: 1,
  count: 1,
  journeyId: '11111111-2222-4333-8444-555555555555',
  journeyTitle: 'Iceland ring road',
  entryId: '66666666-7777-4888-9999-000000000000',
  entryTitle: 'Black sand and big waves',
  text: 'What a beach.',
  thumbUrl: null,
  followsActor: false,
  ...over,
});

describe('Activity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivity.mockReturnValue(loaded({ newCount: 1, items: [line('1', 'comment', { isNew: true }), line('2', 'profile_follow', { actors: [nora] })] }));
  });

  it('with lines: what is new first, then the rest, and it marks them seen once', async () => {
    await render(onPhone(<Activity />));
    expect(screen.getByText('New')).toBeOnTheScreen();
    expect(screen.getByText('Earlier')).toBeOnTheScreen();
    expect(screen.getByText(/commented: “What a beach.”/)).toBeOnTheScreen();
    expect(screen.getByText(/started following you/)).toBeOnTheScreen();
    expect(mockSeen).toHaveBeenCalledTimes(1);
    // Once the API has heard, the lists that show "new" are read again through the cache, not by hand.
    mockSeen.mock.calls[0][1].onSuccess();
    expect(mockCache.activitySeen).toHaveBeenCalledTimes(1);
  });

  it('shows one kind of line under its tab', async () => {
    await render(onPhone(<Activity />));
    await userEvent.setup().press(screen.getByRole('tab', { name: 'People' }));
    expect(screen.getByText(/started following you/)).toBeOnTheScreen();
    expect(screen.queryByText(/commented/)).not.toBeOnTheScreen();
  });

  it('with nothing: says what will arrive here', async () => {
    mockActivity.mockReturnValue(loaded({ newCount: 0, items: [] }));
    await render(onPhone(<Activity />));
    expect(screen.getByRole('header', { name: 'Nothing new yet' })).toBeOnTheScreen();
    expect(mockSeen).not.toHaveBeenCalled();
  });

  it('while loading: rows in the shape of the list', async () => {
    mockActivity.mockReturnValue(pending());
    await render(onPhone(<Activity />));
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
  });

  it('with an error and nothing to show: the sentence and a way to try again', async () => {
    const down = failed(new ApiError(0, 'unreachable', "Can't reach Journey right now."));
    mockActivity.mockReturnValue(down);
    await render(onPhone(<Activity />));
    expect(screen.getByText("Can't reach Journey right now.")).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));
    expect(down.refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the lines when a refresh fails behind them', async () => {
    mockActivity.mockReturnValue({ ...failed(new ApiError(0, 'unreachable', "Can't reach Journey right now.")), data: { newCount: 0, items: [line('2', 'profile_follow', { actors: [nora] })] } });
    await render(onPhone(<Activity />));
    expect(screen.getByText(/started following you/)).toBeOnTheScreen();
    expect(screen.queryByText("Can't reach Journey right now.")).not.toBeOnTheScreen();
  });
});
