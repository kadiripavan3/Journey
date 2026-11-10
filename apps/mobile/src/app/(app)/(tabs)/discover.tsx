import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetDiscover } from '@/api/generated/journey';
import { useCatalog } from '@/features/journeys/catalog';
import { JourneyCard } from '@/features/journeys/JourneyCard';
import { layout, radius, useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Problem } from '@/ui/Problem';
import { Rail } from '@/ui/Rail';
import { SectionHeader } from '@/ui/SectionHeader';
import { RailSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';

/** 4.1 Discover: search, category chips, then Trending now and Recently completed. */
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
  const nothing = data && data.trending.length === 0 && data.completed.length === 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void reload()} tintColor={colors.muted} />}>
        <Txt variant="heading" accessibilityRole="header" style={{ marginTop: 10, marginHorizontal: layout.rowGutter }}>
          Discover
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search journeys, people and tags"
          onPress={() => router.push('/search')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 50, marginTop: 12, marginHorizontal: 16, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.surface, boxShadow: shadow.sm }}>
          <Search size={18} color={colors.text} />
          <Txt variant="control">
            Search journeys, people, #tags
          </Txt>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: layout.barGutter, paddingTop: 14 }}>
          {catalog.categories.map((c) => (
            <Chip key={c.id} tone="filter" label={c.label} emoji={c.emoji} selected={c.id === category} onPress={() => setCategory(c.id === category ? null : c.id)} />
          ))}
        </ScrollView>

        {discover.isPending ? (
          <>
            <RailSkeleton />
            <RailSkeleton size={158} count={3} />
          </>
        ) : discover.isError ? (
          <Problem message={messageFor(discover.error)} onRetry={() => void discover.refetch()} retrying={discover.isRefetching} />
        ) : nothing ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
            <EmptyState
              emoji={chosen?.emoji ?? '🧭'}
              title={chosen ? `No ${chosen.label.toLowerCase()} journeys yet` : 'Nothing to discover yet'}
              body="Public journeys with a cover and three entries show up here. Yours could be the first."
            />
          </View>
        ) : (
          <>
            {data && data.trending.length > 0 ? (
              <>
                <SectionHeader title="Trending now" />
                <Rail>
                  {data.trending.map((journey, index) => (
                    <JourneyCard key={journey.id} journey={journey} pill={index === 0 ? 'Trending' : undefined} pillEmoji="🔥" onPress={() => router.push(`/journey/${journey.id}`)} />
                  ))}
                </Rail>
              </>
            ) : null}
            {data && data.completed.length > 0 ? (
              <>
                <SectionHeader title="Recently completed" />
                <Rail>
                  {data.completed.map((journey) => (
                    <JourneyCard key={journey.id} journey={journey} size="sm" onPress={() => router.push(`/journey/${journey.id}`)} />
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
