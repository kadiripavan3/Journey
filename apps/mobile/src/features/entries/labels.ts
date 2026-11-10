import type { EntryResponse } from '@/api/generated/journey';
import { formatDay } from '@/lib/dates';
import { words } from '@/words';

/** What says where and when an entry is: an entry itself, or its pin on the map. */
type Dated = { label: string; placeName?: string | null };

/** "Day 14 · Hoi An": the entry's label and, when it has one, its place. The one way this line is written. */
export function entryEyebrow(entry: Dated): string {
  return words.common.join([entry.label, entry.placeName]);
}

/** "Day 12 · Ha Giang loop · 31 Mar": the same with the date, for a row in a list of days. */
export function entryDayLine(entry: Dated & { happenedOn: string }): string {
  return words.common.join([entryEyebrow(entry), formatDay(entry.happenedOn)]);
}

/** What to call an entry that has no title: the start of its text, or its label. */
export function entryHeadline(entry: Pick<EntryResponse, 'title' | 'body' | 'label'>): string {
  return entry.title || entry.body.split('\n')[0] || entry.label;
}
