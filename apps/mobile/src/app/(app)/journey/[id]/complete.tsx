import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { useCompleteJourney, useGetRecap } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { plural } from '@/lib/plural';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Heading, Lead } from '@/ui/Heading';
import { Loading } from '@/ui/Loading';
import { Photo } from '@/ui/Photo';
import { Problem } from '@/ui/Problem';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

/** 5.7 Complete a journey: one last note. It becomes the last page of the story, and the recap is made for you. */
export default function CompleteJourney() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cache = useCache();
  const recap = useGetRecap(id);
  const [note, setNote] = useState('');
  const complete = useCompleteJourney({
    mutation: {
      onSuccess: async (completed) => {
        await cache.journeyChanged(completed);
        router.replace(`/journey/${id}/recap`);
      },
    },
  });
  const r = recap.data;

  return (
    <Screen
      header={<AppBar title="Complete journey" trailing={<View style={{ width: 40 }} />} />}
      footer={
        <>
          {complete.isError ? (
            <Txt variant="caption" color="danger" center accessibilityLiveRegion="polite">
              {messageFor(complete.error)}
            </Txt>
          ) : null}
          <Button label="Complete journey" size="lg" block disabled={!r} loading={complete.isPending} onPress={() => complete.mutate({ id, data: { closingNote: note.trim() } })} />
        </>
      }>
      {recap.isPending ? (
        <View style={{ height: 200 }}>
          <Loading />
        </View>
      ) : recap.isError || !r ? (
        <View style={{ height: 260 }}>
          <Problem message={messageFor(recap.error)} onRetry={() => void recap.refetch()} retrying={recap.isRefetching} />
        </View>
      ) : (
        <>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginTop: 6, marginHorizontal: -4 }}>
            <Photo uri={r.journey.coverThumbUrl} radius="thumb" style={{ width: 64, height: 64 }} />
            <View style={{ flex: 1 }}>
              <Txt variant="headline" numberOfLines={1} weight={800}>
                {r.journey.title}
              </Txt>
              <Txt variant="caption" weight={500} numberOfLines={1} color="muted">
                {plural(r.dayCount, 'day')} · {plural(r.entryCount, 'entry', 'entries')} · {plural(r.placeCount, 'place')}
              </Txt>
            </View>
          </Card>
          <Heading style={{ marginTop: 22 }}>How did it end?</Heading>
          <Lead>A closing note for your followers. It becomes the last page of the story.</Lead>
          <View style={{ marginTop: 16 }}>
            <Field label={`Closing note · ${note.length} of 500`} value={note} onChangeText={setNote} multiline maxLength={500} />
          </View>
          <Txt variant="footnote" color="muted" style={{ marginTop: 12, marginHorizontal: 4 }}>
            A completed journey takes no new entries. Everyone who follows it sees that it&apos;s finished.
          </Txt>
        </>
      )}
    </Screen>
  );
}
