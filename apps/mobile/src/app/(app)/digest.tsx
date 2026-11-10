import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetDigest } from '@/api/generated/journey';
import { EntryPost } from '@/features/entries/EntryPost';
import { entryEyebrow } from '@/features/entries/labels';
import { JourneyRow } from '@/features/journeys/JourneyRow';
import { PageProblem } from '@/features/states/PageProblem';
import { formatDay } from '@/lib/dates';
import { plural } from '@/words/en/plural';
import { layout, radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { GroupLabel } from '@/ui/Heading';
import { Loading } from '@/ui/Loading';
import { Pill } from '@/ui/Pill';
import { Txt } from '@/ui/Txt';

/** 8.3 Weekly digest: what moved on in the journeys you follow. It ends like the feed does, and a quiet week says so. */
export default function Digest() {
  const router = useRouter();
  const { colors } = useTheme();
  const digest = useGetDigest();
  const d = digest.data;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="This week" subtitle={d ? `${formatDay(d.from)} to ${formatDay(d.to)}` : undefined} trailing={<View style={{ width: 40 }} />} />
      {!d ? (
        digest.isError ? <PageProblem error={digest.error} onRetry={() => void digest.refetch()} retrying={digest.isFetching} /> : <Loading offline={digest.isPaused} />
      ) : d.entryCount === 0 && d.finished.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 60 }}>
          <EmptyState emoji="🌙" title="A quiet week" body="Nothing new in the journeys you follow. When there is, it shows up here." action={<Button label="Find more in Discover" onPress={() => router.navigate('/discover')} />} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {d.moment ? (
            <>
              <GroupLabel style={{ marginHorizontal: layout.gutter, marginTop: 10 }}>Moment of the week</GroupLabel>
              <Card style={{ marginHorizontal: layout.barGutter, padding: 14, borderRadius: radius.panel }}>
                <EntryPost entry={d.moment} onPress={() => router.push(`/entry/${d.moment?.id}`)} />
                <Txt variant="footnote" numberOfLines={1} color="muted" style={{ marginTop: 10 }}>
                  {d.moment.author.displayName} · {d.moment.journeyTitle}
                </Txt>
              </Card>
            </>
          ) : null}

          {d.journeys.length > 0 ? (
            <>
              <GroupLabel style={{ marginHorizontal: layout.gutter }}>{plural(d.journeys.length, 'journey moved on', 'journeys moved on')}</GroupLabel>
              {d.journeys.map(({ journey, newCount, latest }) => (
                <JourneyRow
                  key={journey.id}
                  coverUrl={journey.coverThumbUrl}
                  title={journey.title}
                  detail={entryEyebrow(latest)}
                  onPress={() => router.push(`/journey/${journey.id}/timeline`)}
                  trailing={<Pill tone="accent" label={`${newCount} new`} style={{ alignSelf: 'center' }} />}
                />
              ))}
            </>
          ) : null}

          {d.finished.length > 0 ? (
            <>
              <GroupLabel style={{ marginHorizontal: layout.gutter }}>Finished this week</GroupLabel>
              {d.finished.map((journey) => (
                <JourneyRow
                  key={journey.id}
                  coverUrl={journey.coverThumbUrl}
                  title={journey.title}
                  detail={`${journey.owner.displayName} · see the recap`}
                  onPress={() => router.push(`/journey/${journey.id}/recap`)}
                />
              ))}
            </>
          ) : null}

          <View style={{ alignItems: 'center', gap: 8, marginTop: 28, marginHorizontal: 30 }}>
            <Txt variant="subtitle" accessibilityRole="header" center>
              That&apos;s your week
            </Txt>
            {d.entryCount > 0 ? <Button label={`Catch up on ${plural(d.entryCount, 'entry', 'entries')}`} onPress={() => router.push('/following')} style={{ alignSelf: 'center' }} /> : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
