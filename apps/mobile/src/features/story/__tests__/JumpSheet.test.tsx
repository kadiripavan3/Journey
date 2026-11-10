import { render, screen, userEvent } from '@testing-library/react-native';

import type { JourneySummaryResponse, StoryDayResponse } from '@/api/generated/journey';
import { JumpSheet } from '@/features/story/JumpSheet';
import { onPhone } from '@/test/phone';

const mockDays = jest.fn();
jest.mock('@/api/generated/journey', () => ({
  ...jest.requireActual('@/api/generated/journey'),
  useGetStoryDaysInfinite: (...asked: unknown[]) => mockDays(...asked),
}));

const entry = (id: string, label: string, title: string) => ({ id, label, title, happenedOn: '2026-04-08', placeName: null }) as unknown as NonNullable<JourneySummaryResponse['first']>;
const summary = (over: Partial<JourneySummaryResponse> = {}): JourneySummaryResponse =>
  ({ first: entry('e1', 'Day 1', 'Old quarter'), latest: [entry('e9', 'Day 22', 'Sunrise')], photos: [], photoCount: 0, days: [], milestones: [], newCount: 0, firstNewId: null, ...over }) as JourneySummaryResponse;
const day = (label: string | null, happenedOn: string, place: string | null, entryCount: number, firstEntryId: string): StoryDayResponse => ({ label, happenedOn, place, entryCount, firstEntryId });
const loaded = (items: StoryDayResponse[], hasNextPage = false) => ({ data: { pages: [{ items, nextCursor: null }], pageParams: [undefined] }, hasNextPage, fetchNextPage: jest.fn() });

describe('JumpSheet', () => {
  beforeEach(() => mockDays.mockReset());

  it('lists every day of the story from the API, and each opens at its first entry', async () => {
    mockDays.mockReturnValue(loaded([day('Day 22', '2026-04-29', 'Mount Bromo, Indonesia', 2, 'e9'), day('Day 21', '2026-04-28', null, 1, 'e8')]));
    const onJump = jest.fn();
    await render(onPhone(<JumpSheet visible onClose={jest.fn()} journeyId="j1" summary={summary()} onJump={onJump} />));

    // The days are only asked for once the sheet is open.
    expect(mockDays.mock.calls[0][2].query.enabled).toBe(true);
    expect(screen.getByText('Days')).toBeOnTheScreen();
    expect(screen.getByText('Mount Bromo, Indonesia')).toBeOnTheScreen();
    expect(screen.getByText('2 entries')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Day 22, Mount Bromo, Indonesia. 2 entries' }));
    expect(onJump).toHaveBeenCalledWith('e9');
  });

  it('shows the highlights with their pictures, and a way to the days before the ones loaded', async () => {
    const more = loaded([day(null, '2026-04-29', null, 1, 'e9'), day(null, '2026-04-28', null, 1, 'e8')], true);
    mockDays.mockReturnValue(more);
    const onJump = jest.fn();
    const milestones = [{ entryId: 'e5', title: 'Ha Giang loop', label: 'Day 9', happenedOn: '2026-04-16', thumbUrl: 'https://photos.example/ha-giang.w320.jpg' }];
    await render(onPhone(<JumpSheet visible onClose={jest.fn()} journeyId="j1" summary={summary({ milestones })} onJump={onJump} />));

    expect(screen.getByText('Highlights')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Day 9. Ha Giang loop' }));
    expect(onJump).toHaveBeenCalledWith('e5');
    // A journey told in parts has no day numbers: a day is named by its date.
    expect(screen.getByText('29 Apr')).toBeOnTheScreen();
    await userEvent.press(screen.getByText('Earlier days'));
    expect(more.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('waits to ask while it is closed', async () => {
    mockDays.mockReturnValue({ data: undefined, hasNextPage: false, fetchNextPage: jest.fn() });
    await render(onPhone(<JumpSheet visible={false} onClose={jest.fn()} journeyId="j1" summary={summary()} onJump={jest.fn()} />));
    expect(mockDays.mock.calls[0][2].query.enabled).toBe(false);
  });
});
