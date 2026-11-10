import { MutationCache, QueryClient } from '@tanstack/react-query';

import { ApiError, isUnreachable } from './fetcher';
import { getGetJourneyQueryKey, type JourneyResponse } from './generated/journey';
import { changeNotSent } from './online';

/** How long an answer nobody is looking at stays in memory: for as long as the app is likely to stay open. */
const IN_MEMORY_FOR_MS = 24 * 60 * 60 * 1000;

/**
 * The app's data layer, set up once in the root layout.
 *
 *  - Reading waits without a connection (what was loaded stays on screen) and is asked again when it is back.
 *  - A change (a like, a follow, a save) never waits in silence: without a connection it fails at once with
 *    the app's own "can't reach Journey" sentence, so nothing looks done that isn't.
 *  - A journey the person writes in is known from their list of journeys, so its composer opens without a
 *    connection.
 */
export function makeQueryClient(): QueryClient {
  const client = new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isUnreachable(error)) changeNotSent();
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: IN_MEMORY_FOR_MS,
        // Asking again won't fix "not allowed" or "not found".
        retry: (failures, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 2,
      },
      mutations: { networkMode: 'always' },
    },
  });
  knowMyJourneys(client);
  return client;
}

type Listed = { items?: JourneyResponse[] };

/**
 * The list of a person's journeys also answers "this journey" for each one in it, until the API says more.
 * The composer asks for its journey by id; this way it has an answer for every journey the person can write
 * in, also straight after the app started without a connection.
 */
function knowMyJourneys(client: QueryClient): void {
  client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    const { queryKey, state } = event.query;
    if (!queryKey.includes('/v1/me/journeys')) return;
    const data = state.data as (Listed & { pages?: Listed[] }) | undefined;
    const journeys = data?.pages ? data.pages.flatMap((page) => page.items ?? []) : (data?.items ?? []);
    for (const journey of journeys) {
      const key = getGetJourneyQueryKey(journey.id);
      if ((client.getQueryState(key)?.dataUpdatedAt ?? 0) < state.dataUpdatedAt) client.setQueryData(key, journey, { updatedAt: state.dataUpdatedAt });
    }
  });
}
