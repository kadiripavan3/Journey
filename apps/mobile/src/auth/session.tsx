import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { connectSession } from '@/api/fetcher';

import { signInService } from './signIn';

type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn' };

type Session = SessionState & { signOut: () => Promise<void> };

const SessionContext = createContext<Session | null>(null);

/**
 * Whether someone is signed in. The sign-in service (the test one, or Supabase) says so: when the app starts,
 * when a code or Apple or Google signs someone in, when a token is renewed, and when the sign-in ends.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const token = useRef<string | null>(null);

  const signOut = useCallback(async () => {
    token.current = null;
    await signInService.signOut();
    queryClient.clear(); // nothing of the previous person stays in memory
    setState({ status: 'signedOut' });
  }, [queryClient]);

  useEffect(() => {
    const hear = (next: string | null) => {
      const was = token.current;
      token.current = next;
      if (next && !was) setState({ status: 'signedIn' });
      if (!next && was) {
        queryClient.clear();
        setState({ status: 'signedOut' });
      }
    };
    connectSession({
      getToken: () => token.current,
      renew: async () => {
        const fresh = await signInService.renew();
        if (fresh) token.current = fresh;
        return fresh;
      },
      onSignedOut: () => void signOut(),
    });
    const stop = signInService.onToken(hear);
    void signInService
      .restore()
      .catch(() => null)
      .then((saved) => {
        token.current = saved;
        setState({ status: saved ? 'signedIn' : 'signedOut' });
      });
    return stop;
  }, [queryClient, signOut]);

  const value = useMemo(() => ({ ...state, signOut }), [state, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
