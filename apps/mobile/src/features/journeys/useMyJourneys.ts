import { useGetMyJourneysInfinite } from '@/api/generated/journey';
import { paged, rows, useEveryPage } from '@/api/pages';

/**
 * The person's own journeys, all of them. Home, the You tab and "Add to…" sort and count them, so they need
 * the whole list; it is short by nature, and it arrives in pages of 100 until there are no more.
 */
export function useMyJourneys(enabled = true) {
  const query = useGetMyJourneysInfinite({ limit: 100 }, { query: { ...paged, enabled } });
  useEveryPage(query);
  return { ...query, journeys: rows(query.data) ?? [] };
}
