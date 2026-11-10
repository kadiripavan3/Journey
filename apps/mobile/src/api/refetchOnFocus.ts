import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Fetches a screen's data again each time the person comes back to it (not the first time it opens),
 * so what other people did meanwhile shows up without pulling down to refresh.
 */
export function useRefetchOnFocus(...refetch: (() => unknown)[]) {
  const latest = useRef(refetch);
  useEffect(() => {
    latest.current = refetch;
  });
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      latest.current.forEach((again) => void again());
    }, []),
  );
}
