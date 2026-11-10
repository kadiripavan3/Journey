/** Words that belong to no one screen: the buttons every screen has, and how small pieces are put together. */
import { compact } from './plural';

export const common = {
  appName: 'Journey',
  back: 'Back',
  close: 'Close',
  next: 'Next',
  continue: 'Continue',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  follow: 'Follow',
  following: 'Following',
  tryAgain: 'Try again',
  goHome: 'Go to Home',
  showMore: 'Show more',
  keepIt: 'Keep it',
  copy: 'Copy',
  copied: 'Copied',

  /** Facts that stand side by side on one line: "Day 14 · Hoi An". Parts that are empty are left out. */
  join: (parts: readonly (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · '),
  /** One more fact after another on the same line, where it is drawn differently: " · Travel". */
  also: (part: string) => ` · ${part}`,
  /** Someone's own words, in quotation marks. */
  quoted: (text: string) => `“${text}”`,
  /** The word under a number, for the number it stands under: "1 entry", "14 entries". */
  unit: {
    days: (count: number) => (count === 1 ? 'day' : 'days'),
    entries: (count: number) => (count === 1 ? 'entry' : 'entries'),
    places: (count: number) => (count === 1 ? 'place' : 'places'),
    photos: (count: number) => (count === 1 ? 'photo' : 'photos'),
    journeys: (count: number) => (count === 1 ? 'journey' : 'journeys'),
    followers: (count: number) => (count === 1 ? 'follower' : 'followers'),
  },
  /** What a screen reader says for a row: its parts one after another, each ending its own sentence. */
  spoken: (parts: readonly (string | null | undefined | false)[]) => parts.filter(Boolean).join('. '),
  /** 1200 becomes "1.2k". */
  compact: (count: number) => compact(count),

  // What a screen reader says for the design system's own pieces
  /** A number over a word: "14 entries". */
  stat: (value: string | number, label: string) => `${value} ${label}`,
  /** A tab or a chip with a count after it: "Journeys, 3". */
  withCount: (label: string, count: string | number) => `${label}, ${count}`,
  /** A field that opens a picker: "Start date: 3 Apr. Change". */
  fieldChange: (label: string, value: string) => `${label}: ${value}. Change`,
  /** A section's heading that opens the whole list. */
  seeAll: (title: string) => `${title}. See all`,
  stepOf: (step: number, of: number) => `Step ${step} of ${of}`,
  digitCode: (length: number) => `${length}-digit code`,
} as const;
