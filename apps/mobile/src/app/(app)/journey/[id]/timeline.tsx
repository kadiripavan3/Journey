import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, Plus, Star } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { type EntryResponse, useGetJourney, useGetMe, useGetTimeline, useMarkJourneyRead } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { formatDay } from '@/lib/dates';
import { plural } from '@/lib/plural';
import { useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Card, Loading, Photo, Pill, Problem } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { entryHeadline } from '@/ui/EntryBits';
import { ReactionCounts } from '@/ui/Reactions';
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
  const following = journey.data?.viewer.isFollowing;
  useEffect(() => {
    if (!marked.current && following && entries) {
      marked.current = true;
      markRead.mutate({ id });
    }
  }, [entries, following, id, markRead]);

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
        <Problem error={failed} onRetry={() => void Promise.all([journey.refetch(), timeline.refetch()])} retrying={journey.isRefetching || timeline.isRefetching} />
      ) : !j || !entries ? (
        <Loading />
      ) : entries.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 }}>
          <Txt color="muted" center style={{ fontSize: 15, lineHeight: 22 }}>
            {j.viewer.isOwner ? 'Your story starts with the first entry.' : 'No entries yet. The first one will show up here.'}
          </Txt>
          {j.viewer.canAddEntry ? <Button label="Add the first entry" onPress={() => router.push(`/journey/${j.id}/add` as never)} style={{ alignSelf: 'center' }} /> : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 110 + insets.bottom }} showsVerticalScrollIndicator={false}>
          <View style={{ position: 'absolute', top: 26, bottom: 0, left: 27, width: 2, backgroundColor: colors.fill2 }} />
          {entries.map((entry, index) => {
            const previous = entries[index - 1];
            const newDay = !previous || previous.number !== entry.number;
            const quiet = previous && j.labelStyle === 'day' ? entry.number - previous.number - 1 : 0;
            return (
              <View key={entry.id}>
                {quiet > 0 ? (
                  <Txt color="muted" weight={600} style={{ fontSize: 12.5, lineHeight: 17, fontStyle: 'italic', marginLeft: 34, marginBottom: 12 }}>
                    {plural(quiet, 'quiet day')}
                  </Txt>
                ) : null}
                {entry.id === firstNew ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginBottom: 14, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.accent }}>
                    <ArrowDown size={15} color={colors.onAccent} strokeWidth={2.6} />
                    <Txt weight={800} style={{ fontSize: 13, lineHeight: 17, color: colors.onAccent }}>
                      {newCount} new since your last visit
                    </Txt>
                  </View>
                ) : null}
                {newDay ? <DayMarker entry={entry} /> : null}
                <EntryCard entry={entry} fresh={isNew(entry)} showAuthor={j.authors.length > 1} onPress={() => router.push(`/entry/${entry.id}` as never)} />
              </View>
            );
          })}
          {j.status === 'completed' ? (
            <Txt color="muted" weight={700} style={{ fontSize: 13, lineHeight: 18, marginLeft: 34, marginTop: 2 }}>
              Completed{j.completedAt ? ` · ${formatDay(j.completedAt.slice(0, 10))}` : ''}
            </Txt>
          ) : null}
        </ScrollView>
      )}
      {j?.viewer.canAddEntry && entries && entries.length > 0 ? (
        <View style={{ position: 'absolute', right: 16, bottom: Math.max(insets.bottom, 12) + 12 }}>
          <Button label="Entry" size="lg" icon={(c) => <Plus size={20} color={c} strokeWidth={2.4} />} onPress={() => router.push(`/journey/${j.id}/add` as never)} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** The dot on the line where a day starts: "Day 12", its place and date. A milestone gets a star. */
function DayMarker({ entry }: { entry: EntryResponse }) {
  const { colors } = useTheme();
  const detail = `${entry.placeName ? `${entry.placeName} · ` : ''}${formatDay(entry.happenedOn)}`;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`${entry.label}${entry.isMilestone ? ', milestone' : ''}. ${detail}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10, paddingLeft: 34 }}>
      {entry.isMilestone ? (
        <View style={{ position: 'absolute', left: -2, top: -4, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
            <Star size={13} color={colors.onAccent} fill={colors.onAccent} />
          </View>
        </View>
      ) : (
        <View style={{ position: 'absolute', left: 4, top: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.text }} />
      )}
      <Txt weight={800} style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.35 }}>
        {entry.label}
        {entry.isMilestone ? ' · Milestone' : ''}
      </Txt>
      <Txt numberOfLines={1} color="muted" style={{ flex: 1, fontSize: 12.5, lineHeight: 17 }}>
        {detail}
      </Txt>
    </View>
  );
}

function EntryCard({ entry, fresh, showAuthor, onPress }: { entry: EntryResponse; fresh: boolean; showAuthor: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const cover = entry.media[0];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${entryHeadline(entry)}${fresh ? '. New' : ''}`} onPress={onPress} style={({ pressed }) => ({ marginLeft: 34, marginBottom: 14, opacity: pressed ? 0.88 : 1 })}>
      <Card style={{ padding: fresh ? 8 : 10, borderWidth: fresh ? 2 : 0, borderColor: colors.accent }}>
        {showAuthor ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 4, marginBottom: 8, marginTop: 2 }}>
            <Avatar uri={entry.author.avatarUrl} name={entry.author.displayName} size={24} />
            <Txt numberOfLines={1} weight={700} style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>
              {entry.author.displayName}
            </Txt>
          </View>
        ) : null}
        {cover ? (
          <Photo uri={cover.url} radius={16} style={{ height: 176 }}>
            {entry.media.length > 1 ? <Pill label={`1 / ${entry.media.length}`} style={{ position: 'absolute', top: 10, right: 10 }} /> : null}
          </Photo>
        ) : null}
        <Txt weight={800} style={{ fontSize: 16, lineHeight: 21, letterSpacing: -0.3, marginTop: cover ? 8 : 2, marginHorizontal: 4 }}>
          {entryHeadline(entry)}
        </Txt>
        {entry.title && entry.body ? (
          <Txt numberOfLines={4} color="muted" style={{ fontSize: 13.5, lineHeight: 19.5, marginTop: 3, marginHorizontal: 4, marginBottom: 2 }}>
            {entry.body}
          </Txt>
        ) : null}
        <View style={{ marginHorizontal: 4, marginBottom: 2 }}>
          <ReactionCounts entry={entry} />
        </View>
      </Card>
    </Pressable>
  );
}
