import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCache } from '@/api/cache';
import { type ActivityItemResponse, useGetActivity, useGetDigest, useMarkActivitySeen } from '@/api/generated/journey';
import { useRefetchOnFocus } from '@/api/refetchOnFocus';
import { ActivityLine } from '@/features/activity/ActivityLine';
import { type ActivityGroup, GROUPS, inGroup } from '@/features/activity/kinds';
import { PageProblem } from '@/features/states/PageProblem';
import { layout, radius, useTheme } from '@/theme';
import { Emoji } from '@/ui/Emoji';
import { EmptyState } from '@/ui/EmptyState';
import { GroupLabel } from '@/ui/Heading';
import { Loading } from '@/ui/Loading';
import { Rise, Tap } from '@/ui/Motion';
import { ListSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';
import { WordTabs } from '@/ui/WordTabs';
import { words } from '@/words';

/** 8.1 Activity: one calm inbox. New entries are grouped per journey and likes are batched into a single line. */
export default function Activity() {
  const { colors } = useTheme();
  const activity = useGetActivity();
  const { mutate: seen } = useMarkActivitySeen();
  const week = useGetDigest().data;
  const router = useRouter();
  const cache = useCache();
  const { refetch } = activity;
  useRefetchOnFocus(refetch);
  const [filter, setFilter] = useState<ActivityGroup>('all');
  const [pulling, setPulling] = useState(false);
  // What was new when the tab was opened stays highlighted while it is on screen.
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const items = activity.data?.items;
  // The ids of the new lines, as one piece of text: the same lines give the same text, so the tab reacts
  // when new ones arrive and not every time the list is drawn.
  const newIds = (items ?? []).filter((item) => item.isNew).map((item) => item.id).join(',');
  useFocusEffect(
    useCallback(() => {
      if (!newIds) return;
      setFresh((now) => new Set([...now, ...newIds.split(',')]));
      seen(undefined, { onSuccess: () => void cache.activitySeen() });
    }, [newIds, seen, cache]),
  );
  // Leaving the tab forgets them: next time only what is new then is marked.
  useFocusEffect(useCallback(() => () => setFresh(new Set()), []));

  const shown = (items ?? []).filter((item) => inGroup(item, filter));
  const isFresh = (item: ActivityItemResponse) => item.isNew || fresh.has(item.id);
  const recent = shown.filter(isFresh);
  const earlier = shown.filter((item) => !isFresh(item));
  const reload = async () => {
    setPulling(true);
    await refetch();
    setPulling(false);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Txt variant="heading" accessibilityRole="header" style={{ marginTop: 10, marginHorizontal: layout.rowGutter }}>
        {words.common.tabs.activity}
      </Txt>
      <WordTabs tabs={GROUPS} value={filter} onChange={setFilter} style={{ marginTop: 6 }} />

      {!activity.data ? (
        activity.isError ? <PageProblem error={activity.error} onRetry={() => void refetch()} retrying={activity.isFetching} /> : activity.isPaused ? <Loading offline /> : <ListSkeleton />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 130, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void reload()} tintColor={colors.muted} />}>
          {week && week.entryCount > 0 && filter === 'all' ? (
            <Tap
              accessibilityRole="button"
              accessibilityLabel={words.activity.week.spoken(week.entryCount, week.journeys.length)}
              scaleTo={0.985}
              onPress={() => router.push('/digest')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, marginHorizontal: layout.barGutter, padding: 14, borderRadius: radius.card, backgroundColor: colors.fill }}>
              <Emoji char="🗞️" size={34} />
              <View style={{ flex: 1 }}>
                <Txt variant="item" weight={800}>
                  {words.activity.week.title}
                </Txt>
                <Txt variant="caption" weight={500} color="muted">
                  {words.activity.week.count(week.entryCount, week.journeys.length)}
                </Txt>
              </View>
            </Tap>
          ) : null}
          {shown.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
              <EmptyState
                emoji="🔔"
                title={filter === 'all' ? words.activity.none.all : words.activity.none.underTab}
                body={words.activity.none.body}
              />
            </View>
          ) : (
            <>
              {recent.length > 0 ? <GroupLabel style={{ marginHorizontal: layout.gutter }}>{words.activity.groups.fresh}</GroupLabel> : null}
              {recent.map((item, index) => (
                <Rise key={item.id} index={index}>
                  <ActivityLine item={item} fresh />
                </Rise>
              ))}
              {earlier.length > 0 ? <GroupLabel style={{ marginHorizontal: layout.gutter }}>{recent.length > 0 ? words.activity.groups.earlier : words.activity.groups.thisMonth}</GroupLabel> : null}
              {earlier.map((item, index) => (
                <Rise key={item.id} index={index}>
                  <ActivityLine item={item} />
                </Rise>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
