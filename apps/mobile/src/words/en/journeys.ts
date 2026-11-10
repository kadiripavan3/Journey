/** What is said about a journey wherever one appears: on a card, in a row, in a menu. */
import { compact, plural } from './plural';

export const journeys = {
  /** What each state of a journey is called. */
  status: { active: 'Active', paused: 'Paused', completed: 'Completed' },

  /**
   * The three ways a journey can be seen. `note` says who sees it in a few words, `longNote` adds one more
   * thought (shown where a new journey's visibility is chosen), `badge` stands on a card in place of a follower count.
   */
  visibility: {
    public: { label: 'Public', note: 'Anyone. It can appear in Discover.', longNote: 'Anyone. It can appear in Discover.', badge: 'Public' },
    unlisted: { label: 'Unlisted', note: 'Only people with the link.', longNote: 'Only people with the link. Good for family.', badge: 'Unlisted' },
    private: { label: 'Private', note: 'Only you and friends you invite.', longNote: 'Only you and friends you invite. A journal you can publish later.', badge: 'Private' },
  },

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
  /** "Day 12 of 30": how far along a challenge is. `progress` is the journey's own label. */
  progressOf: (progress: string, target: number) => `${progress} of ${target}`,
} as const;
