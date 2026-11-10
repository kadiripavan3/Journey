/** 5.3 The map of a journey, and the same stops as a list. */
import { plural } from './plural';

export const map = {
  /** "9 entries · 5 places" */
  counts: (entries: number, places: number) => `${plural(entries, 'entry', 'entries')} · ${plural(places, 'place')}`,
  /** Said when a journey has more places than are drawn. */
  capped: (shown: number) => `Showing the first ${shown} places.`,
  none: {
    title: 'No places yet',
    author: 'Add a place to an entry and it shows up here, joined to the others in the order of the story.',
    reader: 'Entries with a place show up here, joined in the order of the story.',
  },
  /** Above the list of stops. `capped` is the sentence from `capped` above, or null. */
  listLead: (capped: string | null) => `The stops of this journey, in the order of the story.${capped ? ` ${capped}` : ''}`,
  list: 'List',
  stops: 'Stops',
  /** "2 of 3 here": which of the entries at one place a card shows. */
  hereOf: (index: number, count: number) => `${index} of ${count} here`,

  // What a screen reader says. `eyebrow` is the entry's "Day 14 · Hoi An".
  cardSpoken: (eyebrow: string, title: string | null | undefined) => `${eyebrow}. ${title || 'Open the entry'}`,
  stopSpoken: (number: number, eyebrow: string, milestone: boolean, title: string | null | undefined) => `Stop ${number}. ${eyebrow}${milestone ? ', milestone' : ''}. ${title || 'Open the entry'}`,
  pinSpoken: (label: string, place: string | null | undefined, milestone: boolean) => `${label}${place ? `, ${place}` : ''}${milestone ? ', milestone' : ''}`,
} as const;
