/** 4.2 Search: journeys, people and tags. */
import { plural } from './plural';

export const search = {
  spoken: 'Search journeys, people and tags',
  hint: 'Journeys, people, #tags',
  clear: 'Clear',

  // Before anything is typed
  recent: 'Recent',
  searchFor: (text: string) => `Search for ${text}`,
  popularTags: 'Popular tags',
  searchForTag: (tag: string) => `Search for the tag ${tag}`,

  // Results
  tabs: { journeys: 'Journeys', people: 'People', tags: 'Tags' },
  tagCount: (journeys: number) => plural(journeys, 'journey'),
  tagSpoken: (tag: string, journeys: number) => `Search for the tag ${tag}. ${plural(journeys, 'journey')} here`,
  /** When nothing matches, by what was looked for. */
  nothing: {
    journeys: (query: string) => `No journeys match “${query}”. Try fewer or different words.`,
    people: (query: string) => `No people match “${query}”. Try fewer or different words.`,
    tags: (query: string) => `No tags match “${query}”. Try fewer or different words.`,
  },
} as const;
