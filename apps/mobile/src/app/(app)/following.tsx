import { useRouter } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { type FeedGroupResponse, useGetFeed, useGetFollowedJourneys } from '@/api/generated/journey';
import { EntryPost } from '@/features/entries/EntryPost';
import { EntryRow } from '@/features/entries/EntryRow';
import { useCatalog } from '@/features/journeys/catalog';
import { JourneyRow } from '@/features/journeys/JourneyRow';
import { timeAgo } from '@/lib/dates';
import { plural } from '@/lib/plural';
import { layout, radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { GroupLabel } from '@/ui/Heading';
import { Rise } from '@/ui/Motion';
import { Problem } from '@/ui/Problem';
import { CardSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';

/** 3.2 and 3.3 The Following feed: newest first, grouped per journey, and it ends with "You're all caught up". */
export default function Following() {
  const router = useRouter();
  const { colors } = useTheme();
  const catalog = useCatalog();
  const feed = useGetFeed();
  const followed = useGetFollowedJourneys();
  const [category, setCategory] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const reload = async () => {
    setPulling(true);
    await Promise.all([feed.refetch(), followed.refetch()]);
    setPulling(false);
  };

  const all = feed.data?.groups ?? [];
  const present = catalog.categories.filter((c) => all.some((group) => group.journey.category === c.id));
  const groups = all.filter((group) => !category || group.journey.category === category);
  const count = feed.data?.followingCount ?? 0;
  const newIds = new Set(all.map((group) => group.journey.id));
  const seen = (followed.data ?? []).filter((journey) => !newIds.has(journey.id));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="Following" trailing={<View style={{ width: 40 }} />} />
      {feed.isPending ? (
        <CardSkeleton />
      ) : feed.isError ? (
        <Problem message={messageFor(feed.error)} onRetry={() => void feed.refetch()} retrying={feed.isRefetching} />
      ) : count === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 60 }}>
          <EmptyState
            emoji="🧭"
            title="You don't follow any journeys yet"
            body="Follow a journey and its new entries land here, newest first."
            action={<Button label="Explore journeys" onPress={() => router.navigate('/discover')} />}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void reload()} tintColor={colors.muted} />}>
          {present.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: layout.barGutter, paddingBottom: 16 }}>
              <Chip tone="filter" label="All" selected={category === null} onPress={() => setCategory(null)} />
              {present.map((c) => (
                <Chip key={c.id} tone="filter" label={c.label} emoji={c.emoji} selected={c.id === category} onPress={() => setCategory(c.id)} />
              ))}
            </ScrollView>
          ) : null}

          {groups.map((group, index) => (
            <Rise key={group.journey.id} index={index}>
              <FeedGroup group={group} lead={index === 0} />
            </Rise>
          ))}

          <View style={{ alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 18, marginHorizontal: 30 }}>
            <View style={{ width: 54, height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill }}>
              <Check size={26} color={colors.ok} strokeWidth={2.6} />
            </View>
            <Txt variant="subtitle" accessibilityRole="header" center style={{ marginTop: 4 }}>
              You&apos;re all caught up
            </Txt>
            <Txt variant="callout" color="muted" center>
              That&apos;s every new entry from the {plural(count, 'journey')} you follow.
            </Txt>
            <Button label="Find more in Discover" variant="line" onPress={() => router.navigate('/discover')} style={{ alignSelf: 'center', marginTop: 8 }} />
          </View>

          {seen.length > 0 && !category ? (
            <>
              <GroupLabel style={{ marginHorizontal: layout.rowGutter, marginTop: 8 }}>Nothing new in</GroupLabel>
              {seen.map((journey) => (
                <JourneyRow
                  key={journey.id}
                  faded
                  coverUrl={journey.coverUrl}
                  title={journey.title}
                  detail={`${journey.owner.displayName} · ${journey.progressLabel}`}
                  onPress={() => router.push(`/journey/${journey.id}`)}
                />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** One journey's new entries: who and what, the newest entry, and a way to the rest. */
function FeedGroup({ group, lead }: { group: FeedGroupResponse; lead: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { journey, newCount, entries } = group;
  const [first, ...rest] = entries;
  const more = newCount - entries.length;
  const openEntry = (id: string) => router.push(`/entry/${id}`);
  const openStory = () => router.push(`/journey/${journey.id}/timeline`);

  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 14, borderRadius: radius.panel, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${journey.title}, by ${journey.owner.displayName}. ${newCount} new.`}
        onPress={openStory}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 }}>
        <Avatar uri={journey.owner.avatarUrl} name={journey.owner.displayName} size={38} />
        <View style={{ flex: 1 }}>
          <Txt variant="control" numberOfLines={1} weight={800}>
            {journey.title}
          </Txt>
          <Txt variant="footnote" numberOfLines={1} color="muted">
            {journey.owner.displayName}
            {journey.lastEntryAt ? ` · ${timeAgo(journey.lastEntryAt)}` : ''}
          </Txt>
        </View>
        <View style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.tile, backgroundColor: colors.accent }}>
          <Txt variant="small" weight={800} style={{ color: colors.onAccent }}>
            {newCount} new
          </Txt>
        </View>
      </Pressable>
      <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 14 }}>
        {first ? lead && first.media.length > 0 ? <EntryPost entry={first} onPress={() => openEntry(first.id)} /> : <EntryRow entry={first} photo={86} onPress={() => openEntry(first.id)} /> : null}
        {rest.map((entry) => (
          <EntryRow key={entry.id} entry={entry} photo={86} onPress={() => openEntry(entry.id)} />
        ))}
        {more > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${plural(more, 'more entry', 'more entries')}. Open the story.`} onPress={openStory} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 2 }}>
            <Txt variant="caption" weight={800} style={{ color: colors.accentText }}>
              {plural(more, 'more entry', 'more entries')}
            </Txt>
            <ChevronRight size={16} color={colors.accentText} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}
