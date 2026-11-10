import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useGetFollowedJourneys, useGetMe } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { useOnboarding } from '@/auth/onboarding';
import { plural } from '@/lib/plural';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Heading, Lead } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { TemplateCard } from '@/ui/TemplateCard';
import { Txt } from '@/ui/Txt';

/** 2.5 All set: sign-up ends by offering the most important thing, starting a journey, without forcing it. */
export default function Ready() {
  const { colors } = useTheme();
  const onboarding = useOnboarding();
  const refresh = useRefreshAll();
  const me = useGetMe();
  const followed = useGetFollowedJourneys();
  const firstName = me.data?.profile?.displayName.trim().split(/\s+/)[0] ?? '';
  const count = followed.data?.length ?? 0;

  const leave = (then?: string) => {
    void refresh();
    onboarding.finish(then);
  };

  return (
    <Screen footer={<Button label="Maybe later, take me Home" size="lg" variant="line" block onPress={() => leave()} />}>
      <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 12 }}>
        <View style={{ width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
          <Txt accessible={false} style={{ fontSize: 66, lineHeight: 80 }}>
            🎉
          </Txt>
        </View>
      </View>
      <Heading center>{firstName ? `You're all set, ${firstName}` : "You're all set"}</Heading>
      <Lead center>
        {count > 0 ? `Your Home already has ${plural(count, 'journey')} to follow. Want to start your own?` : 'Want to start a journey of your own?'}
      </Lead>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 24, marginHorizontal: -4 }}>
        <TemplateCard emoji="🧳" name="A trip" description="Day by day, with a map of where you've been" onPress={() => leave('/new?template=trip')} />
        <TemplateCard emoji="🔥" name="A 30-day challenge" description="A check-in a day, with people cheering" onPress={() => leave('/new?template=challenge30')} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Something else: learn a skill, build something, keep a journal"
        onPress={() => leave('/new')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginTop: 12,
          marginHorizontal: -4,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 18,
          backgroundColor: colors.fill,
          opacity: pressed ? 0.8 : 1,
        })}>
        <Txt weight={700} style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
          Something else: learn a skill, build something, keep a journal
        </Txt>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>
    </Screen>
  );
}
