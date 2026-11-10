/** One journey's own pages: its page, changing it, completing it, its recap, and "your journey is live". */
import { plural } from './plural';

export const journey = {
  // 5.1 Journey
  page: {
    cover: (title: string) => `Cover photo of ${title}`,
    /** Who writes it: "Maya", "Maya and Lea", or "Maya and 3 others" (the owner first). */
    authors: (names: readonly string[], owner: string) => (names.length <= 2 ? names.join(' and ') : `${owner} and ${names.length - 1} others`),
    shared: 'Shared journey',
    /** `authors` comes from `authors` above. */
    sharedSpoken: (authors: string) => `Shared journey. ${authors}. See the people`,
    /** The word under the follower count. */
    cheering: 'cheering',
    following: 'following',
    checkIn: "Post today's check-in",
    seeRecap: 'See the recap',
    photosSpoken: (count: number) => `${plural(count, 'photo')}. Open the story.`,
    /** The owner reads `story.none.owner`. */
    noEntries: {
      member: 'The story starts with the first entry. It could be yours.',
      reader: (firstName: string) => `${firstName} hasn't added an entry yet. Follow to hear about the first one.`,
    },
    readAll: (count: number) => `Read all ${count} entries`,
    readStory: 'Read the story',
    map: 'Map',
    closingNote: 'Closing note',
    options: 'Journey options',
  },

  // Edit journey
  edit: {
    title: 'Edit journey',
    dayTitle: 'When did it start?',
    whoCanSee: 'Who can see it',
  },

  // 5.7 Complete a journey
  complete: {
    title: 'Complete journey',
    /** "14 days · 9 entries · 5 places" */
    summary: (days: number, entries: number, places: number) => `${plural(days, 'day')} · ${plural(entries, 'entry', 'entries')} · ${plural(places, 'place')}`,
    heading: 'How did it end?',
    lead: 'A closing note for your followers. It becomes the last page of the story.',
    /** The field's label, with how much of the room is used. */
    note: (length: number, most: number) => `Closing note · ${length} of ${most}`,
    footnote: "A completed journey takes no new entries. Everyone who follows it sees that it's finished.",
  },

  // 5.8 Recap
  recap: {
    complete: 'Journey complete',
    soFar: 'So far',
    share: 'Share recap',
    readAll: 'Read the whole journey',
  },

  // 7.7 Journey is live
  live: {
    /** The label the first entry will get. */
    firstLabel: (byDay: boolean) => (byDay ? 'Day 1' : 'Part 1'),
    /** The headline, by who can see the journey. */
    title: {
      public: (title: string) => `${title} is live`,
      unlisted: (title: string) => `${title} is ready`,
      private: (title: string) => `${title} is ready`,
    },
    note: {
      public: 'Share the link so friends can follow from day one. Once it has a cover and three entries, people can also find it in Discover.',
      unlisted: 'Only people you give the link to will see it. Share it with the ones you want along.',
      private: 'Add your first entry to get it going. Only you can see it until you decide to publish.',
    },
    addFirst: 'Add your first entry',
    shareLink: 'Share the link',
    later: 'Maybe later',
  },
} as const;
