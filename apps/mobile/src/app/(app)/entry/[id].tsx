import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ellipsis, Flag, Pencil, Send, Trash2, X } from 'lucide-react-native';
import { useLayoutEffect, useRef, useState } from 'react';
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useCache } from '@/api/cache';
import { type EntryResponse, useDeleteEntry, useGetEntry, useGetTimelineInfinite } from '@/api/generated/journey';
import { CommentsSheet } from '@/features/entries/CommentsSheet';
import { entryEyebrow } from '@/features/entries/labels';
import { MilestonePill } from '@/features/entries/MilestonePill';
import { Reactions } from '@/features/entries/Reactions';
import { PhotoViewer } from '@/features/media/PhotoViewer';
import { ReportSheet } from '@/features/safety/SafetySheets';
import { formatDay } from '@/lib/dates';
import { firstName } from '@/lib/names';
import { darkTheme, layout, radius, useTheme, withAlpha } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Eyebrow } from '@/ui/Eyebrow';
import { Frost } from '@/ui/Frost';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
import { RoundButton } from '@/ui/RoundButton';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

const GAP = 14;
const SIDE = 22;
const STAGE = darkTheme.colors.stage;
const REPLY_BAR = 66;

/**
 * 6.1 Entry: each entry is a card you swipe through like a story, with the next one peeking in. Milestones get a badge.
 * The story is loaded a page at a time around the entry that was opened; swiping towards either end brings the next page.
 */
