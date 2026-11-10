/** 4.1 Discover and a category's own page. */

export const discover = {
  /** The search bar at the top; what a screen reader says for it is `search.spoken`. */
  searchHint: 'Search journeys, people, #tags',
  none: {
    /** `category` is the category's name as the API gives it: "Travel". */
    inCategory: (category: string) => `No ${category.toLowerCase()} journeys yet`,
    all: 'Nothing to discover yet',
    body: 'Public journeys with a cover and three entries show up here. Yours could be the first.',
  },
  trending: 'Trending now',
  trendingPill: 'Trending',
  fresh: 'New journeys',
  completed: 'Recently completed',

  // 4.4 Category
  category: {
    /** The heading when the category itself isn't known. */
    title: 'Journeys',
    lead: 'Journeys that are going on now, and the ones that were just completed.',
    none: 'Nothing here yet',
    /** Under the heading, once the numbers are known: "1,284 in progress · 312 finished this month". */
    counts: (inProgress: number, finished: number) => `${inProgress.toLocaleString('en')} in progress · ${finished.toLocaleString('en')} finished this month`,
  },

  // The page of challenges: journeys with a number of days to reach
  challenges: {
    title: 'Challenges',
    /** A quick filter: challenges of this many days. */
    days: (days: number) => `${days} days`,
    none: 'No challenges like that yet',
  },
} as const;
