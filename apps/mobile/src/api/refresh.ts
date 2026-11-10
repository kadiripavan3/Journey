import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * After something changes (a follow, a new entry, an edited profile), every list that might show it is fetched again.
 * The app is small enough that refreshing everything on screen is simpler and safer than tracking which lists changed.
 */
export function useRefreshAll(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries(), [queryClient]);
}
