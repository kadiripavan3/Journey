import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetDiscover } from '@/api/generated/journey';
import { useCatalog } from '@/journey/catalog';
import { useTheme } from '@/theme';
import { Loading, Problem, Rail, SectionHeader } from '@/ui/Bits';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { JourneyCard } from '@/ui/JourneyCard';
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
        <Txt accessibilityRole="header" weight={800} style={{ fontSize: 31, lineHeight: 36, letterSpacing: -1.2, marginTop: 10, marginHorizontal: 20 }}>
          Discover
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search journeys, people and tags"
          onPress={() => router.push('/search' as never)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 50, marginTop: 12, marginHorizontal: 16, paddingHorizontal: 18, borderRadius: 25, backgroundColor: colors.surface, boxShadow: shadow.sm }}>
          <Search size={18} color={colors.text} />
          <Txt weight={700} style={{ fontSize: 14.5, lineHeight: 20 }}>
            Search journeys, people, #tags
          </Txt>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 14 }}>
          {catalog.categories.map((c) => (
            <Chip key={c.id} tone="filter" label={c.label} emoji={c.emoji} selected={c.id === category} onPress={() => setCategory(c.id === category ? null : c.id)} />
          ))}
        </ScrollView>

        {discover.isPending ? (
          <Loading />
        ) : discover.isError ? (
          <Problem error={discover.error} onRetry={() => void discover.refetch()} retrying={discover.isRefetching} />
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
                    <JourneyCard key={journey.id} journey={journey} pill={index === 0 ? '🔥 Trending' : undefined} onPress={() => router.push(`/journey/${journey.id}` as never)} />
                  ))}
                </Rail>
              </>
            ) : null}
            {data && data.completed.length > 0 ? (
              <>
                <SectionHeader title="Recently completed" />
                <Rail>
                  {data.completed.map((journey) => (
                    <JourneyCard key={journey.id} journey={journey} size="sm" onPress={() => router.push(`/journey/${journey.id}` as never)} />
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
