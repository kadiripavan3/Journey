import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetDiscover, useGetFeed } from '@/api/generated/journey';
import { useRefetchOnFocus } from '@/api/refetchOnFocus';
import { entryEyebrow } from '@/features/entries/labels';
import { useCatalog } from '@/features/journeys/catalog';
import { CaughtUp } from '@/features/journeys/CaughtUp';
import { JourneyCard } from '@/features/journeys/JourneyCard';
import { useMyJourneys } from '@/features/journeys/useMyJourneys';
import { timeAgo } from '@/lib/dates';
import { followersLabel } from '@/lib/following';
import { layout, radius, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmojiTabs } from '@/ui/EmojiTabs';
import { EmptyState } from '@/ui/EmptyState';
import { Loading } from '@/ui/Loading';
import { Tap } from '@/ui/Motion';
import { Problem } from '@/ui/Problem';
import { Rail } from '@/ui/Rail';
import { Ring } from '@/ui/Ring';
import { SectionHeader } from '@/ui/SectionHeader';
import { RailSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

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

  const tabs = [{ id: FOR_YOU, label: words.home.forYou, emoji: '🧭' }, ...catalog.categories.slice(0, 4)];
  const current = mine.journeys.find((journey) => journey.status === 'active');
  const groups = (feed.data?.groups ?? []).filter((group) => !category || group.journey.category === category);
  const following = feed.data?.followingCount ?? 0;
  const trending = (discover.data?.trending ?? []).filter((journey) => !journey.viewer.isOwner);
  // A challenge asks for a check-in a day; everything else just takes an entry.
  const challenge = !!current?.targetDays;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void reload()} tintColor={colors.muted} />}>
        <Tap
          accessibilityRole="button"
          accessibilityLabel={words.home.search.title}
          scaleTo={0.985}
          onPress={() => router.push('/search')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            minHeight: 62,
            marginTop: 10,
            marginHorizontal: layout.barGutter,
            paddingHorizontal: layout.gutter,
            paddingVertical: 10,
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            boxShadow: shadow.sm,
          }}>
          <Search size={20} color={colors.text} />
          <View style={{ flex: 1 }}>
            <Txt variant="item">
              {words.home.search.title}
            </Txt>
            <Txt variant="footnote" color="muted">
              {words.home.search.hint}
            </Txt>
          </View>
        </Tap>

        <EmojiTabs tabs={tabs} value={tab} onChange={setTab} />

        {current && tab === FOR_YOU ? (
          <Tap
            accessibilityRole="button"
            accessibilityLabel={words.home.current.spoken(current.title, current.progressLabel, challenge)}
            scaleTo={0.985}
            onPress={() => router.push(`/journey/${current.id}/add`)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18, marginHorizontal: layout.barGutter, paddingVertical: 16, paddingLeft: 18, paddingRight: 16 }}>
              <View style={{ flex: 1 }}>
                <Txt variant="headline" numberOfLines={2}>
                  {current.entryCount === 0 ? words.home.current.start(current.title) : words.common.join([current.progressLabel, current.title])}
                </Txt>
                <Txt variant="caption" weight={500} numberOfLines={1} color="muted" style={{ marginTop: 4 }}>
                  {words.common.join([
                    current.lastEntryAt ? words.home.current.last(challenge, timeAgo(current.lastEntryAt)) : words.home.current.first(challenge),
                    current.followerCount > 0 ? (challenge ? words.journeys.cheeringYouOn(current.followerCount) : followersLabel(current.followerCount)) : null,
                  ])}
                </Txt>
              </View>
              <Ring progress={current.targetDays ? current.latestNumber / current.targetDays : 0} emoji={catalog.template(current.template)?.emoji ?? '🧭'} />
            </Card>
          </Tap>
        ) : null}

        {!feed.data ? (
          feed.isError ? (
            <View style={{ height: 300 }}>
              <Problem message={messageFor(feed.error)} onRetry={() => void feed.refetch()} retrying={feed.isFetching} />
            </View>
          ) : feed.isPaused ? (
            <View style={{ height: 300 }}>
              <Loading offline />
            </View>
          ) : (
            <>
              <RailSkeleton />
              <RailSkeleton size={158} count={3} />
            </>
          )
        ) : groups.length > 0 ? (
          <>
            <SectionHeader title={words.home.newFromFollowed} onPress={() => router.push('/following')} />
            <Rail>
              {groups.map(({ journey, newCount, entries }) => (
                <JourneyCard
                  key={journey.id}
                  journey={journey}
                  pill={words.journeys.newCount(newCount)}
                  detail={entries[0] ? entryEyebrow(entries[0]) : journey.progressLabel}
                  footnote={words.common.join([journey.owner.displayName, journey.lastEntryAt ? timeAgo(journey.lastEntryAt) : null])}
                  onPress={() => router.push(`/journey/${journey.id}/timeline`)}
                />
              ))}
            </Rail>
          </>
        ) : following === 0 ? (
          <View style={{ marginTop: 30, marginBottom: 4 }}>
            <EmptyState
              emoji="🧭"
              title={words.home.quiet.title}
              body={words.home.quiet.body}
              action={<Button label={words.home.quiet.explore} onPress={() => router.navigate('/discover')} />}
            />
          </View>
        ) : (
          <CaughtUp
            style={{ marginTop: 28 }}
            line={category ? words.home.caughtUp.inCategory : words.home.caughtUp.all(following)}
            action={<Button label={words.home.caughtUp.seeFollowed} variant="line" onPress={() => router.push('/following')} />}
          />
        )}

        {trending.length > 0 ? (
          <>
            <SectionHeader title={words.home.trending} onPress={() => router.navigate('/discover')} />
            <Rail>
              {trending.map((journey) => (
                <JourneyCard key={journey.id} journey={journey} size="sm" detail={words.common.join([journey.progressLabel, followersLabel(journey.followerCount)])} onPress={() => router.push(`/journey/${journey.id}`)} />
              ))}
            </Rail>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
