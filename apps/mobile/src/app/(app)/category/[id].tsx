import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type JourneyResponse, useGetDiscover } from '@/api/generated/journey';
import { useCatalog } from '@/features/journeys/catalog';
import { JourneyCard } from '@/features/journeys/JourneyCard';
import { useLeave } from '@/features/navigation/useLeave';
import { PageProblem } from '@/features/states/PageProblem';
import { audienceLabel } from '@/lib/following';
import { loadState } from '@/lib/loading';
import { layout, radius, useTheme } from '@/theme';
import { Emoji } from '@/ui/Emoji';
import { EmptyState } from '@/ui/EmptyState';
import { Loading } from '@/ui/Loading';
import { Rail } from '@/ui/Rail';
import { RoundButton } from '@/ui/RoundButton';
import { SectionHeader } from '@/ui/SectionHeader';
import { RailSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';

/**
 * 4.4 Category: one category's journeys on a page of their own. A friendly header, then the journeys that are
 * going on (each showing how far along it is) and the ones recently completed.
 */
export default function Category() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const leave = useLeave();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const catalog = useCatalog();
  const category = catalog.category(id);
  const discover = useGetDiscover({ category: id });
  const load = loadState(discover);
  const data = discover.data;

  // Going on now: what is trending first, then what is new, each journey once.
  const seen = new Set<string>();
  const going = [...(data?.trending ?? []), ...(data?.fresh ?? [])].filter((journey) => (seen.has(journey.id) ? false : !!seen.add(journey.id)));
  const completed = data?.completed ?? [];
  const open = (journey: JourneyResponse) => router.push(`/journey/${journey.id}`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: insets.top + 60, paddingBottom: 22, paddingHorizontal: layout.gutter, gap: 6, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, backgroundColor: colors.accentSoft }}>
          {category ? <Emoji char={category.emoji} size={52} /> : null}
          <Txt variant="heading" accessibilityRole="header">
            {category?.label ?? 'Journeys'}
          </Txt>
          <Txt variant="callout" color="muted">
            Journeys that are going on now, and the ones that were just completed.
          </Txt>
        </View>

        {load.error ? (
          <PageProblem error={load.error} onRetry={load.retry} retrying={load.retrying} />
        ) : !data ? (
          load.offline ? <Loading offline /> : <RailSkeleton />
        ) : going.length === 0 && completed.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 40 }}>
            <EmptyState emoji={category?.emoji ?? '🧭'} title={category ? `No ${category.label.toLowerCase()} journeys yet` : 'Nothing here yet'} body="Public journeys with a cover and three entries show up here. Yours could be the first." />
          </View>
        ) : (
          <>
            {going.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, marginHorizontal: 10 }}>
                {going.map((journey) => (
                  <View key={journey.id} style={{ width: '50%', paddingHorizontal: 6, marginBottom: 16 }}>
                    <JourneyCard
                      journey={journey}
                      size="grid"
                      progress={journey.targetDays ? Math.min(journey.latestNumber / journey.targetDays, 1) : undefined}
                      detail={`${journey.targetDays ? `${journey.progressLabel} of ${journey.targetDays}` : journey.progressLabel}${journey.followerCount > 0 ? ` · ${audienceLabel(journey)}` : ''}`}
                      onPress={() => open(journey)}
                    />
                  </View>
                ))}
              </View>
            ) : null}
            {completed.length > 0 ? (
              <>
                <SectionHeader title="Recently completed" />
                <Rail>
                  {completed.map((journey) => (
                    <JourneyCard key={journey.id} journey={journey} size="sm" onPress={() => open(journey)} />
                  ))}
                </Rail>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={{ position: 'absolute', top: insets.top + 8, left: layout.barGutter }}>
        <RoundButton label="Back" onPress={leave} icon={(c) => <ArrowLeft size={20} color={c} />} />
      </View>
    </View>
  );
}
