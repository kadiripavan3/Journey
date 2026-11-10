import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { type EntryResponse, useGetEntry, useGetTimelineInfinite } from '@/api/generated/journey';
import { rows } from '@/api/pages';
import { loadState } from '@/lib/loading';

/**
 * The entry viewer's data (6.1): the entry that was opened, and the story around it a page at a time, so
 * the person can swipe on in both directions. `step` is how far apart two cards are, to tell which is in view;
 * `list` is the screen's handle on the list of cards, to keep the card being read in place.
 */
export function useEntryPager(id: string, step: number, list: RefObject<FlatList<EntryResponse> | null>) {
  const opened = useGetEntry(id);
  const journeyId = opened.data?.journeyId ?? '';
  const timeline = useGetTimelineInfinite(journeyId, { around: id }, {
    query: {
      enabled: !!journeyId,
      initialPageParam: undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      getPreviousPageParam: (first) => first.prevCursor ?? undefined,
    },
  });
  const pages = timeline.data?.pages;
  // Each entry once (pages can overlap when entries arrive while reading). When the story around the entry
  // can't be had, the entry itself is still shown: one card is better than a page that didn't load.
  const entries = rows(timeline.data) ?? (opened.data ? [opened.data] : []);
  // How many entries the story has. Unknown when only the entry itself could be had.
  const total = pages?.[0]?.total;
  const start = Math.max(0, entries.findIndex((entry) => entry.id === id));
  // The card in view is remembered by its entry, not its place in the list: the list grows at both ends.
  const [currentId, setCurrentId] = useState(id);
  const found = entries.findIndex((entry) => entry.id === currentId);
  const index = found >= 0 ? found : start;

  const { hasNextPage, hasPreviousPage, isFetchingNextPage, isFetchingPreviousPage, fetchNextPage, fetchPreviousPage } = timeline;
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const at = Math.round(event.nativeEvent.contentOffset.x / step);
    const next = entries[at];
    if (!next) return;
    if (next.id !== currentId) setCurrentId(next.id);
    if (at <= 1 && hasPreviousPage && !isFetchingPreviousPage) void fetchPreviousPage();
    if (at >= entries.length - 2 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };

  // Earlier entries arriving at the front push every card to the right; move the view by as much, so the
  // card being read stays where it is.
  const firstId = entries[0]?.id;
  const knownFirst = useRef(firstId);
  useLayoutEffect(() => {
    if (knownFirst.current && firstId && knownFirst.current !== firstId) {
      list.current?.scrollToOffset({ offset: index * step, animated: false });
    }
    knownFirst.current = firstId;
  }, [firstId, index, step, list]);

  return {
    entries,
    total,
    /** Where the list opens: the card of the entry that was asked for. */
    start,
    /** The entry whose card is in view. */
    current: entries[index],
    onScroll,
    /** The entry is in, and the story around it is in or has given up. */
    ready: !!opened.data && !(!!journeyId && timeline.isPending && !timeline.isError),
    load: loadState(opened),
  };
}
