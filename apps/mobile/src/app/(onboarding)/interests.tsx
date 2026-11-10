import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { useGetCatalog, useGetMe, useSaveProfile } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { AppBar, StepProgress } from '@/ui/AppBar';
import { Loading, Problem } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Heading, Lead } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

const MINIMUM = 3;

/** 2.2 Interests: step 2 of 3. They shape Discover and the journeys suggested next. */
export default function Interests() {
  const router = useRouter();
  const refresh = useRefreshAll();
  const me = useGetMe();
  const catalog = useGetCatalog();
  const profile = me.data?.profile;
  const [picked, setPicked] = useState<string[]>(() => profile?.interests ?? []);
  const save = useSaveProfile({
    mutation: {
      onSuccess: async () => {
        await refresh();
        router.push('/suggested');
      },
    },
  });

  const toggle = (id: string) => setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));
  const enough = picked.length >= MINIMUM;

  return (
    <Screen
      header={<AppBar center={<StepProgress step={2} />} />}
      footer={
        <>
          {save.isError ? (
            <Txt variant="caption" color="danger" center>
              {messageFor(save.error)}
            </Txt>
          ) : null}
          <Button
            label={enough ? `Continue · ${picked.length} picked` : `Pick ${MINIMUM - picked.length} more`}
            size="lg"
            block
            disabled={!enough || !profile}
            loading={save.isPending}
            // The whole profile is sent each time, so the name and bio from the step before are kept.
            onPress={() => profile && save.mutate({ data: { displayName: profile.displayName, username: profile.username, bio: profile.bio, link: profile.link ?? '', interests: picked } })}
          />
        </>
      }>
      <Heading style={{ marginTop: 6 }}>What are you into?</Heading>
      <Lead>Pick at least three. We&apos;ll suggest journeys to match.</Lead>
      {catalog.isPending ? (
        <View style={{ height: 200 }}>
          <Loading />
        </View>
      ) : catalog.isError ? (
        <View style={{ height: 260 }}>
          <Problem error={catalog.error} onRetry={() => void catalog.refetch()} retrying={catalog.isRefetching} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 24 }}>
          {catalog.data.interests.map((interest) => (
            <Chip key={interest.id} label={interest.label} emoji={interest.emoji} selected={picked.includes(interest.id)} onPress={() => toggle(interest.id)} />
          ))}
        </View>
      )}
    </Screen>
  );
}
