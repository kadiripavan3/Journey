import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ActivityKind, type ActivityItemResponse } from '@/api/generated/journey';
import { hrefFor } from '@/features/notifications/target';
import { alex, nora } from '@/test/samples';

import { ActivityLine } from '../ActivityLine';
import { GROUPS, inGroup, tell } from '../kinds';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/features/people/PersonFollowButton', () => ({ PersonFollowButton: () => null }));

const JOURNEY = '11111111-2222-4333-8444-555555555555';
const ENTRY = '66666666-7777-4888-9999-000000000000';
const line = (kind: ActivityItemResponse['kind'], over: Partial<ActivityItemResponse> = {}): ActivityItemResponse => ({
  id: `line-${kind}`,
  kind,
  at: '2026-04-08T19:00:00Z',
  isNew: false,
  actors: [alex],
  actorCount: 1,
  count: 1,
  journeyId: JOURNEY,
  journeyTitle: 'Iceland ring road',
  entryId: ENTRY,
  entryTitle: 'Black sand and big waves',
  text: 'What a beach.',
  thumbUrl: null,
  followsActor: false,
  ...over,
});
const bold = (text: string | null) => <Text>{text}</Text>;

describe('the table of notification kinds', () => {
  // Activity and a tapped push must open the same place: every kind's path is one the notification target knows.
  it.each(Object.values(ActivityKind))('has words and a screen for "%s"', (kind) => {
    const told = tell(line(kind), bold);
    expect(told).not.toBeNull();
    expect(hrefFor(told?.path)).toBe(told?.path);
    expect(hrefFor(told?.path)).not.toBe('/activity');
  });

  it('opens what each kind is about', () => {
    const path = (kind: ActivityItemResponse['kind']) => tell(line(kind), bold)?.path;
    expect(path('new_entries')).toBe(`/journey/${JOURNEY}/timeline`);
    expect(path('journey_completed')).toBe(`/journey/${JOURNEY}`);
    expect(path('likes')).toBe(`/entry/${ENTRY}`);
    expect(path('comment')).toBe(`/entry/${ENTRY}?comments=1`);
    expect(path('reply')).toBe(`/entry/${ENTRY}?comments=1`);
    expect(path('invitation')).toBe(`/invitation/${JOURNEY}`);
    expect(path('friend_joined')).toBe(`/journey/${JOURNEY}`);
    expect(path('journey_follow')).toBe('/profile/alex');
    expect(path('profile_follow')).toBe('/profile/alex');
  });

  it('says nothing about a kind it does not know, rather than "started following you"', () => {
    const strange = line('profile_follow', { kind: 'something_new' as ActivityItemResponse['kind'] });
    expect(tell(strange, bold)).toBeNull();
    expect(inGroup(strange, 'all')).toBe(false);
  });

  it('puts every kind under exactly one tab besides All', () => {
    for (const kind of Object.values(ActivityKind)) {
      const tabs = GROUPS.filter((group) => group.id !== 'all' && inGroup(line(kind), group.id));
      expect(tabs).toHaveLength(1);
      expect(inGroup(line(kind), 'all')).toBe(true);
    }
  });
});

describe('a line of Activity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('says who did what and opens it', async () => {
    await render(<ActivityLine item={line('comment')} />);
    expect(screen.getByText(/commented: “What a beach.”/)).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button'));
    expect(mockPush).toHaveBeenCalledWith(`/entry/${ENTRY}?comments=1`);
  });

  it('names two people, and counts the rest', async () => {
    const view = await render(<ActivityLine item={line('likes', { actors: [alex, nora], actorCount: 2 })} />);
    expect(screen.getByText(/Alex Strand and Nora Lind liked Black sand and big waves/)).toBeOnTheScreen();
    await view.rerender(<ActivityLine item={line('likes', { actors: [alex, nora], actorCount: 5 })} />);
    expect(screen.getByText(/Alex Strand, Nora Lind and 3 others liked/)).toBeOnTheScreen();
  });

  it('draws nothing for a kind it does not know', async () => {
    await render(<ActivityLine item={line('likes', { kind: 'something_new' as ActivityItemResponse['kind'] })} />);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
