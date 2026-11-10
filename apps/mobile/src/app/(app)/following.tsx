import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type FeedGroupResponse, type JourneyResponse, useGetFeedInfinite, useGetFollowedJourneysInfinite } from '@/api/generated/journey';
import { more, paged, rows } from '@/api/pages';
import { EntryPost } from '@/features/entries/EntryPost';
import { EntryRow } from '@/features/entries/EntryRow';
import { useCatalog } from '@/features/journeys/catalog';
import { CaughtUp } from '@/features/journeys/CaughtUp';
import { JourneyRow } from '@/features/journeys/JourneyRow';
import { PageProblem } from '@/features/states/PageProblem';
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
import { List } from '@/ui/List';
import { Loading } from '@/ui/Loading';
import { Rise, Tap } from '@/ui/Motion';
import { Pill } from '@/ui/Pill';
import { CardSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';

/** 3.2 and 3.3 The Following feed: newest first, grouped per journey, and it ends with "You're all caught up". */
export default function Following() {
  const router = useRouter();
  const { colors } = useTheme();
  const catalog = useCatalog();
  const feed = useGetFeedInfinite(undefined, { query: paged });
  const followed = useGetFollowedJourneysInfinite(undefined, { query: paged });
  const [category, setCategory] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const reload = async () => {
    setPulling(true);
    await Promise.all([feed.refetch(), followed.refetch()]);
    setPulling(false);
  };

  const all = feed.data?.pages.flatMap((page) => page.groups) ?? [];
  const present = catalog.categories.filter((c) => all.some((group) => group.journey.category === c.id));
  const groups = all.filter((group) => !category || group.journey.category === category);
  const count = feed.data?.pages[0]?.followingCount ?? 0;
  const newIds = new Set(all.map((group) => group.journey.id));
  const seen = category ? [] : (rows(followed.data) ?? []).filter((journey) => !newIds.has(journey.id));

  // One list of different kinds of rows: journeys with news, then "all caught up", then the quiet ones.
  const listed: Listed[] = [
    ...groups.map((group, index): Listed => ({ kind: 'group', group, lead: index === 0 })),
    ...(feed.hasNextPage ? [] : [{ kind: 'caughtUp' } as const]),
    ...(seen.length > 0 && !feed.hasNextPage ? [{ kind: 'label' } as const, ...seen.map((journey): Listed => ({ kind: 'journey', journey }))] : []),
  ];
  const pages = feed.hasNextPage ? feed : followed;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="Following" trailing={<View style={{ width: 40 }} />} />
      {!feed.data ? (
        feed.isError ? <PageProblem error={feed.error} onRetry={() => void feed.refetch()} retrying={feed.isFetching} /> : feed.isPaused ? <Loading offline /> : <CardSkeleton />
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
        <List
          data={listed}
          keyOf={(item) => (item.kind === 'group' ? item.group.journey.id : item.kind === 'journey' ? item.journey.id : item.kind)}
          typeOf={(item) => item.kind}
          bottom={60}
          refreshing={pulling}
          onRefresh={() => void reload()}
          loadingMore={pages.isFetchingNextPage}
          {...more(pages)}
          header={
            present.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: layout.barGutter, paddingBottom: 16 }}>
                <Chip tone="filter" label="All" selected={category === null} onPress={() => setCategory(null)} />
                {present.map((c) => (
                  <Chip key={c.id} tone="filter" label={c.label} emoji={c.emoji} selected={c.id === category} onPress={() => setCategory(c.id)} />
                ))}
              </ScrollView>
            ) : null
          }
          row={(item, index) => {
            if (item.kind === 'group') {
              const group = <FeedGroup group={item.group} lead={item.lead} />;
              return index < 6 ? <Rise index={index}>{group}</Rise> : group;
            }
            if (item.kind === 'caughtUp') {
              return (
                <CaughtUp
                  style={{ marginTop: 16, marginBottom: 18 }}
                  line={`That's every new entry from the ${plural(count, 'journey')} you follow.`}
                  action={<Button label="Find more in Discover" variant="line" onPress={() => router.navigate('/discover')} />}
                />
              );
            }
            if (item.kind === 'label') return <GroupLabel style={{ marginHorizontal: layout.rowGutter, marginTop: 8 }}>Nothing new in</GroupLabel>;
            return (
              <JourneyRow
                quiet
                coverUrl={item.journey.coverThumbUrl}
                title={item.journey.title}
                detail={`${item.journey.owner.displayName} · ${item.journey.progressLabel}`}
                onPress={() => router.push(`/journey/${item.journey.id}`)}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

type Listed =
  | { kind: 'group'; group: FeedGroupResponse; lead: boolean }
  | { kind: 'caughtUp' }
  | { kind: 'label' }
  | { kind: 'journey'; journey: JourneyResponse };

/** One journey's new entries: who and what, the newest entry, and a way to the rest. */
function FeedGroup({ group, lead }: { group: FeedGroupResponse; lead: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { journey, newCount, entries } = group;
  const [first, ...rest] = entries;
  const left = newCount - entries.length;
  const openEntry = (id: string) => router.push(`/entry/${id}`);
  const openStory = () => router.push(`/journey/${journey.id}/timeline`);

  return (
    <Card style={{ marginHorizontal: layout.barGutter, marginBottom: 14, borderRadius: radius.panel, overflow: 'hidden' }}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={`${journey.title}, by ${journey.owner.displayName}. ${newCount} new.`}
        scaleTo={0.985}
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
        <Pill tone="accent" label={`${newCount} new`} style={{ alignSelf: 'center' }} />
      </Tap>
      <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 14 }}>
        {first ? lead && first.media.length > 0 ? <EntryPost entry={first} onPress={() => openEntry(first.id)} /> : <EntryRow entry={first} photo={86} onPress={() => openEntry(first.id)} /> : null}
        {rest.map((entry) => (
          <EntryRow key={entry.id} entry={entry} photo={86} onPress={() => openEntry(entry.id)} />
        ))}
        {left > 0 ? (
          <Tap accessibilityRole="button" accessibilityLabel={`${plural(left, 'more entry', 'more entries')}. Open the story.`} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} onPress={openStory} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 2 }}>
            <Txt variant="caption" weight={800} style={{ color: colors.accentText }}>
              {plural(left, 'more entry', 'more entries')}
            </Txt>
            <ChevronRight size={16} color={colors.accentText} />
          </Tap>
        ) : null}
      </View>
    </Card>
  );
}
