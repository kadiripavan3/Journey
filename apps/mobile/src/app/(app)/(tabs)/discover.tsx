import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetDiscover } from '@/api/generated/journey';
import { useCatalog } from '@/features/journeys/catalog';
import { JourneyCard } from '@/features/journeys/JourneyCard';
import { layout, radius, useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Loading } from '@/ui/Loading';
import { Tap } from '@/ui/Motion';
import { Problem } from '@/ui/Problem';
import { Rail } from '@/ui/Rail';
import { SectionHeader } from '@/ui/SectionHeader';
import { RailSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

/** 4.1 Discover: search, category chips, then Trending now, New journeys and Recently completed. */
export default function Discover() {
  const router = useRouter();
  const { colors, shadow } = useTheme();
  const catalog = useCatalog();
  const [category, setCategory] = useState<string | null>(null);
  const discover = useGetDiscover(category ? { category } : undefined);
  const [pulling, setPulling] = useState(false);
  const reload = async () => {
    setPulling(true);
    await discover.refetch();
    setPulling(false);
  };

  const data = discover.data;
  const chosen = catalog.category(category);
  const fresh = data?.fresh ?? [];
  const nothing = !!data && data.trending.length === 0 && fresh.length === 0 && data.completed.length === 0;
  const open = (id: string) => router.push(`/journey/${id}`);
  // With a category chosen, a rail's title leads to that category's own page.
  const seeAll = category ? () => router.push(`/category/${category}`) : undefined;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void reload()} tintColor={colors.muted} />}>
        <Txt variant="heading" accessibilityRole="header" style={{ marginTop: 10, marginHorizontal: layout.rowGutter }}>
          {words.discover.title}
        </Txt>
        <Tap
          accessibilityRole="button"
          accessibilityLabel={words.discover.search.spoken}
          scaleTo={0.985}
          onPress={() => router.push('/search')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, marginTop: 12, marginHorizontal: layout.barGutter, paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, boxShadow: shadow.sm }}>
          <Search size={18} color={colors.text} />
          <Txt variant="control">
            {words.discover.search.hint}
          </Txt>
        </Tap>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: layout.barGutter, paddingTop: 14 }}>
          {catalog.categories.map((c) => (
            <Chip key={c.id} tone="filter" label={c.label} emoji={c.emoji} selected={c.id === category} onPress={() => setCategory(c.id === category ? null : c.id)} />
          ))}
        </ScrollView>

        {!data ? (
          discover.isError ? (
            <Problem message={messageFor(discover.error)} onRetry={() => void discover.refetch()} retrying={discover.isFetching} />
          ) : discover.isPaused ? (
            <Loading offline />
          ) : (
            <>
              <RailSkeleton />
              <RailSkeleton size={158} count={3} />
            </>
          )
        ) : nothing ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
            <EmptyState
              emoji={chosen?.emoji ?? '🧭'}
              title={chosen ? words.discover.none.inCategory(chosen.label) : words.discover.none.all}
              body={words.discover.none.body}
            />
          </View>
        ) : (
          <>
            {data.trending.length > 0 ? (
              <>
                <SectionHeader title={words.discover.trending} onPress={seeAll} />
                <Rail>
                  {data.trending.map((journey, index) => (
                    <JourneyCard key={journey.id} journey={journey} pill={index === 0 ? words.discover.trendingPill : undefined} pillEmoji="🔥" onPress={() => open(journey.id)} />
                  ))}
                </Rail>
              </>
            ) : null}
            {fresh.length > 0 ? (
              <>
                <SectionHeader title={words.discover.fresh} onPress={seeAll} />
                <Rail>
                  {fresh.map((journey) => (
                    <JourneyCard key={journey.id} journey={journey} size="sm" onPress={() => open(journey.id)} />
                  ))}
                </Rail>
              </>
            ) : null}
            {data.completed.length > 0 ? (
              <>
                <SectionHeader title={words.discover.completed} onPress={seeAll} />
                <Rail>
                  {data.completed.map((journey) => (
                    <JourneyCard key={journey.id} journey={journey} size="sm" onPress={() => open(journey.id)} />
                  ))}
                </Rail>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
