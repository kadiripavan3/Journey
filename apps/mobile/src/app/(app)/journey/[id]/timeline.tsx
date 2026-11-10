import type { FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, List as ListIcon, Map as MapIcon, Plus, Star } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCache } from '@/api/cache';
import { messageFor } from '@/api/fetcher';
import { type EntryResponse, useGetJourney, useGetJourneySummary, useGetMe, useGetMembers, useGetTimelineInfinite, useMarkJourneyRead } from '@/api/generated/journey';
import { PostingBanner } from '@/features/drafts/PostingBanner';
import { entryHeadline } from '@/features/entries/labels';
import { ReactionCounts } from '@/features/entries/Reactions';
import { ClipBadge } from '@/features/media/ClipPlayer';
import { formatDay } from '@/lib/dates';
import { firstName } from '@/lib/names';
import { plural } from '@/lib/plural';
import { layout, radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { List } from '@/ui/List';
import { Rise, Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Pill } from '@/ui/Pill';
import { Problem } from '@/ui/Problem';
import { RoundButton } from '@/ui/RoundButton';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { CardSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';

/** What was new when the screen opened. Fixed then, so the markers stay while the person reads. */
type Opened = { since: string | null; newCount: number; firstNew: string | null };

/**
 * 5.2 Story line: the journey in the order things happened, grouped by day, with quiet days and what's new
 * since your last visit. A long story is read a page at a time: it opens at the first new entry (or at the
 * start), loads further pages in both directions as the person scrolls, and "Jump to" can open it anywhere.
 * A shared story can be narrowed to what one person wrote (10.4). The map of its places is one tap away.
 */
export default function Timeline() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
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
  const wrote = (personId: string) => members.data?.members.find((member) => member.person.id === personId)?.entryCount;

  const timeline = useGetTimelineInfinite(id, anchor || who ? { ...(anchor ? { around: anchor } : {}), ...(who ? { author: who } : {}) } : undefined, {
    query: {
      enabled: anchor !== undefined,
      initialPageParam: undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      getPreviousPageParam: (first) => first.prevCursor ?? undefined,
    },
  });
  const entries = timeline.data?.pages.flatMap((page) => page.items);
  const total = timeline.data?.pages[0]?.total ?? 0;

  const myId = me.data?.id;
  const isNew = (entry: EntryResponse) => !!opened?.since && entry.createdAt > opened.since && entry.author.id !== myId;

  const markRead = useMarkJourneyRead({ mutation: { onSuccess: () => cache.journeyRead(id) } });
  const marked = useRef(false);
  // Followers and authors both keep a "read up to here" mark; anyone else has none to move.
  const following = journey.data ? journey.data.viewer.lastReadAt != null : false;
  const loaded = !!entries;
  useEffect(() => {
    if (!marked.current && following && loaded) {
      marked.current = true;
      markRead.mutate({ id });
    }
  }, [loaded, following, id, markRead]);

  const list = useRef<FlashListRef<EntryResponse>>(null);
  const [jumping, setJumping] = useState(false);
  /** Goes to an entry: scrolls there when it is already loaded, otherwise opens the story around it. */
  const jumpTo = (entryId: string | null) => {
    setJumping(false);
    // The places to jump to are in the whole story, so jumping shows everyone's entries again.
    if (who) {
      setWho(null);
      setAnchor(entryId);
      return;
    }
    const index = entryId ? (entries ?? []).findIndex((entry) => entry.id === entryId) : entries?.[0]?.position === 1 ? 0 : -1;
    if (index >= 0) void list.current?.scrollToIndex({ index, animated: true });
    else setAnchor(entryId);
  };

  const j = journey.data;
  const s = summary.data;
  const failed = journey.error ?? summary.error ?? timeline.error;
  const retry = () => void Promise.all([journey.refetch(), summary.refetch(), timeline.refetch()]);
  const startIndex = anchor && entries ? Math.max(entries.findIndex((entry) => entry.id === anchor), 0) : 0;
  /** Shows one person's part of the story, from its start; null shows everyone's again. */
  const pickWho = (username: string | null) => {
    setWho(username);
    setAnchor(null);
  };
  const whoAuthor = who ? j?.authors.find((author) => author.username === who) : undefined;
  const whoName = whoAuthor ? firstName(whoAuthor.displayName) : null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <AppBar title={j?.title ?? ''} subtitle={j ? `${j.authors.length > 1 ? `${j.owner.displayName} and ${plural(j.authors.length - 1, 'friend')}` : j.owner.displayName} · ${plural(j.entryCount, 'entry', 'entries')}` : undefined} trailing={<RoundButton label="Map of this journey" onPress={() => router.push(`/journey/${id}/map`)} icon={(c) => <MapIcon size={19} color={c} />} />} />
        {j && shared ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: layout.barGutter, paddingBottom: 10 }}>
            <Chip tone="filter" label="Everyone" selected={who === null} onPress={() => pickWho(null)} />
            {j.authors.map((author) => (
              <Chip
                key={author.id}
                tone="filter"
                label={firstName(author.displayName)}
                count={wrote(author.id)}
                selected={who === author.username}
                onPress={() => pickWho(author.username)}
                icon={<View style={{ marginLeft: -6, marginVertical: -3 }}><Avatar uri={author.avatarUrl} name={author.displayName} size={22} /></View>}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
      <PostingBanner journeyId={id} />
      {failed ? (
        <Problem message={messageFor(failed)} onRetry={retry} retrying={journey.isRefetching || summary.isRefetching || timeline.isRefetching} />
      ) : !j || !s || !entries ? (
        <CardSkeleton />
      ) : entries.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 }}>
          <Txt variant="body" color="muted" center>
            {whoName ? `${whoName} hasn't added an entry yet.` : j.viewer.isOwner ? 'Your story starts with the first entry.' : 'No entries yet. The first one will show up here.'}
          </Txt>
          {j.viewer.canAddEntry && !who ? <Button label="Add the first entry" onPress={() => router.push(`/journey/${j.id}/add`)} style={{ alignSelf: 'center' }} /> : null}
        </View>
      ) : (
        <List
          // A different opening point is a different list: it starts again at that entry.
          key={`${who ?? 'everyone'}:${anchor ?? 'start'}`}
          listRef={list}
          data={entries}
          keyOf={(entry) => entry.id}
          startAt={startIndex}
          top={16}
          bottom={110 + insets.bottom}
          loadingMore={timeline.isFetchingNextPage}
          onEnd={() => {
            if (timeline.hasNextPage && !timeline.isFetchingNextPage) void timeline.fetchNextPage();
          }}
          onStart={() => {
            if (timeline.hasPreviousPage && !timeline.isFetchingPreviousPage) void timeline.fetchPreviousPage();
          }}
          footer={
            j.status === 'completed' && !timeline.hasNextPage ? (
              <Txt variant="caption" color="muted" weight={700} style={{ marginLeft: layout.barGutter + 34, marginTop: 2 }}>
                Completed{j.completedAt ? ` · ${formatDay(j.completedAt.slice(0, 10))}` : ''}
              </Txt>
            ) : null
          }
          row={(entry, index) => {
            const previous = entries[index - 1];
            const newDay = !previous || previous.number !== entry.number;
            const quiet = previous && j.labelStyle === 'day' ? entry.number - previous.number - 1 : 0;
            const content = (
              <>
                {quiet > 0 ? (
                  <Txt variant="footnote" color="muted" weight={600} style={{ fontStyle: 'italic', marginLeft: 34, marginBottom: 12 }}>
                    {plural(quiet, 'quiet day')}
                  </Txt>
                ) : null}
                {entry.id === opened?.firstNew ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginBottom: 14, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.field, backgroundColor: colors.accent }}>
                    <ArrowDown size={15} color={colors.onAccent} strokeWidth={2.6} />
                    <Txt variant="caption" weight={800} style={{ color: colors.onAccent }}>
                      {opened.newCount} new since your last visit
                    </Txt>
                  </View>
                ) : null}
                {newDay ? <DayMarker entry={entry} /> : null}
                <EntryCard entry={entry} fresh={isNew(entry)} showAuthor={j.authors.length > 1} onPress={() => router.push(`/entry/${entry.id}`)} />
              </>
            );
            return (
              <View style={{ paddingHorizontal: layout.barGutter }}>
                {/* The line the story hangs on. It starts at the first entry's dot. */}
                <View style={{ position: 'absolute', top: entry.position === 1 ? 10 : 0, bottom: 0, left: 27, width: 2, backgroundColor: colors.fill2 }} />
                {index < 6 ? <Rise index={index}>{content}</Rise> : content}
              </View>
            );
          }}
        />
      )}
      {(who ? (j?.entryCount ?? 0) : total) > 3 ? (
        <View style={{ position: 'absolute', left: 16, bottom: Math.max(insets.bottom, 12) + 12 }}>
          <Button label="Jump to" size="lg" variant="ink" icon={(c) => <ListIcon size={19} color={c} />} onPress={() => setJumping(true)} />
        </View>
      ) : null}
      {s?.first ? (
        <Sheet visible={jumping} onClose={() => setJumping(false)} title="Jump to">
          {opened?.firstNew ? (
            <SheetRow
              first
              icon={(c) => <ArrowDown size={22} color={c} />}
              label="Continue where you left off"
              note={`${opened.newCount} new since your last visit`}
              onPress={() => jumpTo(opened.firstNew)}
            />
          ) : null}
          <SheetRow first={!opened?.firstNew} label="Start from the beginning" note={dayLine(s.first)} onPress={() => jumpTo(null)} />
          {s.latest[0] ? <SheetRow label="Newest entry" note={dayLine(s.latest[0])} onPress={() => jumpTo(s.latest[0]!.id)} /> : null}
          {s.milestones.length > 0 ? (
            <Txt variant="label" color="muted" style={{ marginTop: 16, marginBottom: 4, marginHorizontal: layout.gutter }}>
              Milestones
            </Txt>
          ) : null}
          {s.milestones.map((milestone, index) => (
            <SheetRow
              key={milestone.entryId}
              first={index === 0}
              icon={(c) => <Star size={20} color={c} />}
              label={milestone.title || milestone.label}
              note={`${milestone.label} · ${formatDay(milestone.happenedOn)}`}
              onPress={() => jumpTo(milestone.entryId)}
            />
          ))}
        </Sheet>
      ) : null}
      {j?.viewer.canAddEntry && total > 0 ? (
        <View style={{ position: 'absolute', right: 16, bottom: Math.max(insets.bottom, 12) + 12 }}>
          <Button label="Entry" size="lg" icon={(c) => <Plus size={20} color={c} strokeWidth={2.4} />} onPress={() => router.push(`/journey/${j.id}/add`)} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** "Day 12 · Ha Giang loop": where and when an entry is, for a list. */
function dayLine(entry: EntryResponse): string {
  return `${entry.label}${entry.placeName ? ` · ${entry.placeName}` : ''} · ${formatDay(entry.happenedOn)}`;
}

/** The dot on the line where a day starts: "Day 12", its place and date. A milestone gets a star. */
function DayMarker({ entry }: { entry: EntryResponse }) {
  const { colors } = useTheme();
  const detail = `${entry.placeName ? `${entry.placeName} · ` : ''}${formatDay(entry.happenedOn)}`;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`${entry.label}${entry.isMilestone ? ', milestone' : ''}. ${detail}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10, paddingLeft: 34 }}>
      {entry.isMilestone ? (
        <View style={{ position: 'absolute', left: -2, top: -4, width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
          <View style={{ width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
            <Star size={13} color={colors.onAccent} fill={colors.onAccent} />
          </View>
        </View>
      ) : (
        <View style={{ position: 'absolute', left: 4, top: 3, width: 16, height: 16, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.text }} />
      )}
      <Txt variant="subheading">
        {entry.label}
        {entry.isMilestone ? ' · Milestone' : ''}
      </Txt>
      <Txt variant="footnote" numberOfLines={1} color="muted" style={{ flex: 1 }}>
        {detail}
      </Txt>
    </View>
  );
}

function EntryCard({ entry, fresh, showAuthor, onPress }: { entry: EntryResponse; fresh: boolean; showAuthor: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const cover = entry.media[0];
  return (
    <Tap accessibilityRole="button" accessibilityLabel={`${entryHeadline(entry)}${fresh ? '. New' : ''}`} onPress={onPress} scaleTo={0.985} style={{ marginLeft: 34, marginBottom: 14 }}>
      <Card style={{ padding: fresh ? 8 : 10, borderWidth: fresh ? 2 : 0, borderColor: colors.accent }}>
        {showAuthor ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 4, marginBottom: 8, marginTop: 2 }}>
            <Avatar uri={entry.author.avatarUrl} name={entry.author.displayName} size={24} />
            <Txt variant="caption" numberOfLines={1} weight={700} style={{ flex: 1 }}>
              {entry.author.displayName}
            </Txt>
          </View>
        ) : null}
        {cover ? (
          <Photo uri={cover.thumbUrl ?? cover.url} radius="field" style={{ height: 176 }}>
            {entry.media.length > 1 ? <Pill label={`1 / ${entry.media.length}`} style={{ position: 'absolute', top: 10, right: 10 }} /> : null}
            {cover.kind === 'video' ? <ClipBadge seconds={cover.durationSeconds} style={{ position: 'absolute', left: 10, bottom: 10 }} /> : null}
          </Photo>
        ) : null}
        <Txt variant="headline" weight={800} style={{ marginTop: cover ? 8 : 2, marginHorizontal: 4 }}>
          {entryHeadline(entry)}
        </Txt>
        {entry.title && entry.body ? (
          <Txt variant="note" numberOfLines={4} color="muted" style={{ marginTop: 3, marginHorizontal: 4, marginBottom: 2 }}>
            {entry.body}
          </Txt>
        ) : null}
        <View style={{ marginHorizontal: 4, marginBottom: 2 }}>
          <ReactionCounts entry={entry} />
        </View>
      </Card>
    </Tap>
  );
}
