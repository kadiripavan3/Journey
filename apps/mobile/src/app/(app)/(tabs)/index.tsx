import { useRouter } from 'expo-router';
import { Check, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetDiscover, useGetFeed } from '@/api/generated/journey';
import { useRefetchOnFocus } from '@/api/refetchOnFocus';
import { useCatalog } from '@/features/journeys/catalog';
import { CategoryTabs } from '@/features/journeys/CategoryTabs';
import { JourneyCard } from '@/features/journeys/JourneyCard';
import { useMyJourneys } from '@/features/journeys/useMyJourneys';
import { timeAgo } from '@/lib/dates';
import { followersLabel, plural } from '@/lib/plural';
import { layout, radius, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Problem } from '@/ui/Problem';
import { Rail } from '@/ui/Rail';
import { Ring } from '@/ui/Ring';
import { SectionHeader } from '@/ui/SectionHeader';
import { RailSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';

const FOR_YOU = 'for-you';

/** 3.1 Home: your own journey first, then what's new from the journeys you follow, then what's trending. */
export default function Home() {
  const router = useRouter();
  const { colors, shadow } = useTheme();
  const catalog = useCatalog();
  const [tab, setTab] = useState(FOR_YOU);
  const category = tab === FOR_YOU ? undefined : tab;

  const feed = useGetFeed();
  const mine = useMyJourneys();
  const discover = useGetDiscover(category ? { category } : undefined);
  useRefetchOnFocus(feed.refetch, mine.refetch);
  const [pulling, setPulling] = useState(false);
  const reload = async () => {
    setPulling(true);
    await Promise.all([feed.refetch(), mine.refetch(), discover.refetch()]);
    setPulling(false);
  };

  const tabs = [{ id: FOR_YOU, label: 'For you', emoji: '🧭' }, ...catalog.categories.slice(0, 4)];
  const current = mine.journeys.find((journey) => journey.status === 'active');
  const groups = (feed.data?.groups ?? []).filter((group) => !category || group.journey.category === category);
  const following = feed.data?.followingCount ?? 0;
  const trending = (discover.data?.trending ?? []).filter((journey) => !journey.viewer.isOwner);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void reload()} tintColor={colors.muted} />}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find a journey"
          onPress={() => router.push('/search')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            height: 62,
            marginTop: 10,
            marginHorizontal: 16,
            paddingHorizontal: 22,
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            boxShadow: shadow.sm,
          }}>
          <Search size={20} color={colors.text} />
          <View style={{ flex: 1 }}>
            <Txt variant="item">
              Find a journey
            </Txt>
            <Txt variant="footnote" color="muted">
              Trips, challenges and more, live now
            </Txt>
          </View>
        </Pressable>

        <CategoryTabs tabs={tabs} value={tab} onChange={setTab} />

        {current && tab === FOR_YOU ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${current.title}. ${current.progressLabel}. Add an entry.`} onPress={() => router.push(`/journey/${current.id}/add`)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18, marginHorizontal: layout.barGutter, paddingVertical: 16, paddingLeft: 18, paddingRight: 16 }}>
              <View style={{ flex: 1 }}>
                <Txt variant="headline" numberOfLines={2}>
                  {current.entryCount === 0 ? `Start ${current.title}` : `${current.progressLabel} · ${current.title}`}
                </Txt>
                <Txt variant="caption" weight={500} numberOfLines={1} color="muted" style={{ marginTop: 4 }}>
                  {current.lastEntryAt ? `Last entry ${timeAgo(current.lastEntryAt)}` : 'Add your first entry'}
                  {current.followerCount > 0 ? ` · ${followersLabel(current.followerCount)}` : ''}
                </Txt>
              </View>
              <Ring progress={current.targetDays ? current.latestNumber / current.targetDays : 0} emoji={catalog.template(current.template)?.emoji ?? '🧭'} />
            </Card>
          </Pressable>
        ) : null}

        {feed.isPending ? (
          <>
            <RailSkeleton />
            <RailSkeleton size={158} count={3} />
          </>
        ) : feed.isError ? (
          <View style={{ height: 300 }}>
            <Problem message={messageFor(feed.error)} onRetry={() => void feed.refetch()} retrying={feed.isRefetching} />
          </View>
        ) : groups.length > 0 ? (
          <>
            <SectionHeader title="New from journeys you follow" onPress={() => router.push('/following')} />
            <Rail>
              {groups.map(({ journey, newCount, entries }) => (
                <JourneyCard
                  key={journey.id}
                  journey={journey}
                  pill={`${newCount} new`}
                  detail={entries[0] ? `${entries[0].label}${entries[0].placeName ? ` · ${entries[0].placeName}` : ''}` : journey.progressLabel}
                  footnote={`${journey.owner.displayName}${journey.lastEntryAt ? ` · ${timeAgo(journey.lastEntryAt)}` : ''}`}
                  onPress={() => router.push(`/journey/${journey.id}/timeline`)}
                />
              ))}
            </Rail>
          </>
        ) : following === 0 ? (
          <View style={{ marginTop: 30, marginBottom: 4 }}>
            <EmptyState
              emoji="🧭"
              title="Your Home is quiet"
              body="Follow a journey and its new entries land here, newest first."
              action={<Button label="Explore journeys" onPress={() => router.navigate('/discover')} />}
            />
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 6, marginTop: 28, marginHorizontal: 30 }}>
            <View style={{ width: 54, height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill }}>
              <Check size={26} color={colors.ok} strokeWidth={2.6} />
            </View>
            <Txt variant="subtitle" accessibilityRole="header" center style={{ marginTop: 4 }}>
              You&apos;re all caught up
            </Txt>
            <Txt variant="callout" color="muted" center>
              {category ? 'Nothing new here from the journeys you follow.' : `That's every new entry from the ${plural(following, 'journey')} you follow.`}
            </Txt>
            <Button label="See what you follow" variant="line" onPress={() => router.push('/following')} style={{ alignSelf: 'center', marginTop: 8 }} />
          </View>
        )}

        {trending.length > 0 ? (
          <>
            <SectionHeader title="Trending this week" onPress={() => router.navigate('/discover')} />
            <Rail>
              {trending.map((journey) => (
                <JourneyCard key={journey.id} journey={journey} size="sm" detail={`${journey.progressLabel} · ${followersLabel(journey.followerCount)}`} onPress={() => router.push(`/journey/${journey.id}`)} />
              ))}
            </Rail>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
