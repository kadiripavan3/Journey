/** 4.1 Discover and a category's own page. */

export const discover = {
  title: 'Discover',
  search: {
    spoken: 'Search journeys, people and tags',
    hint: 'Search journeys, people, #tags',
  },
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
  },
} as const;
