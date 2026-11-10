/** Words that belong to no one screen: the buttons every screen has, and how small pieces are put together. */
import { compact } from './plural';

export const common = {
  appName: 'Journey',
  back: 'Back',
  close: 'Close',
  next: 'Next',
  continue: 'Continue',
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
