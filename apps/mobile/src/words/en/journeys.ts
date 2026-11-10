/** What is said about a journey wherever one appears: on a card, in a row, in a menu. */
import { compact, plural } from './plural';

export const journeys = {
  /** "1.2k following": how many people follow a journey. */
  following: (count: number) => `${compact(count)} following`,
  /** In place of a count when nobody follows yet. */
  beFirstToFollow: 'Be the first to follow',
  /** The same for a challenge: "46 cheering". */
  cheering: (count: number) => `${compact(count)} cheering`,
  /** What a challenge's own author reads: "46 people cheering you on". */
  cheeringYouOn: (count: number) => `${plural(count, 'person', 'people')} cheering you on`,
  /** "3 new": entries since the last visit. */
  newCount: (count: number) => `${count} new`,
} as const;
