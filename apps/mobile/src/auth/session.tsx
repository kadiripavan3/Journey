import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { connectSession } from '@/api/fetcher';

import { runBeforeSignOut } from './beforeSignOut';
import { clearToken, loadToken, saveToken } from './storage';

type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn' };

type Session = SessionState & {
  /** Call with the token from a successful sign-in. */
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const token = useRef<string | null>(null);

  const signOut = useCallback(async () => {
    await runBeforeSignOut(); // while still signed in: this phone stops getting the person's notifications
    token.current = null;
    await clearToken();
    queryClient.clear(); // nothing of the previous person stays in memory
    setState({ status: 'signedOut' });
  }, [queryClient]);

  const signIn = useCallback(async (next: string) => {
    token.current = next;
    await saveToken(next);
    setState({ status: 'signedIn' });
  }, []);

  useEffect(() => {
    connectSession({ getToken: () => token.current, onSignedOut: () => void signOut() });
    void loadToken().then((saved) => {
      token.current = saved;
      setState({ status: saved ? 'signedIn' : 'signedOut' });
    });
  }, [signOut]);

  const value = useMemo(() => ({ ...state, signIn, signOut }), [state, signIn, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
