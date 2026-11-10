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
} as const;
