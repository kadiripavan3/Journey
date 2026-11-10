import type { FlashListRef } from '@shopify/flash-list';
import { type RefObject, useEffect, useRef, useState } from 'react';

import { useCache } from '@/api/cache';
import { rows as unique } from '@/api/pages';
import { type EntryResponse, useGetJourney, useGetJourneySummary, useGetMe, useGetMembers, useGetTimelineInfinite, useMarkJourneyRead } from '@/api/generated/journey';
import { isGone, loadState } from '@/lib/loading';
import { firstName } from '@/lib/names';

import { rowOf, type StoryRow, storyRows } from './rows';

/** What was new when the screen opened. Fixed then, so the markers stay while the person reads. */
type Opened = { since: string | null; newCount: number; firstNew: string | null };

/**
 * The story line's data and rules (5.2): where the story is opened, what counts as new, loading further pages
 * in both directions, jumping to an entry, and narrowing a shared story to one person. The screen lays it out
 * and hands in its handle on the list, so "Jump to" can scroll it.
 */
export function useStory(id: string, list: RefObject<FlashListRef<StoryRow> | null>) {
  const cache = useCache();
  const me = useGetMe();
  const journey = useGetJourney(id);
  const summary = useGetJourneySummary(id);

  const [opened, setOpened] = useState<Opened | undefined>(undefined);
  // Where the story is opened: an entry's id, or null for the very start. Undefined until we know what is new.
  const [anchor, setAnchor] = useState<string | null | undefined>(undefined);
  // Decided on fresh answers only: what was loaded earlier may be from before the last visit, or before following.
  if (opened === undefined && journey.data && summary.data && !journey.isFetching && !summary.isFetching) {
    setOpened({ since: journey.data.viewer.lastReadAt, newCount: summary.data.newCount, firstNew: summary.data.firstNewEntryId });
    setAnchor(summary.data.firstNewEntryId);
  }

  // On a shared story: the username of the one person whose entries are shown, or null for everyone's.
  const [who, setWho] = useState<string | null>(null);
  const shared = (journey.data?.authors.length ?? 0) > 1;
  const members = useGetMembers(id, { query: { enabled: shared } });

  const timeline = useGetTimelineInfinite(id, anchor || who ? { ...(anchor ? { around: anchor } : {}), ...(who ? { author: who } : {}) } : undefined, {
    query: {
      enabled: anchor !== undefined,
      initialPageParam: undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      getPreviousPageParam: (first) => first.prevCursor ?? undefined,
    },
  });
  // The entry the story was to open at is gone (deleted since it was listed): open it from the start instead
  // of showing a page that can only fail again.
  if (anchor && timeline.isError && !timeline.data && isGone(timeline.error)) setAnchor(null);

  // Each entry once: pages can overlap when entries arrive while the story is being read.
  const entries = unique(timeline.data);
  const total = timeline.data?.pages[0]?.total ?? 0;
  const j = journey.data;
  const rows = entries && j ? storyRows(entries, { byDay: j.labelStyle === 'day', firstNew: who ? null : opened?.firstNew, newCount: opened?.newCount }) : undefined;

  const myId = me.data?.id;
  const isNew = (entry: EntryResponse) => !!opened?.since && entry.createdAt > opened.since && entry.author.id !== myId;

  const markRead = useMarkJourneyRead({ mutation: { onSuccess: () => cache.journeyRead(id) } });
  const marked = useRef(false);
  // Followers and authors both keep a "read up to here" mark; anyone else has none to move.
  const following = j ? j.viewer.lastReadAt != null : false;
  const loaded = !!entries;
  useEffect(() => {
    if (!marked.current && following && loaded) {
      marked.current = true;
      markRead.mutate({ id });
    }
  }, [loaded, following, id, markRead]);

  /** Goes to an entry: scrolls there when it is already loaded, otherwise opens the story around it. Null is the very start. */
  const jumpTo = (entryId: string | null) => {
    // The places to jump to are in the whole story, so jumping shows everyone's entries again.
    if (who) {
      setWho(null);
      setAnchor(entryId);
      return;
    }
    const index = entryId ? rowOf(rows ?? [], entryId) : entries?.[0]?.position === 1 ? 0 : -1;
    if (index >= 0) void list.current?.scrollToIndex({ index, animated: true });
    else setAnchor(entryId);
  };

  const whoAuthor = who ? j?.authors.find((author) => author.username === who) : undefined;
  return {
    journey: j,
    summary: summary.data,
    /** Undefined until the first page is in. */
    rows,
    /** How many entries the story (or the one person's part of it) has. */
    total,
    opened,
    isNew,
    load: loadState(journey, summary, timeline),

    shared,
    who,
    whoName: whoAuthor ? firstName(whoAuthor.displayName) : null,
    /** Shows one person's part of the story, from its start; null shows everyone's again. */
    pickWho: (username: string | null) => {
      setWho(username);
      setAnchor(null);
    },
    /** How many entries a person wrote, once the list of members is in. */
    wrote: (personId: string) => members.data?.members.find((member) => member.person.id === personId)?.entryCount,

    // A different opening point is a different list: it starts again at that entry.
    listKey: `${who ?? 'everyone'}:${anchor ?? 'start'}`,
    startAt: anchor && rows ? Math.max(rowOf(rows, anchor), 0) : 0,
    loadingMore: timeline.isFetchingNextPage,
    atEnd: !timeline.hasNextPage,
    onEnd: () => {
      if (timeline.hasNextPage && !timeline.isFetchingNextPage) void timeline.fetchNextPage();
    },
    onStart: () => {
      if (timeline.hasPreviousPage && !timeline.isFetchingPreviousPage) void timeline.fetchPreviousPage();
    },

    jumpTo,
  };
}
