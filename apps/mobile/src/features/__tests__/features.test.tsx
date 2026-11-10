import { render, screen, userEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import type { JourneyResponse } from '@/api/generated/journey';
import { addDays, today } from '@/lib/dates';
import { firstName } from '@/lib/names';

import { ChallengeCard } from '../journeys/ChallengeCard';
import { VISIBILITY, visibility } from '../journeys/visibility';
import { ErrorBoundary } from '../navigation/ErrorBoundary';
import { RecentSearchesProvider, useRecentSearches } from '../search/recent';

describe('ErrorBoundary', () => {
  it('says what happened in plain words and offers to try again', async () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    const retry = jest.fn(() => Promise.resolve());
    await render(<ErrorBoundary error={new Error('Cannot read properties of undefined')} retry={retry} />);
    expect(screen.getByRole('header', { name: 'Something went wrong' })).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(quiet).toHaveBeenCalled(); // the error itself goes to the log
    quiet.mockRestore();
  });
});

describe('ChallengeCard', () => {
  const start = addDays(today(), -9); // today is day 10
  const journey = { id: 'j', title: '30 days of guitar', startDate: start, targetDays: 30, status: 'active', labelStyle: 'part' } as JourneyResponse;

  it('counts days by their date, so a journey labelled in parts is right too', async () => {
    // The API sends the days that have an entry (here days 3 and 10), whatever the entries are labelled.
    await render(<ChallengeCard journey={journey} days={[3, 10]} />);
    expect(screen.getByText('2 of 30 days')).toBeOnTheScreen();
    expect(screen.getByLabelText('Checked in on 2 of 30 days')).toBeOnTheScreen();
    expect(screen.getByText(/20 days to go/)).toBeOnTheScreen();
  });

  it('is not shown for a journey without a number of days to reach', async () => {
    await render(<ChallengeCard journey={{ ...journey, targetDays: null } as unknown as JourneyResponse} days={[]} />);
    expect(screen.queryByText(/days/)).not.toBeOnTheScreen();
  });
});

describe('recent searches', () => {
  function Probe() {
    const { recent, remember } = useRecentSearches();
    return (
      <>
        <Text>{recent.join(' | ') || 'none'}</Text>
        {['iceland', 'surf', 'iceland', 'a', 'b', 'c', 'd'].map((words, i) => (
          <Pressable key={i} accessibilityRole="button" accessibilityLabel={`search ${i}`} onPress={() => remember(words)} />
        ))}
      </>
    );
  }

  it('keeps the last five, newest first, without repeats, and forgets them when the signed-in part of the app goes away', async () => {
    const user = userEvent.setup();
    const view = await render(
      <RecentSearchesProvider>
        <Probe />
      </RecentSearchesProvider>,
    );
    expect(screen.getByText('none')).toBeOnTheScreen();
    for (let i = 0; i < 3; i++) await user.press(screen.getByRole('button', { name: `search ${i}` }));
    expect(screen.getByText('iceland | surf')).toBeOnTheScreen();
    for (let i = 3; i < 7; i++) await user.press(screen.getByRole('button', { name: `search ${i}` }));
    expect(screen.getByText('d | c | b | a | iceland')).toBeOnTheScreen();

    // Signing out takes the provider away; the next person starts with none.
    await view.unmount();
    await render(
      <RecentSearchesProvider>
        <Probe />
      </RecentSearchesProvider>,
    );
    expect(screen.getByText('none')).toBeOnTheScreen();
  });
});

describe('shared words', () => {
  it('has one place for what each visibility is called', () => {
    expect(VISIBILITY.map((v) => v.id)).toEqual(['public', 'unlisted', 'private']);
    expect(visibility('private').badge).toBe('Only you');
    expect(visibility('something else').id).toBe('public');
  });

  it('finds a first name', () => {
    expect(firstName('  Maya  Okafor ')).toBe('Maya');
    expect(firstName('Cher')).toBe('Cher');
    expect(firstName(undefined)).toBe('');
  });
});
