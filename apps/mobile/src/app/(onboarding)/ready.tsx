import type { Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useGetFollowedJourneys, useGetMe } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { useOnboarding } from '@/auth/onboarding';
import { track } from '@/features/analytics/analytics';
import { TemplateCard } from '@/features/journeys/TemplateCard';
import { firstName } from '@/lib/names';
import { radius, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Emoji } from '@/ui/Emoji';
import { Heading, Lead } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

/** 2.5 All set: sign-up ends by offering the most important thing, starting a journey, without forcing it. */
export default function Ready() {
  const { colors } = useTheme();
  const onboarding = useOnboarding();
  const cache = useCache();
  const me = useGetMe();
  const followed = useGetFollowedJourneys({ limit: 100 });
  const first = firstName(me.data?.profile?.displayName);
  const count = followed.data?.items.length ?? 0;

  const leave = (then?: Href) => {
    // ("signed_up" is counted when the profile is made, by the API call; this says how sign-up ended.)
    track('sign_up_finished', { journeys_followed: count, starts_a_journey: then !== undefined });
    void cache.everything();
    onboarding.finish(then);
  };

  return (
    <Screen footer={<Button label={words.onboarding.ready.later} size="lg" variant="line" block onPress={() => leave()} />}>
      <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 12 }}>
        <View style={{ width: 140, height: 140, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
          <Emoji char="🎉" size={78} />
        </View>
      </View>
      <Heading center>{words.onboarding.ready.title(first)}</Heading>
      <Lead center>{words.onboarding.ready.body(count)}</Lead>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 24, marginHorizontal: -4 }}>
        <TemplateCard emoji="🧳" name={words.onboarding.ready.trip.name} description={words.onboarding.ready.trip.description} onPress={() => leave('/new?template=trip')} />
        <TemplateCard emoji="🔥" name={words.onboarding.ready.challenge.name} description={words.onboarding.ready.challenge.description} onPress={() => leave('/new?template=challenge30')} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={words.onboarding.ready.somethingElse}
        onPress={() => leave('/new')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginTop: 12,
          marginHorizontal: -4,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: radius.photo,
          backgroundColor: colors.fill,
          opacity: pressed ? 0.8 : 1,
        })}>
        <Txt variant="callout" weight={700} style={{ flex: 1 }}>
          {words.onboarding.ready.somethingElse}
        </Txt>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>
    </Screen>
  );
}
