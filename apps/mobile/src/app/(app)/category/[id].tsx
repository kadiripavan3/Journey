import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
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
import { Chip } from '@/ui/Chip';
import { Emoji } from '@/ui/Emoji';
import { EmptyState } from '@/ui/EmptyState';
import { Loading } from '@/ui/Loading';
import { Rail } from '@/ui/Rail';
import { RoundButton } from '@/ui/RoundButton';
import { SectionHeader } from '@/ui/SectionHeader';
import { RailSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

/** The address of the page of challenges, which is not a category: journeys with a number of days to reach. */
const CHALLENGES = 'challenges';

/** The lengths of challenge offered as quick filters. */
const LENGTHS = [30, 100];

/**
 * 4.4 Category: one category's journeys on a page of their own, or every challenge. A friendly header that
 * says how many there are, quick filters, then the journeys that are going on (each showing how far along it
 * is) and the ones recently completed.
 */
export default function Category() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const leave = useLeave();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const catalog = useCatalog();
  const everyChallenge = id === CHALLENGES;
  const category = everyChallenge ? undefined : catalog.category(id);
  // The quick filters: a length of challenge, and on the page of challenges also what they are about.
  const [days, setDays] = useState<number | null>(null);
  const [about, setAbout] = useState<string | null>(null);
  const [onlyChallenges, setOnlyChallenges] = useState(false);
  const discover = useGetDiscover({
    category: everyChallenge ? (about ?? undefined) : id,
    challenges: everyChallenge || onlyChallenges || days !== null ? true : undefined,
    days: days ?? undefined,
  });
  const narrowed = days !== null || about !== null || onlyChallenges;
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
          {everyChallenge ? <Emoji char="🔥" size={52} /> : category ? <Emoji char={category.emoji} size={52} /> : null}
          <Txt variant="heading" accessibilityRole="header">
            {everyChallenge ? words.discover.challenges.title : (category?.label ?? words.discover.category.title)}
          </Txt>
          <Txt variant="callout" color="muted">
            {data?.counts ? words.discover.category.counts(data.counts.inProgress, data.counts.finishedThisMonth) : words.discover.category.lead}
          </Txt>
        </View>

        {/* A row that scrolls sideways inside a page that scrolls down: it keeps its own height. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: layout.barGutter, paddingTop: 16 }}>
          {everyChallenge ? null : <Chip tone="filter" emoji="🔥" label={words.discover.challenges.title} selected={onlyChallenges} onPress={() => setOnlyChallenges(!onlyChallenges)} />}
          {LENGTHS.map((length) => (
            <Chip key={length} tone="filter" label={words.discover.challenges.days(length)} selected={days === length} onPress={() => setDays(days === length ? null : length)} />
          ))}
          {everyChallenge
            ? catalog.categories.map((topic) => (
                <Chip key={topic.id} tone="filter" emoji={topic.emoji} label={topic.label} selected={about === topic.id} onPress={() => setAbout(about === topic.id ? null : topic.id)} />
              ))
            : null}
        </ScrollView>

        {load.error ? (
          <PageProblem error={load.error} onRetry={load.retry} retrying={load.retrying} />
        ) : !data ? (
          load.offline ? <Loading offline /> : <RailSkeleton />
        ) : going.length === 0 && completed.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 40 }}>
            <EmptyState
              emoji={everyChallenge ? '🔥' : (category?.emoji ?? '🧭')}
              title={narrowed || everyChallenge ? words.discover.challenges.none : category ? words.discover.none.inCategory(category.label) : words.discover.category.none}
              body={words.discover.none.body}
            />
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
                      detail={words.common.join([journey.progressLabel, journey.followerCount > 0 ? audienceLabel(journey) : null])}
                      onPress={() => open(journey)}
                    />
                  </View>
                ))}
              </View>
            ) : null}
            {completed.length > 0 ? (
              <>
                <SectionHeader title={words.discover.completed} />
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
        <RoundButton label={words.common.back} onPress={leave} icon={(c) => <ArrowLeft size={20} color={c} />} />
      </View>
    </View>
  );
}
