import { render, screen, userEvent } from '@testing-library/react-native';

import { alex, journey, nora } from '@/test/samples';

import { CaughtUp } from '../CaughtUp';
import { FollowButton } from '../FollowButton';
import { JourneyCard } from '../JourneyCard';
import { JourneyRow } from '../JourneyRow';

const mockFollow = jest.fn();
const mockUnfollow = jest.fn();
jest.mock('@/api/cache', () => ({ useCache: () => ({ journeyFollowed: jest.fn() }) }));
jest.mock('@/api/generated/journey', () => ({
  useFollowJourney: () => ({ mutate: mockFollow, isPending: false }),
  useUnfollowJourney: () => ({ mutate: mockUnfollow, isPending: false }),
}));

const viewer = { isOwner: false, isMember: false, isFollowing: false, canAddEntry: false, lastReadAt: null };

describe('JourneyCard', () => {
  it('shows the journey, where it has got to and how many follow', async () => {
    const open = jest.fn();
    await render(<JourneyCard journey={journey()} onPress={open} />);
    expect(screen.getByText('Iceland ring road')).toBeOnTheScreen();
    expect(screen.getByText('Day 8 · Nora Lind')).toBeOnTheScreen();
    expect(screen.getByText('12 following')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: /^Iceland ring road/ }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('labels a completed and a paused journey by itself', async () => {
    const view = await render(<JourneyCard journey={journey({ status: 'completed' })} />);
    expect(screen.getByText('Completed')).toBeOnTheScreen();
    await view.rerender(<JourneyCard journey={journey({ status: 'paused' })} />);
    expect(screen.getByText('Paused')).toBeOnTheScreen();
  });

  it('says "Shared" on a journey friends write together, next to any other label', async () => {
    const shared = journey({ authors: [nora, alex] });
    const view = await render(<JourneyCard journey={shared} />);
    expect(screen.getByText('Shared')).toBeOnTheScreen();
    // On your own profile an active journey carries its day as a label: Shared stands beside it.
    await view.rerender(<JourneyCard journey={shared} pill="Day 8" />);
    expect(screen.getByText('Day 8')).toBeOnTheScreen();
    expect(screen.getByText('Shared')).toBeOnTheScreen();
    await view.rerender(<JourneyCard journey={{ ...shared, status: 'completed' }} />);
    expect(screen.getByText('Completed')).toBeOnTheScreen();
    expect(screen.getByText('Shared')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Completed\. Shared\.$/ })).toBeOnTheScreen();
  });

  it('has no Shared label on a journey with one author', async () => {
    await render(<JourneyCard journey={journey()} />);
    expect(screen.queryByText('Shared')).not.toBeOnTheScreen();
  });
});

describe('JourneyRow', () => {
  it('shows a label before the detail and reads it out', async () => {
    await render(<JourneyRow title="Iceland ring road" detail="Day 8 · 12 following" badge="Shared" onPress={() => {}} />);
    expect(screen.getByText('Shared')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Iceland ring road. Shared. Day 8 · 12 following' })).toBeOnTheScreen();
  });
});

describe('FollowButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('follows a journey that is not followed yet', async () => {
    await render(<FollowButton journey={journey({ viewer })} />);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Follow' }));
    expect(mockFollow).toHaveBeenCalledWith({ id: 'j1' });
  });

  it('says Following, and stops following when pressed', async () => {
    await render(<FollowButton journey={journey({ viewer: { ...viewer, isFollowing: true } })} />);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Following' }));
    expect(mockUnfollow).toHaveBeenCalledWith({ id: 'j1' });
    expect(mockFollow).not.toHaveBeenCalled();
  });

  it('is not shown on your own journey', async () => {
    await render(<FollowButton journey={journey({ viewer: { ...viewer, isOwner: true } })} />);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});

describe('where a feed ends', () => {
  it('says "You\'re all caught up" with the sentence it is given', async () => {
    await render(<CaughtUp line="That's every new entry from the 3 journeys you follow." />);
    expect(screen.getByRole('header', { name: "You're all caught up" })).toBeOnTheScreen();
    expect(screen.getByText("That's every new entry from the 3 journeys you follow.")).toBeOnTheScreen();
  });
});
