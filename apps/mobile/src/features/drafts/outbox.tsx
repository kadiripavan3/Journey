import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, use, useEffect, useMemo, useSyncExternalStore } from 'react';

import { cacheFor } from '@/api/cache';
import { onAnswer } from '@/api/fetcher';
import { useGetMe } from '@/api/generated/journey';
import { useOnline } from '@/api/online';

import { OutboxEngine } from './engine';
import { draftStore } from './store';
import type { Draft, DraftInput, DraftStore, Progress } from './types';

type Value = {
  /** This person's drafts and entries on their way, oldest first. */
  drafts: Draft[];
  /** False when the phone says it has no connection. */
  online: boolean;
  /** Keeps what the composer holds on the phone. "post" puts it in line to go up; "draft" leaves it waiting for its author. */
  save: (input: DraftInput, how: 'draft' | 'post') => Promise<void>;
  /** Takes a draft out of the line, so it can be changed. False when it is going up right now. */
  hold: (clientId: string) => boolean;
  /**
   * Puts back in line a draft that was only held to be looked at: the composer was closed without a change
   * and without a choice. `was` is what `hold` took it out of ("queued" or "failed"); a real draft stays one.
   */
  release: (clientId: string, was: Draft['state']) => void;
  /** Puts a failed one back in line. */
  retry: (clientId: string) => void;
  /** Forgets a draft and its files. Does nothing while it is going up. */
  discard: (clientId: string) => Promise<void>;
};

const OutboxContext = createContext<Value | null>(null);
const EngineContext = createContext<OutboxEngine | null>(null);

const NONE: Draft[] = [];
const nothing = () => () => {};

/**
 * 7.4 Drafts and uploads: entries that haven't been posted yet live here, on the phone. A new entry is put
 * in line and goes up in the background, one at a time: its photos and clips, then the entry. Without a
 * connection it waits and goes by itself when the phone is back. Every entry carries the id it was given
 * when it was started, so however often it is sent, it is posted once.
 *
 * The work itself is `OutboxEngine`; this shows screens what it holds. What `useOutbox()` hands out only
 * changes when the list of drafts or the connection does. How far an upload has come changes many times a
 * second, so it has a hook of its own, `useProgress`, for the few places that draw it.
 */
export function OutboxProvider({ children, store = draftStore }: { children: ReactNode; store?: DraftStore }) {
  const client = useQueryClient();
  const owner = useGetMe().data?.id;
  const online = useOnline();
  const engine = useMemo(
    () => (owner ? new OutboxEngine({ store, owner, onPosted: (journeyId) => void cacheFor(client).entrySaved(journeyId).catch(() => undefined) }) : null),
    [owner, store, client],
  );

  useEffect(() => {
    if (!engine) return;
    engine.start();
    // Whatever was waiting for a journey or an account that has just been deleted goes with it, whichever
    // screen asked for the deletion.
    const stopHearing = onAnswer((method, path) => {
      if (method !== 'DELETE') return;
      const journey = /^\/v1\/journeys\/([^/?]+)$/.exec(path);
      if (journey?.[1]) void engine.discardJourney(journey[1]);
      else if (path === '/v1/me') void engine.discardEverything();
    });
    return () => {
      stopHearing();
      engine.stop();
    };
  }, [engine]);

  useEffect(() => engine?.setOnline(online), [engine, online]);

  const drafts = useSyncExternalStore(engine?.subscribe ?? nothing, engine?.getDrafts ?? (() => NONE));
  const value = useMemo<Value>(
    () => ({
      drafts,
      online,
      save: (input, how) => (engine ? engine.save(input, how) : Promise.reject(new Error('Nobody is signed in.'))),
      hold: (clientId) => engine?.hold(clientId) ?? false,
      release: (clientId, was) => engine?.release(clientId, was),
      retry: (clientId) => engine?.retry(clientId),
      discard: (clientId) => engine?.discard(clientId) ?? Promise.resolve(),
    }),
    [drafts, online, engine],
  );
  return (
    <EngineContext value={engine}>
      <OutboxContext value={value}>{children}</OutboxContext>
    </EngineContext>
  );
}

export function useOutbox(): Value {
  const value = use(OutboxContext);
  if (!value) throw new Error('useOutbox must be used inside OutboxProvider');
  return value;
}

/**
 * How far one draft that is going up has come; undefined while it isn't going up. Only the component that
 * calls this draws again as the upload moves on, and a few times a second at most.
 */
export function useProgress(clientId: string | undefined): Progress | undefined {
  const engine = use(EngineContext);
  return useSyncExternalStore(engine?.subscribeProgress ?? nothing, () => (engine && clientId ? engine.getProgress(clientId) : undefined));
}
