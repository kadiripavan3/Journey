import { createContext, type ReactNode, use, useCallback, useMemo, useState } from 'react';

type RecentSearches = {
  /** What this person searched for earlier, newest first. */
  recent: string[];
  remember: (words: string) => void;
};

const RecentSearchesContext = createContext<RecentSearches | null>(null);

/**
 * Keeps the last few searches while someone is signed in. It lives inside the signed-in part of the app,
 * so signing out forgets them: the next person on this phone starts with none.
 */
export function RecentSearchesProvider({ children }: { children: ReactNode }) {
  const [recent, setRecent] = useState<string[]>([]);
  const remember = useCallback((words: string) => setRecent((now) => [words, ...now.filter((r) => r !== words)].slice(0, 5)), []);
  const value = useMemo(() => ({ recent, remember }), [recent, remember]);
  return <RecentSearchesContext value={value}>{children}</RecentSearchesContext>;
}

export function useRecentSearches(): RecentSearches {
  const value = use(RecentSearchesContext);
  if (!value) throw new Error('useRecentSearches must be used inside RecentSearchesProvider');
  return value;
}
