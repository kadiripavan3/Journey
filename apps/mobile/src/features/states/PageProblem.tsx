import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { messageFor } from '@/api/fetcher';
import { isGone } from '@/lib/loading';
import { Problem } from '@/ui/Problem';

/** Goes to Home from anywhere: closes what is open on top of the tabs, or opens the tabs when there are none underneath. */
export function useGoHome(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canDismiss()) {
      router.dismissAll();
      router.navigate('/');
    } else {
      router.replace('/');
    }
  }, [router]);
}

type Props = {
  /** What the API (or the network) answered. */
  error: unknown;
  /** Asks again for everything that failed (`loadState(...).retry`). */
  onRetry: () => void;
  retrying?: boolean;
  tone?: 'page' | 'onPhoto';
};

/**
 * 13.3 Something went wrong: a whole page that didn't load. It says what happened in the API's words and
 * offers "Try again" and "Go to Home". Something that isn't there (deleted, private, blocked) can't be helped
 * by asking again, so that page offers only the way Home.
 */
export function PageProblem({ error, onRetry, retrying, tone }: Props) {
  const home = useGoHome();
  const gone = isGone(error);
  return <Problem tone={tone} title={gone ? "This isn't available" : undefined} message={messageFor(error)} onRetry={gone ? undefined : onRetry} retrying={retrying} onHome={home} />;
}
