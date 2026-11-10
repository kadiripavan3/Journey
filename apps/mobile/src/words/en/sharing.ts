/** 6.6 Sharing a journey, an entry or your own page: the sheet, and the words that go out with the link. */
import { plural } from './plural';

export const sharing = {
  /** The places a link can be sent to. */
  ways: { messages: 'Messages', mail: 'Mail', copy: 'Copy link', more: 'More' },

  entry: {
    mine: 'Share your entry',
    theirs: 'Share this entry',
    /** Under the entry's title on the link's card: "Day 14 of Vietnam by motorbike, by Maya". */
    line: (label: string, journey: string, author: string) => `${label} of ${journey}, by ${author}`,
  },

  // Your "Follow my journey" link
  followLink: {
    title: 'Your “Follow my journey” link',
    note: 'For your Instagram or TikTok bio',
    line: 'Your public journeys on one page. Put the link in your Instagram or TikTok bio.',
  },

  journey: {
    mine: 'Share your journey',
    theirs: 'Share this journey',
    recap: 'Share the recap',
    isPrivate: 'This journey is private, so it has no link to share.',
    /** Under the title on the link's card. `progress` is the journey's own label: "Day 14". */
    line: (progress: string, owner: string) => `${progress} · by ${owner}`,
    /** What goes out with the link. */
    text: (title: string) => `${title} on Journey`,
    /** The same two for a recap: "14 days · 9 entries · 5 places". Places are left out when there are none. */
    recapLine: (days: number, entries: number, places: number) => [plural(days, 'day'), plural(entries, 'entry', 'entries'), ...(places > 0 ? [plural(places, 'place')] : [])].join(' · '),
    recapText: (title: string, days: number, entries: number) => `${title}: ${plural(days, 'day')}, ${plural(entries, 'entry', 'entries')} on Journey`,
  },
} as const;
