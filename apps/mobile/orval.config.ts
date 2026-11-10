import { defineConfig } from 'orval';

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
      },
    },
  },
});
