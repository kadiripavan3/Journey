import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ellipsis, MapPin, Send, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EntryResponse } from '@/api/generated/journey';
import { CommentsSheet } from '@/features/entries/CommentsSheet';
import { EntryMenu } from '@/features/entries/EntryMenu';
import { entryEyebrow } from '@/features/entries/labels';
import { MilestonePill } from '@/features/entries/MilestonePill';
import { Reactions } from '@/features/entries/Reactions';
import { useEntryPager } from '@/features/entries/useEntryPager';
import { ClipBadge } from '@/features/media/ClipPlayer';
import { PhotoViewer } from '@/features/media/PhotoViewer';
import { useLeave } from '@/features/navigation/useLeave';
import { HeldNote, HeldVeil } from '@/features/safety/Held';
import { EntryShareSheet } from '@/features/sharing/ShareSheet';
import { PageProblem } from '@/features/states/PageProblem';
import { formatDay } from '@/lib/dates';
import { firstName } from '@/lib/names';
import { darkTheme, layout, radius, useTheme, withAlpha } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Eyebrow } from '@/ui/Eyebrow';
import { Frost } from '@/ui/Frost';
import { LightStatusBar } from '@/ui/LightStatusBar';
import { Loading } from '@/ui/Loading';
import { Tap } from '@/ui/Motion';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';

const GAP = 14;
const SIDE = 22;
const STAGE = darkTheme.colors.stage;
const REPLY_BAR = 66;

/**
 * 6.1 Entry: each entry is a card you swipe through like a story, with the next one peeking in. Milestones get a badge.
 * The story is loaded a page at a time around the entry that was opened; swiping towards either end brings the next page.
 * It is an ordinary screen on the dark stage, so the screens it opens (a profile, the map) open on top of it;
 * it keeps clear of the notch and the home bar by itself.
 */
export default function EntryView() {
  const { id, comments: openComments } = useLocalSearchParams<{ id: string; comments?: string }>();
  const leave = useLeave();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Coming from Activity, a comment's line opens the entry with its comments showing.
  const [commenting, setCommenting] = useState(openComments === '1');
  const [menu, setMenu] = useState(false);
  const [sharing, setSharing] = useState(false);

  const cardWidth = Math.min(width - SIDE * 2 - 20, 460);
  const step = cardWidth + GAP;
  const list = useRef<FlatList<EntryResponse>>(null);
  const pager = useEntryPager(id, step, list);
  const { current, load } = pager;

  // What is left for a card under the top bar and above the bottom edge.
  const room = height - insets.top - 8 - 42 - 14 - Math.max(insets.bottom, 12) - 14 - REPLY_BAR;
  const backdrop = current?.media[0]?.thumbUrl ?? current?.media[0]?.url;

  return (
    <View style={{ flex: 1, backgroundColor: STAGE }}>
      <LightStatusBar />
      {backdrop ? <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} accessible={false} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(darkTheme.colors.black, 0.52) }]} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: insets.top + 8, paddingHorizontal: layout.rowGutter }}>
        <View style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.photo, overflow: 'hidden', backgroundColor: darkTheme.colors.photoGlass, borderWidth: 1, borderColor: darkTheme.colors.photoGlassLine }}>
          <Frost tone="dark" />
          <Txt variant="caption" accessibilityLiveRegion="polite" weight={700} style={{ color: darkTheme.colors.onPhoto }}>
            {current ? (pager.total ? `Entry ${current.position} of ${pager.total}` : `Entry ${current.position}`) : ' '}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {current ? <RoundButton tone="photo" label="Entry options" onPress={() => setMenu(true)} icon={(c) => <Ellipsis size={20} color={c} />} /> : null}
          <RoundButton tone="photo" label="Close" onPress={leave} icon={(c) => <X size={20} color={c} />} />
        </View>
      </View>

      {load.error ? (
        <View style={{ flex: 1, paddingBottom: Math.max(insets.bottom, 12) }}>
          <PageProblem tone="onPhoto" error={load.error} onRetry={load.retry} retrying={load.retrying} />
        </View>
      ) : !pager.ready ? (
        <Loading tone="onPhoto" offline={load.offline} />
      ) : (
        <FlatList
          ref={list}
          data={pager.entries}
          keyExtractor={(entry) => entry.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          initialScrollIndex={pager.start}
          getItemLayout={(_, i) => ({ length: step, offset: step * i, index: i })}
          // Only the card in view and its neighbours exist: each holds a full-size photo.
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          onScroll={pager.onScroll}
          scrollEventThrottle={32}
          contentContainerStyle={{ paddingHorizontal: SIDE, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 12) + 14 + REPLY_BAR }}
          renderItem={({ item }) => (
            <View style={{ width: cardWidth, marginRight: GAP }}>
              <EntryCard entry={item} maxHeight={room} onComments={() => setCommenting(true)} />
            </View>
          )}
        />
      )}

      {current && !load.error ? (
        <Tap
          accessibilityRole="button"
          accessibilityLabel={`Comment on this entry by ${current.author.displayName}`}
          scaleTo={0.985}
          onPress={() => setCommenting(true)}
          style={{
            position: 'absolute',
            left: layout.rowGutter,
            right: layout.rowGutter,
            bottom: Math.max(insets.bottom, 12) + 8,
            minHeight: 54,
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
        </Tap>
      ) : null}

      {current ? <CommentsSheet entry={current} visible={commenting} onClose={() => setCommenting(false)} /> : null}
      {current ? <EntryMenu entry={current} visible={menu} onClose={() => setMenu(false)} onShare={() => setSharing(true)} onDeleted={leave} /> : null}
      {current ? <EntryShareSheet entry={current} visible={sharing} onClose={() => setSharing(false)} /> : null}
    </View>
  );
}

