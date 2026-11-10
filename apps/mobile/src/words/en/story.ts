/** 5.2 The story line of a journey, and 5.3 "Jump to". */
import { plural } from './plural';

export const story = {
  /** Under the title: who writes it ("Maya and 2 friends") and how much there is. */
  subtitle: (owner: string, friends: number, entries: number) => `${friends > 0 ? `${owner} and ${plural(friends, 'friend')}` : owner} · ${plural(entries, 'entry', 'entries')}`,
  map: 'Map of this journey',
  /** The filter that shows every author's entries. */
  everyone: 'Everyone',
  quietDays: (days: number) => plural(days, 'quiet day'),
  newSinceVisit: (count: number) => `${count} new since your last visit`,
  none: {
    by: (name: string) => `${name} hasn't added an entry yet.`,
    owner: 'Your story starts with the first entry.',
    reader: 'No entries yet. The first one will show up here.',
  },
  addFirst: 'Add the first entry',

  // Where a day starts on the line
  /** What a screen reader says for a day's marker. `detail` is its place and date. */
  daySpoken: (label: string, milestone: boolean, detail: string) => `${label}${milestone ? ', milestone' : ''}. ${detail}`,

  // 5.3 Jump to
  jump: {
    title: 'Jump to',
    resume: 'Continue where you left off',
    start: 'Start from the beginning',
    newest: 'Newest entry',
    highlights: 'Highlights',
    /** What a screen reader says for a highlight: its day and its title. */
    highlightSpoken: (label: string, title: string) => (title ? `${label}. ${title}` : label),
    days: 'Days',
    /** Under a long list of days: loads the days before the ones shown. */
    earlier: 'Earlier days',
    entries: (count: number) => plural(count, 'entry', 'entries'),
    daySpoken: (label: string, place: string | null | undefined, entries: number) => `${label}${place ? `, ${place}` : ''}. ${plural(entries, 'entry', 'entries')}`,
  },
} as const;
