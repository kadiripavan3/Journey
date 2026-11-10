import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { type JourneyResponse, useFollowJourney, useGetSuggestedJourneys, useUnfollowJourney } from '@/api/generated/journey';
import { JourneyRow } from '@/features/journeys/JourneyRow';
import { compact } from '@/lib/plural';
import { AppBar, StepProgress } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Heading, Lead } from '@/ui/Heading';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

/** 2.3 Journeys to follow: step 3 of 3. Real journeys in progress, matched to the interests just picked. */
export default function Suggested() {
  const router = useRouter();
  const suggested = useGetSuggestedJourneys({ limit: 6 });
  // The list is kept as first loaded, so a journey doesn't vanish from it the moment it is followed.
  const [list, setList] = useState<JourneyResponse[] | null>(null);
  if (!list && suggested.data) setList(suggested.data);
  const [following, setFollowing] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const follow = useFollowJourney({ mutation: { onError: (error, { id }) => fail(error, id, false) } });
  const unfollow = useUnfollowJourney({ mutation: { onError: (error, { id }) => fail(error, id, true) } });
  const fail = (error: unknown, id: string, wasFollowing: boolean) => {
    setProblem(messageFor(error));
    setFollowing((now) => (wasFollowing ? [...now, id] : now.filter((x) => x !== id)));
  };
  const toggle = (id: string) => {
    setProblem(null);
    if (following.includes(id)) {
      setFollowing((now) => now.filter((x) => x !== id));
      unfollow.mutate({ id });
    } else {
      setFollowing((now) => [...now, id]);
      follow.mutate({ id });
    }
  };

  return (
    <Screen
      header={<AppBar center={<StepProgress step={3} />} />}
      footer={
        <>
          {problem ? (
            <Txt variant="caption" color="danger" center>
              {problem}
            </Txt>
          ) : null}
          <Button label="Continue" size="lg" block disabled={follow.isPending || unfollow.isPending} onPress={() => router.push('/notify')} />
          <Txt variant="small" weight={500} color="muted" center>
            Find more any time in Discover.
          </Txt>
        </>
      }>
      <Heading style={{ marginTop: 6 }}>Follow a few journeys</Heading>
      <Lead>New chapters from them will show up on your Home.</Lead>
      <View style={{ marginTop: 16, marginHorizontal: -20 }}>
        {!list && suggested.isError ? (
          <View style={{ height: 260 }}>
            <Problem message={messageFor(suggested.error)} onRetry={() => void suggested.refetch()} retrying={suggested.isRefetching} />
          </View>
        ) : !list ? (
          <View style={{ height: 200 }}>
            <Loading />
          </View>
        ) : list.length === 0 ? (
          <Txt color="muted" center style={{ marginTop: 40, marginHorizontal: 40 }}>
            No journeys to suggest yet. You can start the first one.
          </Txt>
        ) : (
          list.map((journey) => {
            const on = following.includes(journey.id);
            const followers = journey.followerCount + (on ? 1 : 0);
            return (
              <JourneyRow
                key={journey.id}
                coverUrl={journey.coverThumbUrl}
                title={journey.title}
                detail={`${journey.owner.displayName} · ${journey.progressLabel}${followers > 0 ? `\n${compact(followers)} following` : ''}`}
                trailing={
                  on ? (
                    <Button label="Following" inline size="sm" variant="soft" icon={(c) => <Check size={16} color={c} strokeWidth={2.6} />} onPress={() => toggle(journey.id)} />
                  ) : (
                    <Button label="Follow" inline size="sm" onPress={() => toggle(journey.id)} />
                  )
                }
              />
            );
          })
        )}
      </View>
    </Screen>
  );
}