export default function EntryView() {
  const { id, comments: openComments } = useLocalSearchParams<{ id: string; comments?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Coming from Activity, a comment's line opens the entry with its comments showing.
  const [commenting, setCommenting] = useState(openComments === '1');
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
  const entries = pages ? pages.flatMap((page) => page.items) : opened.data ? [opened.data] : [];
  const total = pages?.[0]?.total ?? entries.length;
  const start = Math.max(0, entries.findIndex((entry) => entry.id === id));
  // The card in view is remembered by its entry, not its place in the list: the list grows at both ends.
  const [currentId, setCurrentId] = useState(id);
  const found = entries.findIndex((entry) => entry.id === currentId);
  const index = found >= 0 ? found : start;
  const current = entries[index];
  const [menu, setMenu] = useState(false);
  const list = useRef<FlatList<EntryResponse>>(null);

  const cardWidth = Math.min(width - SIDE * 2 - 20, 460);
  const step = cardWidth + GAP;
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
  }, [firstId, index, step]);

  // What is left for a card under the top bar and above the bottom edge.
  const room = height - insets.top - 8 - 42 - 14 - Math.max(insets.bottom, 12) - 14 - REPLY_BAR;
  const failed = opened.error ?? timeline.error;
  const backdrop = current?.media[0]?.thumbUrl ?? current?.media[0]?.url;

  return (
    <View style={{ flex: 1, backgroundColor: STAGE }}>
      <StatusBar style="light" />
      {backdrop ? <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} accessible={false} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(darkTheme.colors.black, 0.52) }]} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: insets.top + 8, paddingHorizontal: layout.rowGutter }}>
        <View style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.photo, overflow: 'hidden', backgroundColor: darkTheme.colors.photoGlass, borderWidth: 1, borderColor: darkTheme.colors.photoGlassLine }}>
          <Frost tone="dark" />
          <Txt variant="caption" accessibilityLiveRegion="polite" weight={700} style={{ color: darkTheme.colors.onPhoto }}>
            {current ? `Entry ${current.position} of ${total}` : ' '}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {current ? <RoundButton tone="photo" label="Entry options" onPress={() => setMenu(true)} icon={(c) => <Ellipsis size={20} color={c} />} /> : null}
          <RoundButton tone="photo" label="Close" onPress={() => router.back()} icon={(c) => <X size={20} color={c} />} />
        </View>
      </View>

      {failed ? (
        <Problem message={messageFor(failed)} onRetry={() => void opened.refetch()} retrying={opened.isRefetching} />
      ) : !opened.data || (journeyId && timeline.isPending) ? (
        <Loading />
      ) : (
        <FlatList
          ref={list}
          data={entries}
          keyExtractor={(entry) => entry.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          initialScrollIndex={start}
          getItemLayout={(_, i) => ({ length: step, offset: step * i, index: i })}
          onScroll={onScroll}
          scrollEventThrottle={32}
          contentContainerStyle={{ paddingHorizontal: SIDE, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 12) + 14 + REPLY_BAR }}
          renderItem={({ item }) => (
            <View style={{ width: cardWidth, marginRight: GAP }}>
              <EntryCard entry={item} maxHeight={room} onComments={() => setCommenting(true)} />
            </View>
          )}
        />
      )}

      {current && !failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comment on this entry by ${current.author.displayName}`}
          onPress={() => setCommenting(true)}
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: Math.max(insets.bottom, 12) + 8,
            height: 54,
            paddingLeft: 20,
            paddingRight: 8,
            borderRadius: radius.pill,
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: darkTheme.colors.photoGlass,
            borderWidth: 1,
            borderColor: darkTheme.colors.photoGlassLine,
          }}>
          <Frost tone="dark" />
          <Txt variant="callout" numberOfLines={1} style={{ flex: 1, color: darkTheme.colors.onPhoto }}>
            Say something nice to {firstName(current.author.displayName)}…
          </Txt>
          <View style={{ width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: darkTheme.colors.accent }}>
            <Send size={18} color={darkTheme.colors.onAccent} />
          </View>
        </Pressable>
      ) : null}

      {current ? <CommentsSheet entry={current} visible={commenting} onClose={() => setCommenting(false)} /> : null}
      {current ? <EntryMenu entry={current} visible={menu} onClose={() => setMenu(false)} /> : null}
    </View>
  );
}

function EntryCard({ entry, maxHeight, onComments }: { entry: EntryResponse; maxHeight: number; onComments: () => void }) {
  const router = useRouter();
  const { colors, shadow } = useTheme();
  const [viewing, setViewing] = useState<number | null>(null);
  const shown = entry.media[0];
  const many = entry.media.length > 1;
  return (
    <View style={{ maxHeight, borderRadius: radius.stage, overflow: 'hidden', backgroundColor: colors.surface, boxShadow: shadow.stage }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {shown ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={many ? `${entry.media.length} photos. Open them full screen.` : 'Open the photo full screen'}
            onPress={() => setViewing(0)}
            style={{ height: 268, backgroundColor: colors.fill }}>
            <Image source={{ uri: shown.url }} style={{ flex: 1 }} contentFit="cover" transition={120} />
            {entry.isMilestone ? <MilestonePill style={{ position: 'absolute', top: 12, left: 12 }} /> : null}
            {many ? (
              <View style={{ position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
                {entry.media.map((m, i) => (
                  <View key={m.id} style={{ width: 6, height: 6, borderRadius: radius.pill, backgroundColor: darkTheme.colors.onPhoto, opacity: i === 0 ? 1 : 0.5 }} />
                ))}
              </View>
            ) : null}
          </Pressable>
        ) : null}
        <View style={{ paddingTop: 18, paddingHorizontal: layout.rowGutter, paddingBottom: 20 }}>
          {!shown && entry.isMilestone ? <MilestonePill style={{ marginBottom: 10 }} /> : null}
          <Eyebrow>{entryEyebrow(entry)}</Eyebrow>
          {entry.title ? (
            <Txt variant="title" accessibilityRole="header" style={{ marginTop: 6 }}>
              {entry.title}
            </Txt>
          ) : null}
          {entry.body ? (
            <Txt variant={entry.title ? 'bodySmall' : 'bodyLarge'} color={entry.title ? 'muted' : 'text'} style={{ marginTop: 8 }}>
              {entry.body}
            </Txt>
          ) : null}
          <Reactions entry={entry} onComments={onComments} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${entry.author.displayName}'s profile`}
            onPress={() => router.push(`/profile/${entry.author.username}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <Avatar uri={entry.author.avatarUrl} name={entry.author.displayName} size={28} />
            <Txt variant="footnote" numberOfLines={1} color="muted" style={{ flex: 1 }}>
              {entry.author.displayName} · {formatDay(entry.happenedOn)}
              {entry.edited ? ' · Edited' : ''}
            </Txt>
          </Pressable>
        </View>
      </ScrollView>
      <PhotoViewer photos={entry.media} startAt={viewing} onClose={() => setViewing(null)} eyebrow={entryEyebrow(entry)} title={entry.title || undefined} />
    </View>
  );
}

/** What you can do with your own entry: change it or delete it (after confirming). */
function EntryMenu({ entry, visible, onClose }: { entry: EntryResponse; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const cache = useCache();
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const close = () => {
    setConfirming(false);
    onClose();
  };
  const remove = useDeleteEntry({
    mutation: {
      onSuccess: async () => {
        close();
        router.back();
        await cache.entrySaved(entry.journeyId, entry.id);
      },
    },
  });
  if (!entry.viewer.canDelete) {
    return (
      <>
        <Sheet visible={visible} onClose={close}>
          <SheetRow
            first
            icon={(c) => <Flag size={22} color={c} />}
            label="Report this entry"
            onPress={() => {
              close();
              setReporting(true);
            }}
          />
        </Sheet>
        <ReportSheet target={reporting ? { type: 'entry', id: entry.id, word: 'entry' } : null} onClose={() => setReporting(false)} />
      </>
    );
  }
  return (
    <Sheet visible={visible} onClose={close} title={confirming ? 'Delete this entry?' : undefined} subtitle={confirming ? "It will be gone for good, for you and everyone following." : undefined}>
      {remove.isError ? (
        <Txt variant="caption" color="danger" style={{ paddingHorizontal: layout.gutter, paddingBottom: 8 }}>
          {messageFor(remove.error)}
        </Txt>
      ) : null}
      {confirming ? (
        <View style={{ gap: 10, paddingHorizontal: layout.rowGutter, paddingTop: 6 }}>
          <Button label="Delete entry" variant="danger" size="lg" block loading={remove.isPending} onPress={() => remove.mutate({ id: entry.id })} />
          <Button label="Keep it" variant="soft" size="lg" block onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <>
          {entry.viewer.canEdit ? (
            <SheetRow
              first
              icon={(c) => <Pencil size={22} color={c} />}
              label="Edit entry"
              onPress={() => {
                close();
                router.push(`/journey/${entry.journeyId}/add?entry=${entry.id}`);
              }}
            />
          ) : null}
          <SheetRow first={!entry.viewer.canEdit} danger icon={(c) => <Trash2 size={22} color={c} />} label="Delete entry" onPress={() => setConfirming(true)} />
        </>
      )}
    </Sheet>
  );
}