function EntryCard({ entry, maxHeight, onComments }: { entry: EntryResponse; maxHeight: number; onComments: () => void }) {
  const router = useRouter();
  const { colors, shadow } = useTheme();
  const [viewing, setViewing] = useState<number | null>(null);
  const shown = entry.media[0];
  const many = entry.media.length > 1;
  const onMap = entry.lat != null && entry.lng != null;
  return (
    <View style={{ maxHeight, borderRadius: radius.stage, overflow: 'hidden', backgroundColor: colors.surface, boxShadow: shadow.stage }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {shown ? (
          <Tap
            accessibilityRole="button"
            accessibilityLabel={shown.kind === 'video' ? (many ? `A clip and ${entry.media.length - 1} more. Open them full screen.` : 'Open the clip full screen') : many ? `${entry.media.length} photos. Open them full screen.` : 'Open the photo full screen'}
            disabled={shown.held}
            scaleTo={0.99}
            onPress={() => setViewing(0)}
            style={{ height: 268, backgroundColor: colors.fill }}>
            {/* The small version is there at once (the list it was opened from has it); the full one fades in over it. */}
            <Image source={{ uri: shown.url }} placeholder={shown.thumbUrl ? { uri: shown.thumbUrl } : undefined} placeholderContentFit="cover" recyclingKey={shown.id} style={{ flex: 1 }} contentFit="cover" transition={120} />
            {shown.held ? <HeldVeil /> : null}
            {entry.isMilestone ? <MilestonePill style={{ position: 'absolute', top: 12, left: 12 }} /> : null}
            {shown.kind === 'video' ? <ClipBadge seconds={shown.durationSeconds} style={{ position: 'absolute', left: 12, bottom: 12 }} /> : null}
            {many ? (
              <View style={{ position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
                {entry.media.map((m, i) => (
                  <View key={m.id} style={{ width: 6, height: 6, borderRadius: radius.pill, backgroundColor: darkTheme.colors.onPhoto, opacity: i === 0 ? 1 : 0.5 }} />
                ))}
              </View>
            ) : null}
          </Tap>
        ) : null}
        <View style={{ paddingTop: 18, paddingHorizontal: layout.rowGutter, paddingBottom: 20 }}>
          {!shown && entry.isMilestone ? <MilestonePill style={{ marginBottom: 10 }} /> : null}
          {onMap ? (
            // A place with a spot on the map leads to the journey's map.
            <Tap accessibilityRole="button" accessibilityLabel={`${entryEyebrow(entry)}. Show it on the map`} hitSlop={{ top: 14, bottom: 14 }} onPress={() => router.push(`/journey/${entry.journeyId}/map?entry=${entry.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}>
              <Eyebrow>{entryEyebrow(entry)}</Eyebrow>
              <MapPin size={13} color={colors.accentText} />
            </Tap>
          ) : (
            <Eyebrow>{entryEyebrow(entry)}</Eyebrow>
          )}
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
          <HeldNote entry={entry} />
          <Reactions entry={entry} onComments={onComments} />
          <Tap
            accessibilityRole="button"
            accessibilityLabel={`${entry.author.displayName}'s profile`}
            hitSlop={{ top: 8, bottom: 8 }}
            scaleTo={0.985}
            onPress={() => router.push(`/profile/${entry.author.username}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <Avatar uri={entry.author.avatarUrl} name={entry.author.displayName} size={28} />
            <Txt variant="footnote" numberOfLines={1} color="muted" style={{ flex: 1 }}>
              {entry.author.displayName} · {formatDay(entry.happenedOn)}
              {entry.edited ? ' · Edited' : ''}
            </Txt>
          </Tap>
        </View>
      </ScrollView>
      <PhotoViewer photos={entry.media.filter((m) => !m.held)} startAt={viewing} onClose={() => setViewing(null)} eyebrow={entryEyebrow(entry)} title={entry.title || undefined} />
    </View>
  );
}
