import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, List, Plus, Star } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { type EntryResponse, useGetJourney, useGetMe, useGetTimeline, useMarkJourneyRead } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { entryHeadline } from '@/features/entries/labels';
import { ReactionCounts } from '@/features/entries/Reactions';
import { formatDay } from '@/lib/dates';
import { plural } from '@/lib/plural';
import { layout, radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Rise, Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Pill } from '@/ui/Pill';
import { Problem } from '@/ui/Problem';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { CardSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';

/** 5.2 Story line: the journey in the order things happened, grouped by day, with quiet days and what's new since your last visit. */
export default function Timeline() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const refresh = useRefreshAll();
  const me = useGetMe();
  const journey = useGetJourney(id);
  const timeline = useGetTimeline(id);

  // "New since your last visit" is fixed when the screen opens, so the markers stay while you read.
  const [since, setSince] = useState<string | null | undefined>(undefined);
  if (since === undefined && journey.data) setSince(journey.data.viewer.lastReadAt);
  const myId = me.data?.id;
  const isNew = (entry: EntryResponse) => !!since && entry.createdAt > since && entry.author.id !== myId;

  const markRead = useMarkJourneyRead({ mutation: { onSuccess: () => refresh() } });
  const marked = useRef(false);
  const entries = timeline.data;
  // Followers and authors both keep a "read up to here" mark; anyone else has none to move.
  const following = journey.data ? journey.data.viewer.lastReadAt != null : false;
  useEffect(() => {
    if (!marked.current && following && entries) {
      marked.current = true;
      markRead.mutate({ id });
    }
  }, [entries, following, id, markRead]);

  // Where each entry sits on the page, so "Jump to" can scroll straight to it.
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef(new Map<string, number>());
  const [jumping, setJumping] = useState(false);
  const jumpTo = (entryId: string) => {
    setJumping(false);
    scroller.current?.scrollTo({ y: Math.max((positions.current.get(entryId) ?? 0) - 8, 0), animated: true });
  };

  const j = journey.data;
  const failed = journey.error ?? timeline.error;
  const newCount = (entries ?? []).filter(isNew).length;
  const firstNew = (entries ?? []).find(isNew)?.id;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <AppBar title={j?.title ?? ''} subtitle={j ? `${j.authors.length > 1 ? `${j.owner.displayName} and ${plural(j.authors.length - 1, 'friend')}` : j.owner.displayName} · ${plural(j.entryCount, 'entry', 'entries')}` : undefined} trailing={<View style={{ width: 40 }} />} />
      </View>
      {failed ? (
        <Problem message={messageFor(failed)} onRetry={() => void Promise.all([journey.refetch(), timeline.refetch()])} retrying={journey.isRefetching || timeline.isRefetching} />
      ) : !j || !entries ? (
        <CardSkeleton />
      ) : entries.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 }}>
          <Txt variant="body" color="muted" center>
            {j.viewer.isOwner ? 'Your story starts with the first entry.' : 'No entries yet. The first one will show up here.'}
          </Txt>
          {j.viewer.canAddEntry ? <Button label="Add the first entry" onPress={() => router.push(`/journey/${j.id}/add`)} style={{ alignSelf: 'center' }} /> : null}
        </View>
      ) : (
        <ScrollView ref={scroller} contentContainerStyle={{ paddingTop: 16, paddingHorizontal: layout.barGutter, paddingBottom: 110 + insets.bottom }} showsVerticalScrollIndicator={false}>
          <View style={{ position: 'absolute', top: 26, bottom: 0, left: 27, width: 2, backgroundColor: colors.fill2 }} />
          {entries.map((entry, index) => {
            const previous = entries[index - 1];
            const newDay = !previous || previous.number !== entry.number;
            const quiet = previous && j.labelStyle === 'day' ? entry.number - previous.number - 1 : 0;
            return (
              <Rise key={entry.id} index={index} onLayout={(event) => positions.current.set(entry.id, event.nativeEvent.layout.y)}>
                {quiet > 0 ? (
                  <Txt variant="footnote" color="muted" weight={600} style={{ fontStyle: 'italic', marginLeft: 34, marginBottom: 12 }}>
                    {plural(quiet, 'quiet day')}
                  </Txt>
                ) : null}
                {entry.id === firstNew ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginBottom: 14, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.field, backgroundColor: colors.accent }}>
                    <ArrowDown size={15} color={colors.onAccent} strokeWidth={2.6} />
                    <Txt variant="caption" weight={800} style={{ color: colors.onAccent }}>
                      {newCount} new since your last visit
                    </Txt>
                  </View>
                ) : null}
                {newDay ? <DayMarker entry={entry} /> : null}
                <EntryCard entry={entry} fresh={isNew(entry)} showAuthor={j.authors.length > 1} onPress={() => router.push(`/entry/${entry.id}`)} />
              </Rise>
            );
          })}
          {j.status === 'completed' ? (
            <Txt variant="caption" color="muted" weight={700} style={{ marginLeft: 34, marginTop: 2 }}>
              Completed{j.completedAt ? ` · ${formatDay(j.completedAt.slice(0, 10))}` : ''}
            </Txt>
          ) : null}
        </ScrollView>
      )}
      {entries && entries.length > 3 ? (
        <View style={{ position: 'absolute', left: 16, bottom: Math.max(insets.bottom, 12) + 12 }}>
          <Button label="Jump to" size="lg" variant="ink" icon={(c) => <List size={19} color={c} />} onPress={() => setJumping(true)} />
        </View>
      ) : null}
      {entries && entries.length > 0 ? (
        <Sheet visible={jumping} onClose={() => setJumping(false)} title="Jump to">
          {firstNew ? (
            <SheetRow
              first
              icon={(c) => <ArrowDown size={22} color={c} />}
              label="Continue where you left off"
              note={`${newCount} new since your last visit`}
              onPress={() => jumpTo(firstNew)}
            />
          ) : null}
          <SheetRow first={!firstNew} label="Start from the beginning" note={dayLine(entries[0]!)} onPress={() => jumpTo(entries[0]!.id)} />
          <SheetRow label="Newest entry" note={dayLine(entries[entries.length - 1]!)} onPress={() => jumpTo(entries[entries.length - 1]!.id)} />
          {entries.some((entry) => entry.isMilestone) ? (
            <Txt variant="label" color="muted" style={{ marginTop: 16, marginBottom: 4, marginHorizontal: layout.gutter }}>
              Milestones
            </Txt>
          ) : null}
          {entries
            .filter((entry) => entry.isMilestone)
            .map((entry, index) => (
              <SheetRow key={entry.id} first={index === 0} icon={(c) => <Star size={20} color={c} />} label={entryHeadline(entry)} note={dayLine(entry)} onPress={() => jumpTo(entry.id)} />
            ))}
        </Sheet>
      ) : null}
      {j?.viewer.canAddEntry && entries && entries.length > 0 ? (
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
          <Photo uri={cover.url} radius="field" style={{ height: 176 }}>
            {entry.media.length > 1 ? <Pill label={`1 / ${entry.media.length}`} style={{ position: 'absolute', top: 10, right: 10 }} /> : null}
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
