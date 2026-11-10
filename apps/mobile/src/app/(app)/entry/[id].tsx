import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ellipsis, Flag, Pencil, Send, Trash2, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { type EntryResponse, useDeleteEntry, useGetEntry, useGetTimeline } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { formatDay } from '@/lib/dates';
import { darkTheme, useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Eyebrow, Loading, Problem } from '@/ui/Bits';
import { Frost } from '@/ui/Frost';
import { Button } from '@/ui/Button';
import { CommentsSheet } from '@/ui/CommentsSheet';
import { entryEyebrow, MilestonePill } from '@/ui/EntryBits';
import { Reactions } from '@/ui/Reactions';
import { RoundButton } from '@/ui/RoundButton';
import { ReportSheet } from '@/ui/SafetySheets';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

const GAP = 14;
const SIDE = 22;
const STAGE = '#08080A';
const REPLY_BAR = 66;

/** 6.1 Entry: each entry is a card you swipe through like a story, with the next one peeking in. Milestones get a badge. */
export default function EntryView() {
  const { id, comments: openComments } = useLocalSearchParams<{ id: string; comments?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Coming from Activity, a comment's line opens the entry with its comments showing.
  const [commenting, setCommenting] = useState(openComments === '1');
  const opened = useGetEntry(id);
  const journeyId = opened.data?.journeyId ?? '';
  const timeline = useGetTimeline(journeyId, { query: { enabled: !!journeyId } });
  const entries = timeline.data ?? (opened.data ? [opened.data] : []);
  const start = Math.max(0, entries.findIndex((entry) => entry.id === id));
  const [position, setPosition] = useState<number | null>(null);
  const index = Math.min(position ?? start, Math.max(entries.length - 1, 0));
  const current = entries[index];
  const [menu, setMenu] = useState(false);
  const list = useRef<FlatList<EntryResponse>>(null);

  const cardWidth = Math.min(width - SIDE * 2 - 20, 460);
  const step = cardWidth + GAP;
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / step);
    if (next !== index && next >= 0 && next < entries.length) setPosition(next);
  };

  // What is left for a card under the top bar and above the bottom edge.
  const room = height - insets.top - 8 - 42 - 14 - Math.max(insets.bottom, 12) - 14 - REPLY_BAR;
  const failed = opened.error ?? timeline.error;
  const backdrop = current?.media[0]?.url;

  return (
    <View style={{ flex: 1, backgroundColor: STAGE }}>
      <StatusBar style="light" />
      {backdrop ? <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} accessible={false} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.52)' }]} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: insets.top + 8, paddingHorizontal: 20 }}>
        <View style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: darkTheme.colors.photoGlass, borderWidth: 1, borderColor: darkTheme.colors.photoGlassLine }}>
          <Frost tone="dark" />
          <Txt accessibilityLiveRegion="polite" weight={700} style={{ fontSize: 13, lineHeight: 17, color: darkTheme.colors.onPhoto }}>
            {current ? `Entry ${index + 1} of ${entries.length}` : ' '}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {current ? <RoundButton tone="photo" label="Entry options" onPress={() => setMenu(true)} icon={(c) => <Ellipsis size={20} color={c} />} /> : null}
          <RoundButton tone="photo" label="Close" onPress={() => router.back()} icon={(c) => <X size={20} color={c} />} />
        </View>
      </View>

      {failed ? (
        <Problem error={failed} onRetry={() => void opened.refetch()} retrying={opened.isRefetching} />
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
            borderRadius: 27,
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: darkTheme.colors.photoGlass,
            borderWidth: 1,
            borderColor: darkTheme.colors.photoGlassLine,
          }}>
          <Frost tone="dark" />
          <Txt numberOfLines={1} style={{ flex: 1, fontSize: 14, lineHeight: 19, color: darkTheme.colors.onPhoto }}>
            Say something nice to {current.author.displayName.trim().split(/\s+/)[0]}…
          </Txt>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: darkTheme.colors.accent }}>
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
  const { colors } = useTheme();
  const [photo, setPhoto] = useState(0);
  const shown = entry.media[Math.min(photo, entry.media.length - 1)];
  const many = entry.media.length > 1;
  return (
    <View style={{ maxHeight, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.surface, boxShadow: '0 30px 60px -20px rgba(0, 0, 0, 0.6)' }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {shown ? (
          <Pressable
            accessibilityRole={many ? 'button' : 'image'}
            accessibilityLabel={many ? `Photo ${photo + 1} of ${entry.media.length}. Tap for the next one.` : 'Photo'}
            disabled={!many}
            onPress={() => setPhoto((now) => (now + 1) % entry.media.length)}
            style={{ height: 268, backgroundColor: colors.fill }}>
            <Image source={{ uri: shown.url }} style={{ flex: 1 }} contentFit="cover" transition={120} />
            {entry.isMilestone ? <MilestonePill style={{ position: 'absolute', top: 12, left: 12 }} /> : null}
            {many ? (
              <View style={{ position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
                {entry.media.map((m, i) => (
                  <View key={m.id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: darkTheme.colors.onPhoto, opacity: i === photo ? 1 : 0.5 }} />
                ))}
              </View>
            ) : null}
          </Pressable>
        ) : null}
        <View style={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20 }}>
          {!shown && entry.isMilestone ? <MilestonePill style={{ marginBottom: 10 }} /> : null}
          <Eyebrow>{entryEyebrow(entry)}</Eyebrow>
          {entry.title ? (
            <Txt accessibilityRole="header" weight={800} style={{ fontSize: 23, lineHeight: 26, letterSpacing: -0.7, marginTop: 6 }}>
              {entry.title}
            </Txt>
          ) : null}
          {entry.body ? (
            <Txt color={entry.title ? 'muted' : 'text'} style={{ fontSize: entry.title ? 14.5 : 16, lineHeight: entry.title ? 22 : 24, marginTop: 8 }}>
              {entry.body}
            </Txt>
          ) : null}
          <Reactions entry={entry} onComments={onComments} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${entry.author.displayName}'s profile`}
            onPress={() => router.push(`/profile/${entry.author.username}` as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <Avatar uri={entry.author.avatarUrl} name={entry.author.displayName} size={28} />
            <Txt numberOfLines={1} color="muted" style={{ flex: 1, fontSize: 12.5, lineHeight: 17 }}>
              {entry.author.displayName} · {formatDay(entry.happenedOn)}
              {entry.edited ? ' · Edited' : ''}
            </Txt>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/** What you can do with your own entry: change it or delete it (after confirming). */
function EntryMenu({ entry, visible, onClose }: { entry: EntryResponse; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const refresh = useRefreshAll();
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
        await refresh();
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
        <Txt variant="caption" color="danger" style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
          {messageFor(remove.error)}
        </Txt>
      ) : null}
      {confirming ? (
        <View style={{ gap: 10, paddingHorizontal: 20, paddingTop: 6 }}>
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
                router.push(`/journey/${entry.journeyId}/add?entry=${entry.id}` as never);
              }}
            />
          ) : null}
          <SheetRow first={!entry.viewer.canEdit} danger icon={(c) => <Trash2 size={22} color={c} />} label="Delete entry" onPress={() => setConfirming(true)} />
        </>
      )}
    </Sheet>
  );
}
