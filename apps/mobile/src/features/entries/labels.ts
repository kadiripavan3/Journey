import type { EntryResponse } from '@/api/generated/journey';

/** "Day 14 · Hoi An": the entry's label and, when it has one, its place. */
export function entryEyebrow(entry: EntryResponse): string {
  return entry.placeName ? `${entry.label} · ${entry.placeName}` : entry.label;
}

/** What to call an entry that has no title: the start of its text, or its label. */
export function entryHeadline(entry: EntryResponse): string {
  return entry.title || entry.body.split('\n')[0] || entry.label;
}
