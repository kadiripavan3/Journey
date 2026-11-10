import { render, screen, userEvent } from '@testing-library/react-native';

import { ApiError } from '@/api/fetcher';
import JourneyPage from '@/app/(app)/journey/[id]/index';
import { daysBetween, today } from '@/lib/dates';
import { onPhone } from '@/test/phone';
import { entry, failed, journey, loaded, pending } from '@/test/samples';

const mockJourney = jest.fn();
const mockSummary = jest.fn();
const mockLeave = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'j1' }),
  useRouter: () => ({ push: mockPush, canDismiss: () => true, dismissAll: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
  useIsFocused: () => true,
}));
jest.mock('@/features/navigation/useLeave', () => ({ useLeave: () => mockLeave }));
jest.mock('@/api/cache', () => ({ useCache: () => ({ journeyFollowed: jest.fn() }) }));
jest.mock('@/features/journeys/catalog', () => ({ useCatalog: () => ({ category: () => ({ id: 'travel', label: 'Travel', emoji: '' }) }) }));
jest.mock('@/features/journeys/JourneyMenus', () => ({ JourneyMenu: () => null }));
jest.mock('@/features/sharing/ShareSheet', () => ({ JourneyShareSheet: () => null }));
jest.mock('@/features/media/ClipPlayer', () => ({ ClipBadge: () => null }));
jest.mock('@/api/generated/journey', () => ({
  useGetJourney: () => mockJourney(),
  useGetJourneySummary: () => mockSummary(),
  useFollowJourney: () => ({ mutate: jest.fn(), isPending: false }),
  useUnfollowJourney: () => ({ mutate: jest.fn(), isPending: false }),
}));

const summary = (over = {}) => ({ first: entry(), latest: [entry({ id: 'e3', title: 'Black sand and big waves' }), entry({ id: 'e2', title: 'Skógafoss in the rain' })], photos: [], photoCount: 0, days: [], milestones: [], newCount: 0, firstNewEntryId: null, ...over });
const writes = { isOwner: true, isMember: false, isFollowing: false, canAddEntry: true, lastReadAt: null };

describe('the journey page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJourney.mockReturnValue(loaded(journey()));
    mockSummary.mockReturnValue(loaded(summary()));
  });

  it('with a journey: its title, numbers, newest entries, the story and the map, and the Follow bar', async () => {
    await render(onPhone(<JourneyPage />));
    expect(screen.getByRole('header', { name: 'Iceland ring road' })).toBeOnTheScreen();
    expect(screen.getByText('following')).toBeOnTheScreen();
    expect(screen.getByText('Skógafoss in the rain')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Read all 5 entries' })).toBeOnTheScreen();
    expect(screen.getByText("Follow Nora's journey")).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Map' }));
    expect(mockPush).toHaveBeenCalledWith('/journey/j1/map');
  });

  it('with nothing yet: the shape of the page, and a way back', async () => {
    mockJourney.mockReturnValue(pending());
    await render(onPhone(<JourneyPage />));
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Back' }));
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });

  it('says so when it was never loaded and the phone is offline', async () => {
    mockJourney.mockReturnValue({ ...pending(), isPaused: true });
    await render(onPhone(<JourneyPage />));
    expect(screen.getByRole('header', { name: "You're offline" })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Back' })).toBeOnTheScreen();
  });

  it('with an error: "Try again" asks again, and "Go to Home" is there', async () => {
    const down = failed(new ApiError(0, 'unreachable', "Can't reach Journey right now. Check your connection and try again."));
    mockJourney.mockReturnValue(down);
    await render(onPhone(<JourneyPage />));
    expect(screen.getByText("Can't reach Journey right now. Check your connection and try again.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Go to Home' })).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));
    expect(down.refetch).toHaveBeenCalledTimes(1);
  });

  it("doesn't offer to try again for a journey that isn't there", async () => {
    mockJourney.mockReturnValue(failed(new ApiError(404, 'not_found', "This journey isn't available.")));
    await render(onPhone(<JourneyPage />));
    expect(screen.getByRole('header', { name: "This isn't available" })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Go to Home' })).toBeOnTheScreen();
  });

  it('keeps the page when a refresh fails behind it', async () => {
    mockJourney.mockReturnValue({ ...failed(new ApiError(0, 'unreachable', "Can't reach Journey right now.")), data: journey() });
    await render(onPhone(<JourneyPage />));
    expect(screen.getByRole('header', { name: 'Iceland ring road' })).toBeOnTheScreen();
    expect(screen.queryByText("Can't reach Journey right now.")).not.toBeOnTheScreen();
  });

  it('a challenge says "cheering" and asks for today\'s check-in until there is one', async () => {
    const challenge = journey({ targetDays: 30, startDate: today(), viewer: writes });
    mockJourney.mockReturnValue(loaded(challenge));
    const view = await render(onPhone(<JourneyPage />));
    expect(screen.getByText('cheering')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Post today's check-in" })).toBeOnTheScreen();

    mockSummary.mockReturnValue(loaded(summary({ days: [daysBetween(challenge.startDate, today()) + 1] })));
    await view.rerender(onPhone(<JourneyPage />));
    expect(screen.queryByRole('button', { name: "Post today's check-in" })).not.toBeOnTheScreen();
  });
});
