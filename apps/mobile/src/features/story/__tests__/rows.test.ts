import { entry } from '@/test/samples';

import { loadedDays, rowOf, storyRows } from '../rows';

const story = [
  entry({ id: 'a', number: 12, label: 'Day 12', position: 1 }),
  entry({ id: 'b', number: 12, label: 'Day 12', position: 2 }),
  entry({ id: 'c', number: 15, label: 'Day 15', position: 3 }),
  entry({ id: 'd', number: 16, label: 'Day 16', position: 4 }),
];
const kinds = (rows: ReturnType<typeof storyRows>) => rows.map((row) => (row.kind === 'entry' ? row.entry.id : row.kind === 'day' ? `day ${row.entry.number}` : row.kind === 'gap' ? `gap ${row.days}` : `new ${row.count}`));

describe('the rows of a story', () => {
  it('gives each day one label, before its first entry, with how many entries it has', () => {
    const rows = storyRows(story, { byDay: true });
    expect(kinds(rows)).toEqual(['day 12', 'a', 'b', 'gap 2', 'day 15', 'c', 'day 16', 'd']);
    expect(rows.find((row) => row.kind === 'day')).toMatchObject({ count: 2 });
  });

  it('counts quiet days only where entries are numbered by day', () => {
    expect(kinds(storyRows(story, { byDay: false }))).not.toContain('gap 2');
  });

  it('puts "new since your last visit" where the new entries start: before the day when it opens one, before the entry otherwise', () => {
    expect(kinds(storyRows(story, { byDay: true, firstNew: 'c', newCount: 2 }))).toEqual(['day 12', 'a', 'b', 'gap 2', 'new 2', 'day 15', 'c', 'day 16', 'd']);
    expect(kinds(storyRows(story, { byDay: true, firstNew: 'b', newCount: 3 }))).toEqual(['day 12', 'a', 'new 3', 'b', 'gap 2', 'day 15', 'c', 'day 16', 'd']);
  });

  it('opens at an entry together with what introduces it', () => {
    const rows = storyRows(story, { byDay: true, firstNew: 'c', newCount: 2 });
    // "c" opens a day and is the first new entry: the list starts at the "new" line, not at the card.
    expect(rows[rowOf(rows, 'c')]).toMatchObject({ kind: 'new' });
    expect(rows[rowOf(rows, 'd')]).toMatchObject({ kind: 'day' });
    expect(rows[rowOf(rows, 'b')]).toMatchObject({ kind: 'entry' });
    expect(rowOf(rows, 'gone')).toBe(-1);
  });

  it('lists the loaded days newest first, for Jump to', () => {
    expect(loadedDays(storyRows(story, { byDay: true })).map((day) => day.entry.label)).toEqual(['Day 16', 'Day 15', 'Day 12']);
  });
});
