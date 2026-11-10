import { defineConfig } from 'orval';

// The lists that come in pages (items + nextCursor). Each gets a hook that loads page after page.
const PAGED = [
  'getMyJourneys',
  'getFollowedJourneys',
  'getJourneysByUsername',
  'getFollowers',
  'getFollowing',
  'getBlocked',
  'getInvitable',
  'getInvitations',
  'getComments',
  'getTimeline',
  'getStoryDays',
  'getFeed',
];

// Generates the app's typed API client from the API's own description.
// Run `npm run api:generate` after apps/api/openapi.json changes.
export default defineConfig({
  journey: {
    input: '../api/openapi.json',
    output: {
      mode: 'single',
      target: 'src/api/generated/journey.ts',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: 'src/api/fetcher.ts', name: 'apiFetch' },
        fetch: { includeHttpResponseReturnType: false },
        operations: Object.fromEntries(
          PAGED.map((operation) => [operation, { query: { useQuery: true, useInfinite: true, useInfiniteQueryParam: 'cursor' } }]),
        ),
      },
    },
  },
});
