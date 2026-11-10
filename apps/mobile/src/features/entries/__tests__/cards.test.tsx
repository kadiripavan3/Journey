import { render, screen, userEvent } from '@testing-library/react-native';

import { entry, photo } from '@/test/samples';

import { EntryPost } from '../EntryPost';
import { EntryRow } from '../EntryRow';
import { entryDayLine, entryEyebrow, entryHeadline } from '../labels';

jest.mock('@/features/media/ClipPlayer', () => ({ ClipBadge: () => null }));

const HIDDEN = 'This photo is hidden while a person reviews it';
const held = entry({ media: [photo('flagged', { held: true })] });

describe('an entry in a list', () => {
  // The same entry is drawn by three cards. A photo that is held for review is veiled in every one of them:
  // the story's card was once a copy that had missed it.
  it.each([
    ['the feed card', <EntryPost key="a" entry={held} />],
    ['the story card', <EntryPost key="b" frame="story" entry={held} />],
    ['the row', <EntryRow key="c" entry={held} />],
  ])('veils a held cover in %s', async (_, card) => {
    await render(card);
    expect(screen.getByLabelText(HIDDEN)).toBeOnTheScreen();
  });

  it('veils a held photo that is not the first one, too', async () => {
    await render(<EntryPost frame="story" entry={entry({ media: [photo('fine'), photo('flagged', { held: true })] })} />);
    expect(screen.getByLabelText(HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText('1 / 2')).toBeOnTheScreen();
  });

  it('shows no veil on photos that are fine', async () => {
    await render(<EntryPost entry={entry()} />);
    expect(screen.queryByLabelText(HIDDEN)).not.toBeOnTheScreen();
  });

  it('the feed card says the day and place; the story card leaves that to the day marker', async () => {
    const view = await render(<EntryPost entry={entry()} />);
    expect(screen.getByText('Day 8 · Vík, Iceland')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Day 8 · Vík, Iceland. Black sand and big waves' })).toBeOnTheScreen();
    await view.rerender(<EntryPost frame="story" entry={entry()} />);
    expect(screen.queryByText('Day 8 · Vík, Iceland')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Black sand and big waves' })).toBeOnTheScreen();
  });

  it('marks what is new and who wrote it on the story card, and opens the entry', async () => {
    const open = jest.fn();
    await render(<EntryPost frame="story" entry={entry()} fresh showAuthor onPress={open} />);
    expect(screen.getByText('Nora Lind')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Black sand and big waves. New' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('counts the photos when there are several, and shows a single one plainly', async () => {
    const view = await render(<EntryPost entry={entry({ media: [photo('a'), photo('b'), photo('c')] })} />);
    expect(screen.getByText('1 / 3')).toBeOnTheScreen();
    await view.rerender(<EntryPost entry={entry()} />);
    expect(screen.queryByText(/1 \/ /)).not.toBeOnTheScreen();
  });
});

describe('the words for an entry', () => {
  it('writes "Day 14 · Hoi An" one way, for an entry and for a pin on the map', () => {
    expect(entryEyebrow({ label: 'Day 14', placeName: 'Hoi An' })).toBe('Day 14 · Hoi An');
    expect(entryEyebrow({ label: 'Part 3', placeName: null })).toBe('Part 3');
    expect(entryDayLine({ label: 'Day 12', placeName: 'Ha Giang loop', happenedOn: '2026-03-31' })).toBe('Day 12 · Ha Giang loop · 31 Mar');
  });

  it('calls an entry by its title, or the start of its text, or its label', () => {
    expect(entryHeadline(entry())).toBe('Black sand and big waves');
    expect(entryHeadline(entry({ title: '', body: 'Low tide.\nThen the waves.' }))).toBe('Low tide.');
    expect(entryHeadline(entry({ title: '', body: '' }))).toBe('Day 8');
  });
});
