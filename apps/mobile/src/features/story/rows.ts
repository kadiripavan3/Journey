import type { EntryResponse } from '@/api/generated/journey';

/**
 * What the story line is made of, top to bottom. A day's label is a row of its own so it can stay at the
 * top of the screen while its entries scroll underneath.
 */
export type StoryRow =
  | { kind: 'gap'; key: string; days: number }
  | { kind: 'new'; key: string; count: number }
  | { kind: 'day'; key: string; entry: EntryResponse; count: number }
  | { kind: 'entry'; key: string; entry: EntryResponse };

type Options = {
  /** Whether entries are numbered by day: only then can the days between two entries be counted as quiet. */
  byDay: boolean;
  /** The first entry that is new since the reader's last visit, and how many there are. */
  firstNew?: string | null;
  newCount?: number;
};

/**
 * Lays the loaded entries out as rows: before a day's first entry come the quiet days since the one before,
 * then (where the new ones start) "N new since your last visit", then the day's label; then the entries.
 */
export function storyRows(entries: readonly EntryResponse[], { byDay, firstNew, newCount = 0 }: Options): StoryRow[] {
  const rows: StoryRow[] = [];
  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    const newDay = !previous || previous.number !== entry.number;
    const marker: StoryRow | null = entry.id === firstNew ? { kind: 'new', key: 'new', count: newCount } : null;
    if (newDay) {
      const quiet = previous && byDay ? entry.number - previous.number - 1 : 0;
      if (quiet > 0) rows.push({ kind: 'gap', key: `gap:${entry.id}`, days: quiet });
      if (marker) rows.push(marker);
      const count = entries.filter((other) => other.number === entry.number).length;
      rows.push({ kind: 'day', key: `day:${entry.id}`, entry, count });
    } else if (marker) {
      rows.push(marker);
    }
    rows.push({ kind: 'entry', key: entry.id, entry });
  });
  return rows;
}

/**
 * Where to open (or scroll) the list so that an entry is in view with what introduces it: its day's label,
 * and the "new since your last visit" line when it is the first new one. -1 when the entry isn't loaded.
 */
export function rowOf(rows: readonly StoryRow[], entryId: string): number {
  let index = rows.findIndex((row) => row.kind === 'entry' && row.entry.id === entryId);
  if (index < 0) return -1;
  while (index > 0 && (rows[index - 1]?.kind === 'day' || rows[index - 1]?.kind === 'new')) index -= 1;
  return index;
}
