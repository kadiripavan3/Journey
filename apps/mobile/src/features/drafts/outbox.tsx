import { createContext, type ReactNode, use, useEffect, useRef, useState } from 'react';

import { useOnline } from '@/api/online';
import { useCache } from '@/api/cache';
import { messageFor } from '@/api/fetcher';
import { useGetMe } from '@/api/generated/journey';

import { isUnreachable, sendDraft, uploadsForgotten } from './send';
import { draftStore } from './store';
import type { Draft, DraftInput, DraftStore, Progress } from './types';

type Value = {
  /** This person's drafts and entries on their way, oldest first. */
  drafts: Draft[];
  /** How far the one going up has come, by the draft's id. */
  progress: Record<string, Progress | undefined>;
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

/** After nothing answered: how long to wait before the next try. Longer each time, up to two minutes. */
const waitFor = (fails: number) => Math.min(15_000 * 2 ** Math.max(fails - 1, 0), 120_000);

/**
 * 7.4 Drafts and uploads: entries that haven't been posted yet live here, on the phone. A new entry is put
 * in line and goes up in the background, one at a time, oldest first: its photos and clips, then the entry.
 * Without a connection it waits and goes by itself when the phone is back. Every entry carries the id it was
 * given when it was started, so however often it is sent, it is posted once.
 */
export function OutboxProvider({ children, store = draftStore }: { children: ReactNode; store?: DraftStore }) {
  const cache = useCache();
  const owner = useGetMe().data?.id;
  const online = useOnline();
  const [all, setAll] = useState<Draft[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress | undefined>>({});
  /** True for a while after nothing answered, so a phone that only thinks it is online isn't asked over and over. */
  const [resting, setResting] = useState(false);
  const sending = useRef<string | null>(null);
  const fails = useRef(0);
  const resent = useRef(new Set<string>());
  const rest = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (rest.current) clearTimeout(rest.current);
    },
    [],
  );

  useEffect(() => {
    if (!owner) return;
    let current = true;
    store
      .load(owner)
      .then((drafts) => {
        // Anything saved while the list was loading stays.
        if (current) setAll((now) => [...drafts.filter((draft) => !now.some((other) => other.clientId === draft.clientId)), ...now]);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [owner, store]);

  const drafts = all.filter((draft) => draft.owner === owner).sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  const put = (next: Draft) => setAll((now) => [...now.filter((draft) => draft.clientId !== next.clientId), next]);

  const run = async (draft: Draft) => {
    let current: Draft = { ...draft, state: 'sending', problem: undefined };
    try {
      // Kept as "queued" until it is done: if the app closes now, it carries on from here next time.
      await store.save({ ...current, state: 'queued' });
      put(current);
      await sendDraft(current, {
        onProgress: (step) => setProgress((now) => ({ ...now, [draft.clientId]: step })),
        onUploaded: async (key, mediaId) => {
          current = { ...current, media: current.media.map((media) => (media.key === key ? { ...media, mediaId } : media)) };
          await store.save({ ...current, state: 'queued' }).catch(() => undefined);
        },
      });
      await store.remove(draft.clientId).catch(() => undefined);
      fails.current = 0;
      resent.current.delete(draft.clientId);
      setAll((now) => now.filter((other) => other.clientId !== draft.clientId));
      void cache.entrySaved(draft.journeyId).catch(() => undefined);
    } catch (error) {
      let next: Draft;
      if (isUnreachable(error)) {
        // No connection after all: it keeps its place in line and is tried again in a while.
        next = { ...current, state: 'queued' };
        fails.current += 1;
        setResting(true);
        if (rest.current) clearTimeout(rest.current);
        rest.current = setTimeout(() => setResting(false), waitFor(fails.current));
      } else if (uploadsForgotten(error) && !resent.current.has(draft.clientId)) {
        // Its files went up so long ago that the API cleared them out. Send them again, once.
        resent.current.add(draft.clientId);
        next = { ...current, state: 'queued', media: current.media.map((media) => ({ ...media, mediaId: undefined })) };
      } else {
        next = { ...current, state: 'failed', problem: messageFor(error) };
      }
      await store.save(next).catch(() => undefined);
      put(next);
    } finally {
      sending.current = null;
      setProgress((now) => ({ ...now, [draft.clientId]: undefined }));
    }
  };

  // Whenever something changes: if the phone is online and nothing is going up, the oldest one in line goes.
  const next = owner && online && !resting ? drafts.find((draft) => draft.state === 'queued') : undefined;
  useEffect(() => {
    if (!next || sending.current) return;
    sending.current = next.clientId;
    void run(next);
  });

  const value: Value = {
    drafts,
    progress,
    online,
    save: async (input, how) => {
      if (!owner) throw new Error('Nobody is signed in.');
      const media = [];
      for (const item of input.media) media.push(await store.keep(input.clientId, item));
      const draft: Draft = { ...input, media, owner, state: how === 'post' ? 'queued' : 'draft', problem: undefined, savedAt: new Date().toISOString() };
      await store.save(draft);
      put(draft);
    },
    hold: (clientId) => {
      if (sending.current === clientId) return false;
      const draft = all.find((other) => other.clientId === clientId);
      if (draft && draft.state !== 'draft') {
        const held: Draft = { ...draft, state: 'draft', problem: undefined };
        put(held);
        void store.save(held).catch(() => undefined);
      }
      return true;
    },
    release: (clientId, was) => {
      const draft = all.find((other) => other.clientId === clientId);
      if (!draft || draft.state !== 'draft' || was === 'draft' || was === 'sending') return;
      const back: Draft = { ...draft, state: 'queued', problem: undefined };
      put(back);
      void store.save(back).catch(() => undefined);
    },
    retry: (clientId) => {
      const draft = all.find((other) => other.clientId === clientId);
      if (!draft || sending.current === clientId) return;
      fails.current = 0;
      const again: Draft = { ...draft, state: 'queued', problem: undefined };
      put(again);
      void store.save(again).catch(() => undefined);
    },
    discard: async (clientId) => {
      if (sending.current === clientId) return;
      setAll((now) => now.filter((draft) => draft.clientId !== clientId));
      await store.remove(clientId).catch(() => undefined);
    },
  };
  return <OutboxContext value={value}>{children}</OutboxContext>;
}

export function useOutbox(): Value {
  const value = use(OutboxContext);
  if (!value) throw new Error('useOutbox must be used inside OutboxProvider');
  return value;
}
